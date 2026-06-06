"""
RQ Job: run_ping_job

Each job in this module is executed by a dedicated `rq worker` process
consuming from the "device_pings" Redis queue. The job:

1. Pings the device IP using asyncio subprocess.
2. Parses latency from stdout.
3. Applies the 3-consecutive-failure threshold for DOWN detection.
4. Writes a PingLog record to PostgreSQL.
5. Manages Downtime open/close records.
6. Fires alerts on status transitions.

NOTE: RQ workers run synchronously, so we wrap async operations with
asyncio.run() to bridge into the async SQLAlchemy + ping engine.
"""
import asyncio
import logging
import re
from datetime import datetime, timezone
import sys
from typing import Optional

from app.services.redis_queue import redis_conn

logger = logging.getLogger("rq.worker")
LATENCY_REGEX = re.compile(r"time=([\d.]+)\s*ms", re.IGNORECASE)
SUMMARY_REGEX = re.compile(r"min/avg/max/stddev\s*=\s*[\d.]+/([\d.]+)/", re.IGNORECASE)
FAILURE_THRESHOLD = 3
REDIS_FAIL_PREFIX = "device_fail_count:"

def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

async def _ping_ip(ip_address: str, attempts: int = 5) -> tuple[str, Optional[float], float]:
    """
    Sends multiple ping attempts to calculate packet loss and avg latency.
    Returns: (status, avg_latency, packet_loss_percentage)
    """
    latencies = []
    received = 0
    timeout_val = "1000" if sys.platform == "darwin" else "1"
    
    try:
        async def single_ping():
            proc = await asyncio.create_subprocess_exec(
                "ping", "-c", "1", "-W", timeout_val, ip_address,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await proc.communicate()
            output = stdout.decode("utf-8")
            if proc.returncode == 0:
                match = LATENCY_REGEX.search(output)
                if match:
                    return float(match.group(1))
                summary_match = SUMMARY_REGEX.search(output)
                if summary_match:
                    return float(summary_match.group(1))
            return None

        # Execute multiple attempts
        tasks = [single_ping() for _ in range(attempts)]
        results = await asyncio.gather(*tasks)
        
        for r in results:
            if r is not None:
                received += 1
                latencies.append(r)
                
        packet_loss = ((attempts - received) / attempts) * 100.0
        avg_latency = sum(latencies) / len(latencies) if latencies else None
        
        # If any pings were received, we consider the device "up" for basic status,
        # but SLA reports can use the loss % for "degraded" logic if needed.
        # If 100% loss, it's definitely down.
        status = "up" if received > 0 else "down"
        
        return status, avg_latency, packet_loss
        
    except Exception as e:
        logger.error(f"Error pinging {ip_address}: {e}")
        return "down", None, 100.0

async def _check_resource_usage():
    import psutil
    cpu = psutil.cpu_percent()
    if cpu > 95:
        logger.warning(f"[RESOURCES] Critical CPU load ({cpu}%). Aborting batch.")
        raise Exception("System Overload")

async def _process_device(session, device_data, now, is_maintenance=False):
    dev_id = device_data["id"]
    ip = device_data["ip_address"]
    
    # 5-packet burst for high accuracy
    status, latency, packet_loss = await _ping_ip(ip, attempts=5)

    # Override status if in maintenance window
    if is_maintenance and status == "down":
        status = "maintenance"

    from app.models.ping_log import PingLog
    from app.models.device import Device
    from app.models.downtime import Downtime
    from app.services.alert_service import send_device_alert
    from sqlalchemy.future import select

    # 1. Log metrics with packet loss
    session.add(PingLog(
        device_id=dev_id, 
        status=status, 
        latency_ms=latency, 
        packet_loss=packet_loss,
        checked_at=now
    ))

    redis_key = f"{REDIS_FAIL_PREFIX}{dev_id}"
    
    # 2. Status Lifecycle Management
    if status == "down":
        count = int(redis_conn.incr(redis_key))
        redis_conn.expire(redis_key, 86400)
        
        # Transition to DOWN after threshold
        if count == FAILURE_THRESHOLD and device_data["status"] != "down":
            res = await session.execute(select(Device).where(Device.id == dev_id))
            dev = res.scalars().first()
            if dev:
                dev.status = "down"
                # Start new outage record
                session.add(Downtime(device_id=dev.id, started_at=now))
                await send_device_alert(
                    session,
                    dev.tenant_id,
                    dev.name,
                    device_data.get("customer_name", "N/A"),
                    dev.ip_address,
                    "down",
                    now
                )
                
    elif status == "up":
        redis_conn.delete(redis_key)
        
        # Transition to UP (from DOWN or UNKNOWN)
        if device_data["status"] != "up":
            res = await session.execute(select(Device).where(Device.id == dev_id))
            dev = res.scalars().first()
            if dev:
                dev.status = "up"
                
                # Only close outage recorder if it was previously considered down
                if device_data["status"] == "down":
                    dt_res = await session.execute(
                        select(Downtime)
                        .where(Downtime.device_id == dev.id, Downtime.ended_at == None)
                        .order_by(Downtime.started_at.desc())
                        .limit(1)
                    )
                    active_dt = dt_res.scalars().first()
                    if active_dt:
                        active_dt.ended_at = now
                        active_dt.duration_seconds = int((now - active_dt.started_at).total_seconds())
                
                # Always send recovery/activation alert
                await send_device_alert(
                    session,
                    dev.tenant_id,
                    dev.name,
                    device_data.get("customer_name", "N/A"),
                    dev.ip_address,
                    "up",
                    now
                )

async def _execute_batch(device_batch: list):
    from app.database import AsyncSessionLocal
    from app.services.maintenance_service import MaintenanceService
    
    await _check_resource_usage()
    now = _utc_now()
    
    device_ids = [d["id"] for d in device_batch]
    maint_states = {d_id: MaintenanceService.is_in_maintenance(d_id) for d_id in device_ids}

    async with AsyncSessionLocal() as session:
        tasks = [
            _process_device(session, dev, now, is_maintenance=maint_states.get(dev["id"], False)) 
            for dev in device_batch
        ]
        await asyncio.gather(*tasks)
        await session.commit()

def run_ping_batch(device_batch: list):
    logger.info(f"[JOB] Processing batch of {len(device_batch)} devices...")
    asyncio.run(_execute_batch(device_batch))

def run_ping_job(device_id: str, device_name: str, ip_address: str, current_status: str):
    run_ping_batch([{"id": device_id, "name": device_name, "ip_address": ip_address, "status": current_status}])

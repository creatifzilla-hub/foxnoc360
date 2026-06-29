import asyncio
import re
import logging
import httpx
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload

from app.database import AsyncSessionLocal
from app.config import settings
from app.models.tenant import Tenant
from app.models.customer import Customer
from app.models.device import Device
from app.models.ping_log import PingLog
from app.models.downtime import Downtime
from app.services.alert_service import send_device_alert

logger = logging.getLogger("ping_worker")

# Regex to extract telemetry from ping output
LATENCY_REGEX = re.compile(r"time=([\d.]+)\s*ms", re.IGNORECASE)
SUMMARY_REGEX = re.compile(r"min/avg/max/stddev\s*=\s*[\d.]+/([\d.]+)/", re.IGNORECASE)
LOSS_REGEX = re.compile(r"(\d+(?:\.\d+)?)%\s+packet\s+loss", re.IGNORECASE)

# In-memory dictionary to track consecutive failures per device UUID
# { "device_id": int(count) }
failure_counts = {}
FAILURE_THRESHOLD = 3


def utc_now():
    return datetime.now(timezone.utc)


async def ping_device_async(ip_address: str) -> tuple[str, Optional[float], Optional[float]]:
    """
    Probe a host.
    * TCP (multi-port) – attempts TCP connect to common ports (80, 443, 22).
    * HTTP fallback  – fires an HTTP GET if TCP fails.
    * ICMP           – uses the system ping binary if PING_METHOD=icmp.
    Returns (status, latency_ms, packet_loss_pct)
    """
    ping_method = getattr(settings, "PING_METHOD", "tcp").lower()

    if ping_method == "tcp":
        # ---- Concurrent multi-port TCP probe --------------------------
        # Try common network-device ports all at once. If ANY responds
        # within the timeout, the device is considered UP.
        # Covers: HTTP(80), HTTPS(443), SSH(22), Telnet(23), Alt-HTTP(8080)
        PROBE_PORTS = [22, 23, 53, 80, 443, 8080]
        configured_port = getattr(settings, "PING_TCP_PORT", 80)
        if configured_port not in PROBE_PORTS:
            PROBE_PORTS.insert(0, configured_port)

        loop = asyncio.get_event_loop()
        probe_start = loop.time()

        async def try_port(p: int):
            t0 = loop.time()
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip_address, p), timeout=2.0
                )
                lat = (loop.time() - t0) * 1000
                writer.close()
                try:
                    await writer.wait_closed()
                except Exception:
                    pass
                return lat  # success → return latency
            except Exception:
                return None  # failure

        port_results = await asyncio.gather(*[try_port(p) for p in PROBE_PORTS])
        for lat in port_results:
            if lat is not None:
                return "up", lat, 0.0

        # ---- HTTP probe fallback (any response = reachable) ------------
        try:
            http_start = loop.time()
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"http://{ip_address}", follow_redirects=False)
            http_latency = (loop.time() - http_start) * 1000
            # ANY response (even 4xx/5xx) proves the host is reachable
            return "up", http_latency, 0.0
        except Exception as http_err:
            logger.debug(f"HTTP fallback failed for {ip_address}: {http_err}")

        return "down", None, 100.0

    else:
        # ---- ICMP implementation ------------------------------------
        try:
            process = await asyncio.create_subprocess_exec(
                "ping", "-c", "5", ip_address,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await process.communicate()
            output = stdout.decode("utf-8")

            loss_match = LOSS_REGEX.search(output)
            loss_pct = float(loss_match.group(1)) if loss_match else None

            summary_match = SUMMARY_REGEX.search(output)
            latency_ms = float(summary_match.group(1)) if summary_match else None

            if process.returncode == 0 or (loss_pct is not None and loss_pct < 100):
                return "up", latency_ms, loss_pct
            else:
                return "down", None, 100.0
        except Exception as e:
            logger.error(f"Error pinging {ip_address}: {e}")
            return "down", None, 100.0


async def _run_ping_task(device: Device, sem: asyncio.Semaphore) -> tuple[Device, str, Optional[float], Optional[float]]:
    """
    Wrapper for pinging utilizing an active Semaphore rate limit.
    """
    async with sem:
        status, latency, loss = await ping_device_async(device.ip_address)

        lat_text = f"{latency:.1f}ms" if latency else "N/A"
        loss_text = f"{loss}%" if loss is not None else "0%"
        logger.info(
            f"Ping | Name: {device.name} | IP: {device.ip_address} | "
            f"Status: {status.upper()} | Latency: {lat_text} | Loss: {loss_text}"
        )

        return device, status, latency, loss


async def monitor_devices_async():
    """
    Queries all devices, pings up to 100 concurrently via Semaphore, and processes advanced failure
    logic (3 consecutive drops -> DOWN -> Create Downtime Record), batch saving SQL entries.
    """
    async with AsyncSessionLocal() as session:
        # 1. Query all hardware devices, joining Customer table to grab names for alerts
        result = await session.execute(select(Device).options(joinedload(Device.customer)))
        devices = result.scalars().all()

        if not devices:
            return

        # 2. Limit concurrency to 100 parallel pings
        sem = asyncio.Semaphore(100)

        # 3. Launch async ping tasks securely within Semaphore bounds
        ping_tasks = [_run_ping_task(device, sem) for device in devices]

        # 4. Gather results concurrently
        results = await asyncio.gather(*ping_tasks)

        # 5. Save results to PingLog in bulk
        log_entries = []
        for device, status, latency, loss in results:
            dev_id = str(device.id)

            log_entries.append(PingLog(
                device_id=device.id,
                status=status,
                latency_ms=latency,
                packet_loss=loss,
                checked_at=utc_now()
            ))

            # --- Downtime Logic Engine ---
            if status == "down":
                current_fails = failure_counts.get(dev_id, 0) + 1
                failure_counts[dev_id] = current_fails

                # Is it transitioning from UP -> DOWN exactly at the threshold?
                if current_fails == FAILURE_THRESHOLD and device.status != "down":
                    device.status = "down"

                    # Open a fresh Downtime tracking record
                    downtime_record = Downtime(
                        device_id=device.id,
                        started_at=utc_now()
                    )
                    session.add(downtime_record)

                    # Trigger external alerts
                    cust_name = device.customer.name if getattr(device, 'customer', None) else "Unknown"
                    await send_device_alert(
                        session, device.tenant_id, device.name,
                        cust_name, device.ip_address, "down", utc_now()
                    )

            elif status == "up":
                # Clear counter upon successful ping
                failure_counts[dev_id] = 0

                # Is it recovering from a DOWN state?
                if device.status == "down":
                    device.status = "up"

                    # Find the active downtime record and close it
                    dt_result = await session.execute(
                        select(Downtime)
                        .where(Downtime.device_id == device.id, Downtime.ended_at == None)
                        .order_by(Downtime.started_at.desc())
                        .limit(1)
                    )
                    active_downtime = dt_result.scalars().first()

                    if active_downtime:
                        now = utc_now()
                        active_downtime.ended_at = now
                        delta = now - active_downtime.started_at
                        active_downtime.duration_seconds = int(delta.total_seconds())

                    # Send recovery external alerts
                    cust_name = device.customer.name if getattr(device, 'customer', None) else "Unknown"
                    await send_device_alert(
                        session, device.tenant_id, device.name,
                        cust_name, device.ip_address, "up", utc_now()
                    )

        # Save all the logs globally via native bulk insert mapped command
        session.add_all(log_entries)

        # Commit all state transitions, downtime objects, and bulk logs atomically
        await session.commit()

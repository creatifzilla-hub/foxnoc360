from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timezone
from uuid import UUID

from app.models.downtime import Downtime
from app.models.ping_log import PingLog
from app.models.snmp_log import SNMPLog


async def calculate_bandwidth_stats(
    db: AsyncSession,
    device_id: UUID,
    if_index: int,
    start_date: datetime,
    end_date: datetime
) -> dict:
    """
    Calculates bandwidth metrics (Peak, Avg, 95th Percentile) for an interface.
    Used for both dashboard performance views and SLA reports.
    """
    stmt = select(SNMPLog).where(
        SNMPLog.device_id == device_id,
        SNMPLog.if_index == if_index,
        SNMPLog.polled_at >= start_date,
        SNMPLog.polled_at <= end_date
    ).order_by(SNMPLog.polled_at)
    
    result = await db.execute(stmt)
    logs = result.scalars().all()
    
    if not logs:
        return {
            "avg_in": 0, "peak_in": 0, "p95_in": 0,
            "avg_out": 0, "peak_out": 0, "p95_out": 0,
            "sample_count": 0
        }
        
    in_vals = [l.in_bps for l in logs if l.in_bps is not None]
    out_vals = [l.out_bps for l in logs if l.out_bps is not None]
    
    def get_95th(vals):
        if not vals: return 0
        s = sorted(vals)
        return s[max(0, int(len(s) * 0.95) - 1)]

    return {
        "avg_in": sum(in_vals) / len(in_vals) if in_vals else 0,
        "peak_in": max(in_vals) if in_vals else 0,
        "p95_in": get_95th(in_vals),
        "avg_out": sum(out_vals) / len(out_vals) if out_vals else 0,
        "peak_out": max(out_vals) if out_vals else 0,
        "p95_out": get_95th(out_vals),
        "sample_count": len(logs)
    }


async def calculate_device_uptime(
    db: AsyncSession,
    device_id: UUID,
    start_date: datetime,
    end_date: datetime,
    sla_threshold: float = 99.9
) -> dict:
    """
    Calculates the total downtime and uptime percentage for a given device
    over a designated time period.

    Strategy:
    1. Use ping logs as the primary ground truth (count up vs down pings).
    2. Fall back to Downtime records if no ping logs exist.
    3. Always include any currently open (ongoing) downtime incident.
    """
    from app.models.device import Device
    
    # Ensure timezone awareness to prevent offset-naive crashes
    if not start_date.tzinfo:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if not end_date.tzinfo:
        end_date = end_date.replace(tzinfo=timezone.utc)

    # Fetch device to verify existence and creation time
    dev_stmt = select(Device.created_at).where(Device.id == device_id)
    dev_res = await db.execute(dev_stmt)
    created_at = dev_res.scalar()
    
    # Effectively clamp the start_date to the device's creation date 
    # to realistically prevent fake 100% SLA uptime before the device actively existed.
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    
    effective_start = max(start_date, created_at) if created_at else start_date
    total_time_seconds = (end_date - effective_start).total_seconds()
    
    if total_time_seconds <= 0:
        return {
            "device_id": str(device_id),
            "total_downtime_seconds": 0,
            "uptime_percentage": 0.0,
            "incident_count": 0,
            "total_checks": 0,
            "successful_checks": 0,
            "failed_checks": 0,
            "avg_latency": 0.0,
            "max_latency": 0.0,
            "avg_packet_loss": 0.0,
            "is_compliant": False
        }

    # Helper to calculate ongoing open downtime duration
    async def get_ongoing_downtime():
        open_stmt = select(Downtime).where(
            Downtime.device_id == device_id,
            Downtime.ended_at.is_(None),
        )
        open_result = await db.execute(open_stmt)
        open_dt = open_result.scalars().first()
        if not open_dt:
            return 0, 0
        
        now = datetime.now(timezone.utc)
        effective_end = min(now, end_date)
        
        started = open_dt.started_at
        if not started.tzinfo:
            started = started.replace(tzinfo=timezone.utc)
            
        duration = 0
        if started <= end_date:
            effective_start = max(started, start_date)
            duration = max(0, (effective_end - effective_start).total_seconds())
            
        return int(duration), 1

    open_duration, open_incident_count = await get_ongoing_downtime()

    # --- Primary: Ping Log Based ---
    ping_stmt = select(
        func.count(PingLog.id).label("total_checks"),
        func.avg(PingLog.latency_ms).label("avg_latency"),
        func.max(PingLog.latency_ms).label("max_latency"),
        func.avg(PingLog.packet_loss).label("avg_packet_loss")
    ).where(
        PingLog.device_id == device_id,
        PingLog.checked_at >= start_date,
        PingLog.checked_at <= end_date,
    )
    ping_aggregation = await db.execute(ping_stmt)
    agg = ping_aggregation.first()

    status_stmt = select(PingLog.status, func.count(PingLog.id)).where(
        PingLog.device_id == device_id,
        PingLog.checked_at >= start_date,
        PingLog.checked_at <= end_date,
    ).group_by(PingLog.status)
    status_results = await db.execute(status_stmt)
    status_counts = dict(status_results.all())

    total_checks = agg.total_checks or 0
    if total_checks > 0:
        down_checks = status_counts.get("down", 0)
        up_checks = total_checks - down_checks
        
        # Accurate Uptime based on actual check success ratio
        uptime_percentage = (up_checks / total_checks) * 100.0 if total_checks > 0 else 100.0

        # Count incidents from Downtime table
        inc_stmt = select(func.count(Downtime.id)).where(
            Downtime.device_id == device_id,
            Downtime.started_at >= start_date,
            Downtime.started_at <= end_date,
        )
        inc_result = await db.execute(inc_stmt)
        incident_count = inc_result.scalar_one() or 0
        # Ensure open incident isn't double counted if it started before start_date but is open
        # Wait, the inc_stmt counts all incidents that STARTED in the window.
        
        # Calculate uptime using duration as secondary validation
        duration_stmt = select(func.sum(Downtime.duration_seconds)).where(
            Downtime.device_id == device_id,
            Downtime.started_at >= start_date,
            Downtime.started_at <= end_date,
        )
        dur_result = await db.execute(duration_stmt)
        total_downtime_seconds = (dur_result.scalar() or 0) + open_duration

        return {
            "device_id": str(device_id),
            "uptime_percentage": round(uptime_percentage, 4),
            "total_downtime_seconds": int(total_downtime_seconds),
            "incident_count": incident_count + (1 if open_incident_count and open_duration > 0 else 0),
            "total_checks": total_checks,
            "successful_checks": up_checks,
            "failed_checks": down_checks,
            "avg_latency": round(agg.avg_latency or 0.0, 2),
            "max_latency": round(agg.max_latency or 0.0, 2),
            "avg_packet_loss": round(agg.avg_packet_loss or 0.0, 2),
            "is_compliant": uptime_percentage >= sla_threshold
        }

    # --- Fallback: Downtime Records Based ---
    stmt = (
        select(
            func.coalesce(func.sum(Downtime.duration_seconds), 0).label("total_downtime"),
            func.count(Downtime.id).label("incident_count"),
        )
        .where(
            Downtime.device_id == device_id,
            Downtime.started_at >= start_date,
            Downtime.started_at <= end_date,
        )
    )
    result = await db.execute(stmt)
    row = result.first()

    total_downtime_seconds = (row.total_downtime if row else 0) + open_duration
    incident_count = (row.incident_count if row else 0) + (1 if open_incident_count and open_duration > 0 else 0)

    if total_downtime_seconds > total_time_seconds:
        total_downtime_seconds = int(total_time_seconds)

    uptime_percentage = ((total_time_seconds - total_downtime_seconds) / total_time_seconds) * 100.0

    return {
        "device_id": str(device_id),
        "uptime_percentage": round(uptime_percentage, 4),
        "total_downtime_seconds": int(total_downtime_seconds),
        "incident_count": incident_count,
        "total_checks": 0,
        "successful_checks": 0,
        "failed_checks": 0,
        "avg_latency": 0.0,
        "max_latency": 0.0,
        "avg_packet_loss": 0.0,
        "is_compliant": uptime_percentage >= sla_threshold
    }


async def calculate_sla_summary(
    db: AsyncSession,
    tenant_id: str,
    start_date: datetime,
    end_date: datetime,
    sla_threshold: float = 99.9
) -> dict:
    """
    Calculates aggregated SLA metrics for all devices under a tenant.
    """
    from app.models.device import Device
    
    # 1. Fetch all devices for the tenant
    stmt = select(Device).where(Device.tenant_id == tenant_id)
    result = await db.execute(stmt)
    devices = result.scalars().all()
    
    total_devices = len(devices)
    if total_devices == 0:
        return {
            "total_devices": 0,
            "sla_met": 0,
            "sla_breached": 0,
            "avg_uptime": 100.0
        }
    
    uptimes = []
    latencies = []
    losses = []
    sla_met = 0
    sla_breached = 0
    total_incidents = 0
    
    for device in devices:
        report = await calculate_device_uptime(db, device.id, start_date, end_date, sla_threshold)
        uptimes.append(report["uptime_percentage"])
        latencies.append(report["avg_latency"])
        losses.append(report["avg_packet_loss"])
        total_incidents += report["incident_count"]
        
        if report["is_compliant"]:
            sla_met += 1
        else:
            sla_breached += 1
            
    avg_uptime = sum(uptimes) / total_devices
    avg_latency = sum(latencies) / total_devices
    avg_loss = sum(losses) / total_devices
    
    return {
        "total_devices": total_devices,
        "sla_met": sla_met,
        "sla_breached": sla_breached,
        "avg_uptime": round(avg_uptime, 2),
        "avg_latency": round(avg_latency, 2),
        "avg_packet_loss": round(avg_loss, 2),
        "total_incidents": total_incidents
    }

async def get_customer_sla_summary(
    db: AsyncSession,
    customer_id: str,
    start_date: datetime,
    end_date: datetime,
    sla_threshold: float = 99.5
) -> dict:
    """
    Generate an aggregated SLA report for all devices belonging to a customer.
    """
    from app.models.device import Device
    
    stmt = select(Device).where(Device.customer_id == customer_id)
    result = await db.execute(stmt)
    devices = result.scalars().all()
    
    device_reports = []
    total_uptime = 0
    total_downtime = 0
    total_incidents = 0
    
    for device in devices:
        report = await calculate_device_uptime(db, device.id, start_date, end_date, sla_threshold)
        device_reports.append(report)
        total_uptime += report["uptime_percentage"]
        total_downtime += report["total_downtime_seconds"]
        total_incidents += report["incident_count"]
    
    avg_uptime = total_uptime / len(devices) if devices else 100.0
    
    return {
        "customer_id": customer_id,
        "total_devices": len(devices),
        "avg_uptime": round(avg_uptime, 2),
        "total_downtime": total_downtime,
        "total_incidents": total_incidents,
        "is_compliant": avg_uptime >= sla_threshold,
        "device_reports": device_reports
    }

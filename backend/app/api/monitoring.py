from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case
from typing import Optional
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from uuid import UUID

from app.database import get_db
from app.models.device import Device
from app.models.ping_log import PingLog
from app.schemas.device import DeviceResponse
from app.services.auth import get_current_tenant
import uuid

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])

# ─── Schemas ──────────────────────────────────────────────────
class PingLogResponse(BaseModel):
    id: UUID
    device_id: UUID
    status: str
    latency_ms: Optional[float]
    packet_loss: Optional[float]
    checked_at: datetime

    class Config:
        from_attributes = True

class DashboardResponse(BaseModel):
    total_devices: int
    devices_up: int
    devices_down: int
    devices_unknown: int
    uptime_percentage: float
    avg_latency_ms: float
    alerts_count: int
    sla_score: float
    recent_events: list[dict]
    latency_history: list[dict]

class DeviceTableResponse(BaseModel):
    id: UUID
    device_name: str
    ip_address: str
    latest_status: str
    last_checked: Optional[datetime]
    latency_ms: Optional[float]
    packet_loss: Optional[float]
    tenant_name: Optional[str] = None
    customer_name: Optional[str] = None

# ─── Endpoints ────────────────────────────────────────────────

@router.get("/ping-logs", response_model=list[PingLogResponse])
async def get_ping_logs(db: AsyncSession = Depends(get_db)):
    """Return the last 100 ping logs."""
    result = await db.execute(
        select(PingLog).order_by(PingLog.checked_at.desc()).limit(100)
    )
    return result.scalars().all()


@router.get("/device-status", response_model=list[DeviceResponse])
async def get_device_status(db: AsyncSession = Depends(get_db), current_tenant: str = Depends(get_current_tenant)):
    """Return the latest status of each device."""
    stmt = select(Device).order_by(Device.name.asc())
    if current_tenant and current_tenant != "None":
        try:
            tenant_uuid = uuid.UUID(current_tenant)
            stmt = stmt.where(Device.tenant_id == tenant_uuid)
        except (ValueError, AttributeError):
            pass

    result = await db.execute(stmt)
    return result.scalars().all()


from app.services.auth import get_token_payload

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    period: int = 7,
    db: AsyncSession = Depends(get_db),
    payload: Optional[dict] = None,
):
    # Treat unauthenticated requests as superadmin (public Vercel view)
    if payload is None:
        payload = {"tenant_id": None, "role": "superadmin"}
    """Return dashboard statistics tracking device statuses scoped to user or global for Superadmin."""
    
    current_tenant = payload.get("tenant_id")
    is_super = payload.get("role") in ["superadmin", "super_admin"]

    # Calculate start date based on period
    now = datetime.now()
    start_date = now - timedelta(days=period)

    def apply_tenant_filter(stmt, filter_time=False):
        if not is_super and current_tenant and current_tenant != "None":
            try:
                tenant_uuid = UUID(current_tenant)
                stmt = stmt.where(Device.tenant_id == tenant_uuid)
            except ValueError: pass
        
        if filter_time:
            # Only apply time filter to logs, not device table itself for inventory counts
            stmt = stmt.where(PingLog.checked_at >= start_date)
        return stmt

    # Use latest ping log per device for up-to-date counts
    # Subquery: pick the single most-recent ping_log per device
    from sqlalchemy import over, literal_column
    from sqlalchemy.dialects.postgresql import aggregate_order_by

    latest_ping_subq = (
        select(
            PingLog.device_id,
            PingLog.status.label("ping_status"),
            func.row_number().over(
                partition_by=PingLog.device_id,
                order_by=PingLog.checked_at.desc()
            ).label("rn")
        )
        .where(PingLog.checked_at >= start_date)
        .subquery()
    )

    # Join devices → their latest ping (LEFT so devices with no pings appear as unknown)
    status_core = (
        select(
            func.coalesce(latest_ping_subq.c.ping_status, Device.status).label("effective_status")
        )
        .select_from(Device)
        .outerjoin(
            latest_ping_subq,
            (Device.id == latest_ping_subq.c.device_id) & (latest_ping_subq.c.rn == 1)
        )
    )
    # Apply tenant filter (only Device columns are available)
    if not is_super and current_tenant and current_tenant != "None":
        try:
            status_core = status_core.where(Device.tenant_id == UUID(current_tenant))
        except ValueError:
            pass

    status_result = await db.execute(status_core)
    all_statuses = [row.effective_status for row in status_result.all()]

    total_devices = len(all_statuses)
    devices_up = sum(1 for s in all_statuses if s == "up")
    devices_down = sum(1 for s in all_statuses if s == "down")
    devices_unknown = total_devices - devices_up - devices_down

    uptime_percentage = round((devices_up / total_devices * 100) if total_devices > 0 else 100.0, 2)
    
    latency_stmt = select(func.avg(PingLog.latency_ms)).join(Device, Device.id == PingLog.device_id).where(PingLog.latency_ms.is_not(None))
    latency_result = await db.execute(apply_tenant_filter(latency_stmt, filter_time=True))
    raw_lat = latency_result.scalar()
    avg_latency_ms = round(float(raw_lat) if raw_lat is not None else 0.0, 2)

    events_stmt = (
        select(PingLog, Device.name.label("device_name"), Device.ip_address)
        .join(Device, Device.id == PingLog.device_id)
        .order_by(PingLog.checked_at.desc()).limit(20)
    )
    events_result = await db.execute(apply_tenant_filter(events_stmt))
    recent_events = [{
        "device_name": r.device_name,
        "ip_address": r.ip_address,
        "status": r.PingLog.status,
        "latency_ms": r.PingLog.latency_ms,
        "checked_at": r.PingLog.checked_at.isoformat()
    } for r in events_result.all()]

    uptime_history = []  # Removed per request

    # Hourly Latency AVG for Performance Chart
    perf_stmt = (
        select(
            func.date_trunc('hour', PingLog.checked_at).label("time_bucket"),
            func.avg(PingLog.latency_ms).label("avg_latency")
        )
        .join(Device, Device.id == PingLog.device_id)
        .group_by("time_bucket")
        .order_by("time_bucket")
    )
    perf_stmt = apply_tenant_filter(perf_stmt, filter_time=True)
    perf_result = await db.execute(perf_stmt)
    latency_history = [{
        "time": r.time_bucket.isoformat(),
        "value": round(float(r.avg_latency or 0.0), 2)
    } for r in perf_result.all()]

    sla_score = uptime_percentage
    
    alerts_count = devices_down

    result = {
        "total_devices": total_devices,
        "devices_up": devices_up,
        "devices_down": devices_down,
        "devices_unknown": devices_unknown,
        "uptime_percentage": uptime_percentage,
        "avg_latency_ms": avg_latency_ms,
        "alerts_count": alerts_count,
        "sla_score": sla_score,
        "recent_events": recent_events,
        "latency_history": latency_history
    }

    try:
        import os
        os.makedirs("scratch", exist_ok=True)
        with open("scratch/request_debug.log", "a") as f:
            f.write(f"[{datetime.now().isoformat()}] USER={payload.get('sub')} ROLE={payload.get('role')} TENANT={payload.get('tenant_id')} -> RESPONSE: {result}\n")
    except Exception as e:
        pass

    return result


@router.get("/devices-table", response_model=list[DeviceTableResponse])
async def get_devices_table(
    db: AsyncSession = Depends(get_db),
    payload: Optional[dict] = None,
):
    # Public access fallback – treat as superadmin
    if payload is None:
        payload = {"tenant_id": None, "role": "superadmin"}
    """Return device monitoring table joined with latest ping logs, sorted globally by latest check-in."""
    current_tenant = payload.get("tenant_id")
    is_super = payload.get("role") in ["superadmin", "super_admin"]

    from app.models.tenant import Tenant
    from app.models.customer import Customer

    # Step 1: Rank ping logs per device by recency (most recent = rank 1)
    ranked_pings = (
        select(
            PingLog.device_id,
            PingLog.status.label("ping_status"),
            PingLog.checked_at.label("last_checked"),
            PingLog.latency_ms,
            PingLog.packet_loss,
            func.row_number().over(
                partition_by=PingLog.device_id,
                order_by=PingLog.checked_at.desc()
            ).label("rn")
        )
        .subquery()
    )

    # Step 2: Join devices with their single latest ping (rank=1)
    stmt = (
        select(
            Device.id,
            Device.name.label("device_name"),
            Device.ip_address,
            func.coalesce(ranked_pings.c.ping_status, Device.status).label("latest_status"),
            ranked_pings.c.last_checked,
            ranked_pings.c.latency_ms,
            ranked_pings.c.packet_loss,
            Tenant.name.label("tenant_name"),
            Customer.name.label("customer_name"),
        )
        .select_from(Device)
        .outerjoin(ranked_pings, (Device.id == ranked_pings.c.device_id) & (ranked_pings.c.rn == 1))
        .outerjoin(Tenant, Device.tenant_id == Tenant.id)
        .outerjoin(Customer, Device.customer_id == Customer.id)
    )

    # Apply tenant filter if not superadmin
    if not is_super and current_tenant and current_tenant != "None":
        try:
            tenant_uuid = UUID(current_tenant)
            stmt = stmt.where(Device.tenant_id == tenant_uuid)
        except ValueError:
            pass

    stmt = stmt.order_by(ranked_pings.c.last_checked.desc().nulls_last(), Device.name.asc())

    result = await db.execute(stmt)
    return [DeviceTableResponse(**row._mapping) for row in result.all()]


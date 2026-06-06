import asyncio
from datetime import datetime, timezone, timedelta
from app.database import AsyncSessionLocal
from app.models.device import Device
from app.models.ping_log import PingLog
from app.models.tenant import Tenant
from app.models.user import User
from sqlalchemy import select, func
from uuid import UUID

async def test_dashboard_for_tenant(session, tenant_id, is_super, role_name):
    # This is exactly the logic inside get_dashboard in monitoring.py
    period = 7
    now = datetime.now()  # timezone naive as in monitoring.py
    start_date = now - timedelta(days=period)

    # Subquery: pick the single most-recent ping_log per device
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
    
    # Apply tenant filter
    if not is_super and tenant_id and tenant_id != "None":
        try:
            status_core = status_core.where(Device.tenant_id == UUID(str(tenant_id)))
        except ValueError:
            pass

    status_result = await session.execute(status_core)
    all_statuses = [row.effective_status for row in status_result.all()]

    total_devices = len(all_statuses)
    devices_up = sum(1 for s in all_statuses if s == "up")
    devices_down = sum(1 for s in all_statuses if s == "down")
    devices_unknown = total_devices - devices_up - devices_down

    uptime_percentage = round((devices_up / total_devices * 100) if total_devices > 0 else 100.0, 2)
    return total_devices, devices_up, devices_down, devices_unknown, uptime_percentage

async def run():
    async with AsyncSessionLocal() as session:
        users = (await session.execute(select(User))).scalars().all()
        for u in users:
            is_super = u.role in ["superadmin", "super_admin"]
            tot, up, down, unk, upt = await test_dashboard_for_tenant(session, u.tenant_id, is_super, u.role)
            print(f"User: {u.email} | Tenant: {u.tenant_id} | Role: {u.role}")
            print(f"  -> Total Devices: {tot} | Up: {up} | Down: {down} | Unknown: {unk} | Uptime: {upt}%")

if __name__ == "__main__":
    asyncio.run(run())

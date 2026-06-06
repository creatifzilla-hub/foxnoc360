import asyncio
from datetime import datetime, timezone, timedelta
from app.database import AsyncSessionLocal
from app.models.device import Device
from app.models.ping_log import PingLog
from app.models.tenant import Tenant
from app.models.user import User
from sqlalchemy import select, func

async def debug():
    async with AsyncSessionLocal() as session:
        # Check users and tenants
        users = (await session.execute(select(User))).scalars().all()
        print("=== USERS ===")
        for u in users:
            print(f"User: {u.email} | Role: {u.role} | Tenant ID: {u.tenant_id}")
        
        tenants = (await session.execute(select(Tenant))).scalars().all()
        print("\n=== TENANTS ===")
        for t in tenants:
            print(f"Tenant: {t.name} | ID: {t.id}")

        devices = (await session.execute(select(Device))).scalars().all()
        print("\n=== DEVICES ===")
        for d in devices:
            print(f"Device: {d.name} | IP: {d.ip_address} | Status: {d.status} | Tenant ID: {d.tenant_id}")

        # Let's run the exact query from get_dashboard
        # We'll run it as superadmin (is_super = True) and see what it does
        period = 7
        now_naive = datetime.now()
        now_utc = datetime.now(timezone.utc)
        print(f"\nNaive now: {now_naive} | UTC now: {now_utc}")
        
        for name, now in [("naive", now_naive), ("utc", now_utc)]:
            start_date = now - timedelta(days=period)
            
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
            
            res = await session.execute(status_core)
            statuses = [row.effective_status for row in res.all()]
            print(f"Using {name} start_date ({start_date}): {statuses}")

if __name__ == "__main__":
    asyncio.run(debug())

import asyncio
from app.database import AsyncSessionLocal
from app.models.device import Device
from app.models.ping_log import PingLog
from app.models.tenant import Tenant
from app.models.user import User
from sqlalchemy import select, func

async def run():
    async with AsyncSessionLocal() as session:
        # Total counts
        device_count = (await session.execute(select(func.count(Device.id)))).scalar()
        user_count = (await session.execute(select(func.count(User.id)))).scalar()
        tenant_count = (await session.execute(select(func.count(Tenant.id)))).scalar()
        ping_log_count = (await session.execute(select(func.count(PingLog.id)))).scalar()

        print(f"Device count: {device_count}")
        print(f"User count: {user_count}")
        print(f"Tenant count: {tenant_count}")
        print(f"PingLog count: {ping_log_count}")

        # List all devices
        print("\n--- ALL DEVICES ---")
        devices = (await session.execute(select(Device))).scalars().all()
        for d in devices:
            print(f"ID: {d.id} | Name: {d.name} | IP: {d.ip_address} | Status: {d.status} | Tenant ID: {d.tenant_id}")

        # List latest 10 ping logs
        print("\n--- LATEST 10 PING LOGS ---")
        ping_logs = (await session.execute(select(PingLog).order_by(PingLog.checked_at.desc()).limit(10))).scalars().all()
        for p in ping_logs:
            print(f"Device ID: {p.device_id} | Status: {p.status} | Latency: {p.latency_ms} | Loss: {p.packet_loss} | Checked At: {p.checked_at}")

if __name__ == "__main__":
    asyncio.run(run())

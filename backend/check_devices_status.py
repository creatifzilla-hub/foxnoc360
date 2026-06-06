import asyncio
from datetime import datetime, timezone

from app.database import AsyncSessionLocal
from app.models.device import Device
from sqlalchemy import select

TARGET_IPS = ["03.173.93.75", "103.173.93.137"]

async def check_devices():
    async with AsyncSessionLocal() as session:
        stmt = select(Device).where(Device.ip_address.in_(TARGET_IPS))
        devices = (await session.execute(stmt)).scalars().all()
        if not devices:
            print("No devices found for the given IPs.")
            return
        for dev in devices:
            print(f"Device: {dev.name} | IP: {dev.ip_address} | DB status: {dev.status}")

if __name__ == "__main__":
    asyncio.run(check_devices())

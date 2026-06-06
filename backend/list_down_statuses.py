import asyncio
from datetime import datetime, timedelta, timezone

from app.database import AsyncSessionLocal
from app.models.ping_log import PingLog
from app.models.device import Device
from sqlalchemy import select, desc

async def list_recent_down(minutes: int = 30):
    async with AsyncSessionLocal() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        stmt = select(PingLog).where(
            PingLog.checked_at >= cutoff,
            PingLog.status == "down"
        ).order_by(desc(PingLog.checked_at))
        logs = (await session.execute(stmt)).scalars().all()
        print(f"Found {len(logs)} down logs in last {minutes} minutes")
        for log in logs:
            dev = await session.get(Device, log.device_id)
            print(f"{log.checked_at.isoformat()} - Device {dev.name} ({dev.ip_address}) status={log.status} (device.status={dev.status})")

if __name__ == "__main__":
    asyncio.run(list_recent_down())

import asyncio
from datetime import datetime, timedelta, timezone

from app.database import AsyncSessionLocal
from app.models.device import Device
from app.models.ping_log import PingLog
from sqlalchemy import select, desc

async def check_statuses(minutes: int = 10):
    async with AsyncSessionLocal() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        # Get recent ping logs
        ping_stmt = select(PingLog).where(PingLog.checked_at >= cutoff).order_by(desc(PingLog.checked_at))
        ping_logs = (await session.execute(ping_stmt)).scalars().all()
        print(f"Recent ping logs (last {minutes} min): {len(ping_logs)} entries")
        for log in ping_logs[:20]:  # limit output
            # fetch device
            dev = await session.get(Device, log.device_id)
            print(f"[{log.checked_at.isoformat()}] Device {dev.name} ({dev.ip_address}) ping status={log.status}, latency={log.latency_ms}, loss={log.packet_loss} | device.status={dev.status}")

if __name__ == "__main__":
    asyncio.run(check_statuses())

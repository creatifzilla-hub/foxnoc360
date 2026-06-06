import asyncio
from app.database import AsyncSessionLocal
from app.models.device import Device
from sqlalchemy import select

async def run():
    async with AsyncSessionLocal() as session:
        # Search for any device with 03.173.93.75 or similar
        stmt = select(Device)
        res = await session.execute(stmt)
        devices = res.scalars().all()
        print(f"Total devices in DB: {len(devices)}")
        for d in devices:
            print(f"ID: {d.id} | Name: {d.name} | IP: {d.ip_address} | Tenant: {d.tenant_id}")
            if "03.173" in d.ip_address or "93.75" in d.ip_address or "75" in d.ip_address:
                print("  --> MATCH FOUND!")

if __name__ == "__main__":
    asyncio.run(run())

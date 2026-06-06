import asyncio
from app.database import engine, Base
from app.models import tenant, user, customer, device, device_interface, ping_log, downtime, snmp_log, subscription, payment, sales, user_permission

async def create_tables():
    async with engine.begin() as conn:
        print("Creating missing tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Done.")

if __name__ == "__main__":
    asyncio.run(create_tables())

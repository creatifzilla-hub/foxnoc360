import asyncio
from app.database import engine, Base
from app.models import tenant, user, customer, device, ping_log, downtime, snmp_log, subscription, payment

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables initialized.")

if __name__ == "__main__":
    asyncio.run(init_db())

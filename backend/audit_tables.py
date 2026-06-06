import asyncio
from app.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        for table in ["tenant_subscriptions", "subscription_plans", "user_permissions"]:
            try:
                await conn.execute(text(f"SELECT 1 FROM {table} LIMIT 1"))
                print(f"Table {table}: EXISTS")
            except Exception as e:
                print(f"Table {table}: MISSING: {e}")

if __name__ == "__main__":
    asyncio.run(check())

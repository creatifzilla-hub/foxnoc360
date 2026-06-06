import asyncio
from app.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        res = await conn.execute(text('SELECT id, name, price_per_month FROM subscription_plans'))
        print(res.fetchall())

if __name__ == "__main__":
    asyncio.run(check())

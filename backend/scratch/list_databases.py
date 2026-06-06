import asyncio
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def run():
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("SELECT datname FROM pg_database;"))
        print("Databases:", [row[0] for row in res.all()])

if __name__ == "__main__":
    asyncio.run(run())

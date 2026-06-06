import asyncio
from app.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        try:
            result = await conn.execute(text("SELECT 1 FROM user_permissions LIMIT 1"))
            print("Table EXISTS")
        except Exception as e:
            print(f"Table MISSING or error: {e}")

if __name__ == "__main__":
    asyncio.run(check())

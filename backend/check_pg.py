import asyncio
from app.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        try:
            result = await conn.execute(text("SELECT pid, query, state, wait_event_type, wait_event FROM pg_stat_activity WHERE state != 'idle'"))
            for row in result:
                print(f"PID: {row[0]} | Query: {row[1]} | State: {row[2]} | Wait: {row[3]}:{row[4]}")
        except Exception as e:
            print(f"Error checking PG stats: {e}")

if __name__ == "__main__":
    asyncio.run(check())

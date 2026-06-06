import asyncio
from app.database import engine
from sqlalchemy import text

async def check():
    try:
        async with engine.connect() as conn:
            # Check checkedout connections
            checked_out = engine.pool.checkedout()
            size = engine.pool.size()
            overflow = engine.pool.overflow()
            print(f"DEBUG: Pool Stats -> CheckedOut: {checked_out} | Size: {size} | Overflow: {overflow}")
            
            # Check DB health
            res = await conn.execute(text("SELECT 1"))
            print(f"DEBUG: DB Health -> {res.scalar()}")
    except Exception as e:
        print(f"ERROR: DB check failed: {e}")

if __name__ == "__main__":
    asyncio.run(check())

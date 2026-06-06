import asyncio
from app.database import engine
from sqlalchemy import text

async def check():
    async with engine.connect() as conn:
        try:
            # Query for active locks
            result = await conn.execute(text("""
                SELECT
                    blocked_locks.pid     AS blocked_pid,
                    blocked_activity.query  AS blocked_query,
                    blocking_locks.pid     AS blocking_pid,
                    blocking_activity.query AS blocking_query
                FROM pg_catalog.pg_locks         blocked_locks
                JOIN pg_catalog.pg_stat_activity blocked_activity  ON blocked_activity.pid = blocked_locks.pid
                JOIN pg_catalog.pg_locks         blocking_locks    ON blocking_locks.locktype = blocked_locks.locktype
                    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
                    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
                    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
                    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
                    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
                    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
                    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
                    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
                    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
                    AND blocking_locks.pid != blocked_locks.pid
                JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
                WHERE NOT blocked_locks.GRANTED;
            """))
            for row in result:
                print(f"BLOCKED PID: {row[0]} is waiting for BLOCKING PID: {row[2]}")
                print(f"Blocked Query: {row[1]}")
                print(f"Blocking Query: {row[3]}")
                print("-" * 20)
            print("Finished checking locks.")
        except Exception as e:
            print(f"Error checking PG locks: {e}")

if __name__ == "__main__":
    asyncio.run(check())

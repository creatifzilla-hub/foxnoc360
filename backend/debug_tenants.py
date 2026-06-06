import asyncio
import os
import sys
sys.path.append(os.getcwd())
from app.database import AsyncSessionLocal
from sqlalchemy.future import select
from app.models.tenant import Tenant

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tenant))
        tenants = result.scalars().all()
        print(f"FOUND_TENANTS:{[t.name for t in tenants]}")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.tenant import Tenant

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Tenant))
        tenants = result.scalars().all()
        print(f"Found {len(tenants)} tenants")
        for tenant in tenants:
            print(f"Attempting to delete {tenant.id} ({tenant.name})...")
            try:
                await db.delete(tenant)
                await db.commit()
                print(" -> Success.")
            except Exception as e:
                await db.rollback()
                print(f" -> Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())

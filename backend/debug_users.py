import asyncio
import os
import sys
sys.path.append(os.getcwd())
from app.database import AsyncSessionLocal
from sqlalchemy.future import select
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"FOUND_USERS:{[(u.email, str(u.tenant_id), u.role) for u in users]}")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User
from app.models.tenant import Tenant

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == 'superadmin'))
        user = result.scalars().first()
        if user:
            print(f"Superadmin Email: {user.email}")
            print(f"Superadmin Hash: {user.password_hash}")
        else:
            print("No superadmin found")

if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import os
import sys

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def check_users():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User.email, User.role))
        users = result.all()
        print("-" * 40)
        print(f"{'Email':<30} | {'Role':<15}")
        print("-" * 40)
        for user in users:
            print(f"{user.email:<30} | {user.role:<15}")
        print("-" * 40)

if __name__ == "__main__":
    asyncio.run(check_users())

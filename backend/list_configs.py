import asyncio
import os
import sys

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def check_configs():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print("-" * 100)
        print(f"{'Email':<30} | {'Role':<15} | {'EmailAlerts':<11} | {'WA_Alerts':<10} | {'Phone':<15}")
        print("-" * 100)
        for u in users:
            print(f"{u.email:<30} | {u.role:<15} | {str(u.email_alerts):<11} | {str(u.whatsapp_alerts):<10} | {str(u.phone_number):<15}")
        print("-" * 100)

if __name__ == "__main__":
    asyncio.run(check_configs())

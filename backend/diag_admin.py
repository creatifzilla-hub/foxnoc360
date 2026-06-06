import asyncio
import os
import sys

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def diag_user():
    email = "admin@foxnoc360.com" # Check superadmin too
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email.ilike(email)))
        u = result.scalars().first()
        if u:
            print("-" * 60)
            print(f"User Profile Found: {u.email}")
            print(f"Role:         {u.role}")
            print(f"Phone:        {u.phone_number}")
            print(f"Email Alerts: {u.email_alerts}")
            print(f"WA Alerts:    {u.whatsapp_alerts}")
            print("-" * 60)
        else:
            print(f"User '{email}' NOT FOUND.")

if __name__ == "__main__":
    asyncio.run(diag_user())

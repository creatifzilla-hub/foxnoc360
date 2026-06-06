import asyncio
import os
import sys

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def update_phone():
    email = "CreatifZilla@gmail.com"
    phone = "+919958335333"
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email.ilike(email)))
        u = result.scalars().first()
        if u:
            print(f"Setting phone to {phone} for {u.email}...")
            u.phone_number = phone
            await session.commit()
            print("✅ Done.")
        else:
            print("User NOT found.")

if __name__ == "__main__":
    asyncio.run(update_phone())

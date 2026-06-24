import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def main():
    async with AsyncSessionLocal() as db:
        query = select(User).limit(1)
        res = await db.execute(query)
        user = res.scalars().first()
        if user:
            try:
                print(user.permissions)
            except Exception as e:
                print("Error accessing permissions:", type(e), str(e))

asyncio.run(main())

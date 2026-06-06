import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.user import User
from app.models.tenant import Tenant
from app.services.auth import create_access_token

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalars().first()
        if user:
            token = create_access_token(
                data={"sub": str(user.id), "email": user.email, "role": user.role, "tenant_id": str(user.tenant_id)}
            )
            print(token)

if __name__ == "__main__":
    asyncio.run(main())

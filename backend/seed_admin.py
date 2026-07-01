import asyncio
import uuid
import bcrypt
from datetime import datetime, timezone
from app.database import AsyncSessionLocal
from app.models.tenant import Tenant
from app.models.user import User

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

async def seed():
    async with AsyncSessionLocal() as db:
        tenant = Tenant(
            id=uuid.uuid4(),
            name="System Root",
            company_email="admin@foxnoc360.com",
            status="active",
            created_at=datetime.now(timezone.utc)
        )
        db.add(tenant)
        await db.flush()

        user = User(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            email="admin@foxnoc360.com",
            password_hash=hash_password("Admin@123"),
            role="superadmin",
            status="active",
            created_at=datetime.now(timezone.utc)
        )
        db.add(user)
        await db.commit()
        print("=============================")
        print("Superadmin created!")
        print("Email:    admin@foxnoc360.com")
        print("Password: Admin@123")
        print("=============================")

asyncio.run(seed())

import asyncio
import os
import sys
from passlib.context import CryptContext

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def reset_superadmin():
    async with AsyncSessionLocal() as session:
        # Check for existing superadmin
        result = await session.execute(
            select(User).where(User.email == "admin@isp-monitor.local")
        )
        superadmin = result.scalars().first()
        
        pw_hash = pwd_context.hash("admin123")
        
        if superadmin:
            print("👤 Existing superadmin found. Resetting password/role...")
            superadmin.role = "superadmin"
            superadmin.password_hash = pw_hash
            superadmin.status = "active"
        else:
            print("🆕 Creating new superadmin...")
            import uuid
            superadmin = User(
                id=uuid.uuid4(),
                tenant_id=uuid.uuid4(), # Dummy tenant for platform
                email="admin@isp-monitor.local",
                password_hash=pw_hash,
                role="superadmin",
                status="active"
            )
            session.add(superadmin)
            
        await session.commit()
        print("✅ Superadmin reset to: admin@isp-monitor.local / admin123 (Role: superadmin)")

if __name__ == "__main__":
    asyncio.run(reset_superadmin())

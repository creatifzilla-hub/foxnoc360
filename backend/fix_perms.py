import asyncio
from uuid import UUID
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.user_permission import UserPermission

async def fix():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        print(f"Auditing {len(users)} users...")
        
        for u in users:
            p_res = await db.execute(select(UserPermission).where(UserPermission.user_id == u.id))
            perms = p_res.scalars().first()
            if not perms:
                print(f"Provisioning missing permissions for: {u.email} ({u.role})")
                allowed = ["dashboard", "sales", "customers", "devices", "sla"]
                new_p = UserPermission(
                    user_id=u.id,
                    allowed_modules=allowed,
                    assigned_leads_only=False
                )
                db.add(new_p)
        
        await db.commit()
    print("Done fixes.")

if __name__ == "__main__":
    asyncio.run(fix())

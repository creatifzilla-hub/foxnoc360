import asyncio
from app.database import AsyncSessionLocal
from app.models.device import Device
from app.models.tenant import Tenant
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        # Get all devices
        res = await db.execute(select(Device))
        devices = res.scalars().all()
        print("=== DEVICES ===")
        for d in devices:
            print(f"ID: {d.id} | Name: {d.name} | IP: {d.ip_address} | TenantID: {d.tenant_id} | CustomerID: {d.customer_id}")
            
        # Get all tenants
        res = await db.execute(select(Tenant))
        tenants = res.scalars().all()
        print("\n=== TENANTS ===")
        for t in tenants:
            print(f"ID: {t.id} | Name: {t.name}")

        # Get all users
        res = await db.execute(select(User))
        users = res.scalars().all()
        print("\n=== USERS ===")
        for u in users:
            print(f"ID: {u.id} | Email: {u.email} | TenantID: {u.tenant_id} | Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(main())

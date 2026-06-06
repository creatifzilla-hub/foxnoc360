import asyncio
from app.database import AsyncSessionLocal
from app.models.device import Device
from app.models.customer import Customer
from app.models.tenant import Tenant
from app.models.user import User
from sqlalchemy import select, func

async def run():
    async with AsyncSessionLocal() as session:
        # Customers
        customers = (await session.execute(select(Customer))).scalars().all()
        print("=== CUSTOMERS ===")
        for c in customers:
            # Count devices for this customer
            dev_count = (await session.execute(select(func.count(Device.id)).where(Device.customer_id == c.id))).scalar()
            print(f"Customer: {c.name} | ID: {c.id} | Tenant ID: {c.tenant_id} | Device Count: {dev_count}")

        print("\n=== USERS AND CUSTOMER SHARING ===")
        users = (await session.execute(select(User))).scalars().all()
        for u in users:
            print(f"User: {u.email} | Role: {u.role} | Tenant ID: {u.tenant_id}")

if __name__ == "__main__":
    asyncio.run(run())

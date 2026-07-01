import asyncio
import uuid
from datetime import datetime, timezone
from app.database import AsyncSessionLocal
from app.models.subscription import SubscriptionPlan

async def seed():
    async with AsyncSessionLocal() as db:
        plans = [
            SubscriptionPlan(
                id=uuid.uuid4(),
                name="Starter",
                max_devices=25,
                max_customers=10,
                max_users=3,
                snmp_enabled=False,
                sla_reports=False,
                price_per_month=999.0,
                created_at=datetime.now(timezone.utc)
            ),
            SubscriptionPlan(
                id=uuid.uuid4(),
                name="Professional",
                max_devices=100,
                max_customers=50,
                max_users=10,
                snmp_enabled=True,
                sla_reports=True,
                price_per_month=2999.0,
                created_at=datetime.now(timezone.utc)
            ),
            SubscriptionPlan(
                id=uuid.uuid4(),
                name="Enterprise",
                max_devices=500,
                max_customers=200,
                max_users=50,
                snmp_enabled=True,
                sla_reports=True,
                price_per_month=7999.0,
                created_at=datetime.now(timezone.utc)
            ),
        ]
        for plan in plans:
            db.add(plan)
        await db.commit()
        print("=============================")
        print("Subscription plans created!")
        print(" - Starter:      ₹999/mo")
        print(" - Professional: ₹2999/mo")
        print(" - Enterprise:   ₹7999/mo")
        print("=============================")

asyncio.run(seed())

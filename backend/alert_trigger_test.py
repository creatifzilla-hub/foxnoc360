import asyncio
import os
import sys
from datetime import datetime
from uuid import UUID

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.alert_service import send_device_alert
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def run_manual_test():
    """
    Manually triggers a test alert for the first 'isp_admin' found in the database.
    This verifies that your SMTP and Twilio credentials in .env are correctly configured.
    """
    print("🚦 Starting manual alert test...")

    async with AsyncSessionLocal() as session:
        # 1. Find a valid tenant and admin to test with
        result = await session.execute(select(User).where(User.role == "isp_admin").limit(1))
        admin = result.scalars().first()
        
        if not admin:
            print("❌ No 'isp_admin' users found in the database. Please create a tenant/user first.")
            return

        print(f"📡 Testing with Admin: {admin.email} (Tenant: {admin.tenant_id})")
        print(f"📫 Email Alerts Enabled: {admin.email_alerts}")
        print(f"📱 WhatsApp Alerts Enabled: {admin.whatsapp_alerts} (Phone: {admin.phone_number or 'Not Set'})")

        # 2. Trigger the alert
        try:
            await send_device_alert(
                session,
                admin.tenant_id,
                "TEST-DEVICE-01",
                "Testing Customer",
                "10.255.255.1",
                "down",
                datetime.now()
            )
            print("\n✅ Test alert dispatch successfully triggered.")
            print("Check your Email and WhatsApp for the notification.")
        except Exception as e:
            print(f"\n❌ Error during alert dispatch: {str(e)}")

if __name__ == "__main__":
    asyncio.run(run_manual_test())

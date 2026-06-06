import asyncio
import os
import sys
from datetime import datetime

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.email_service import send_email_alert
from sqlalchemy.future import select

async def broadcast_test_email():
    """
    Sends a test email to every user with the 'isp_admin' role.
    """
    async with AsyncSessionLocal() as session:
        print("📢 Starting Platform-Wide Broadcast Test...")
        
        # 1. Fetch all active ISP Admins
        result = await session.execute(
            select(User).where(User.role == "isp_admin", User.status == "active")
        )
        admins = result.scalars().all()
        
        if not admins:
            print("⚠️ No active ISP Admins found.")
            return

        print(f"🌖 Found {len(admins)} administrators. Dispatched test emails...")
        
        subject = "🔔 PLATFORM NOTIFICATION: System Alert Test"
        message = f"""
Hello,

This is a platform-wide test of the FoxNOC360 Monitoring Alert System.

🔍 Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
🚀 Purpose: Verifying SMTP connectivity for all registered ISPs.

If you received this email, your notification channel is correctly configured.

Best regards,
FoxNOC360 Platform Team
"""
        
        tasks = []
        for admin in admins:
            if admin.email_alerts:
                print(f"📨 Queueing email for: {admin.email}")
                tasks.append(send_email_alert(subject, message, admin.email))
            else:
                print(f"⏩ Skipping {admin.email} (Email alerts disabled in profile)")

        if tasks:
            await asyncio.gather(*tasks)
            print(f"✅ Successfully dispatched {len(tasks)} test emails.")
        else:
            print("❌ No recipients were eligible for email alerts.")

if __name__ == "__main__":
    asyncio.run(broadcast_test_email())

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

async def live_test():
    """
    Manually triggers an alert for a specific tenant.
    We will see the logs to determine who it tried to notify.
    """
    tenant_id = UUID("798756a4-9b2f-467e-8430-6dd13762d63c") # CreatifZilla's tenant
    
    async with AsyncSessionLocal() as session:
        print(f"🎬 Starting LIVE ALERT TEST for Tenant {tenant_id}...")
        
        # Trigger the alert
        await send_device_alert(
            session,
            tenant_id,
            "MANUAL-TEST-DEVICE",
            "Test Customer",
            "127.0.0.1",
            "down",
            datetime.now()
        )
        print("🏁 Live test finished.")

if __name__ == "__main__":
    asyncio.run(live_test())

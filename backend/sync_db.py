import asyncio
import os
import sys
from sqlalchemy import text

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal

async def sync_schema():
    async with AsyncSessionLocal() as session:
        print("🛠️ Syncing database schema for new features...")
        try:
            # Users table new columns
            print("- Updating 'users' table...")
            await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);"))
            await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(50);"))
            await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500);"))
            await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts BOOLEAN DEFAULT TRUE;"))
            await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_alerts BOOLEAN DEFAULT TRUE;"))
            
            # Tenants table new columns
            print("- Updating 'tenants' table...")
            await session.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS alternate_email VARCHAR(255);"))
            await session.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_website VARCHAR(255);"))
            await session.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50);"))
            
            await session.commit()
            print("✅ Database schema synchronized successfully.")
        except Exception as e:
            print(f"❌ Error during sync: {str(e)}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(sync_schema())

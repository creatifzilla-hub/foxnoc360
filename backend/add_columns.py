import asyncio
import os
import sys
from sqlalchemy import text

# Adjust path to import from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal

async def add_notification_columns():
    async with AsyncSessionLocal() as session:
        print("🛠️ Adding notification columns to 'users' table...")
        try:
            # PostgreSQL syntax to add columns if they don't exist
            await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts BOOLEAN DEFAULT TRUE;"))
            await session.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_alerts BOOLEAN DEFAULT TRUE;"))
            await session.commit()
            print("✅ Database schema updated successfully.")
        except Exception as e:
            print(f"❌ Error updating database: {str(e)}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(add_notification_columns())

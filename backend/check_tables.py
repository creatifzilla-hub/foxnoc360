import asyncio
from app.database import engine
from sqlalchemy import text
from app.models.sales import Lead, LeadActivity

async def check_and_create():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'leads')"))
        exists = res.scalar()
        print(f"Leads table exists: {exists}")
        if not exists:
            print("Creating tables...")
            await conn.run_sync(Lead.metadata.create_all)
            print("Tables created.")

if __name__ == "__main__":
    asyncio.run(check_and_create())

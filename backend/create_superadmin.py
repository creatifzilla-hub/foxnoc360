import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from sqlalchemy import text
import bcrypt
import uuid
import datetime

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

async def main():
    async with AsyncSessionLocal() as session:
        email = "admin@foxnoc360.com"
        password = "Admin_Password_123!"
        hashed_pw = hash_password(password)
        uid = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc)
        
        res = await session.execute(text(f"SELECT id FROM users WHERE email = '{email}'"))
        if res.scalars().first():
            print("Superadmin already exists.")
            return

        tenant_id = str(uuid.uuid4())
        tenant_query = text("""
            INSERT INTO tenants (id, name, company_email, status, created_at)
            VALUES (:id, :name, :company_email, :status, :created_at)
        """)
        await session.execute(tenant_query, {
            "id": tenant_id,
            "name": "System Root",
            "company_email": "root@foxnoc360.com",
            "status": "active",
            "created_at": now
        })

        # Insert superadmin
        query = text("""
            INSERT INTO users (id, tenant_id, email, password_hash, role, status, created_at) 
            VALUES (:id, :tenant_id, :email, :password_hash, :role, :status, :created_at)
        """)
        await session.execute(query, {
            "id": uid,
            "tenant_id": tenant_id,
            "email": email,
            "password_hash": hashed_pw,
            "role": "superadmin",
            "status": "active",
            "created_at": now
        })
        await session.commit()
        print(f"Created superadmin: {email} / {password}")

if __name__ == "__main__":
    asyncio.run(main())

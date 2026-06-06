import asyncio
import bcrypt
from sqlalchemy import text
from app.database import engine

async def reset_admin():
    password = "admin123"
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET password_hash = :hash WHERE email = :email"),
            {"hash": hashed, "email": "admin@foxnoc360.com"}
        )
    print("Superadmin password reset to: admin123")

if __name__ == "__main__":
    asyncio.run(reset_admin())

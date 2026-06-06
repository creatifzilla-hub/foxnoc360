import asyncio
import json
import httpx
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.user import User

# IMPORTANT: we need to manually create the valid JWT based on backend logic
from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings

def create_valid_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def test_api():
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).limit(1))
        user = user_res.scalars().first()
        token = create_valid_token({"sub": user.email, "user_id": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role})

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "name": "Another Test Lead",
        "phone": "9998887776",
        "location": "Some City",
        "status": "new",
        "follow_up_at": "2026-04-21T15:25:00.000Z"
    }
    
    print("\n--- Sending request to POST /api/v1/sales/leads ---")
    
    async with httpx.AsyncClient() as client:
        res = await client.post("http://127.0.0.1:8000/api/v1/sales/leads", json=payload, headers=headers)
        
    print(f"\nStatus Code: {res.status_code}")
    print(f"Response Body: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_api())

import asyncio
import json
import httpx
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth import create_access_token

async def test_api():
    # 1. Get a token purely for testing
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).limit(1))
        user = user_res.scalars().first()
        token = create_access_token({"sub": user.email, "user_id": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role})

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 2. Simulate the Frontend Payload exactly as it stringifies
    payload = {
        "name": "Another Test Lead",
        "phone": "9998887776",
        "location": "Some City",
        "status": "new",
        "follow_up_at": "2026-04-21T15:25:00.000Z"
    }
    
    print("\n--- Sending request to POST /api/v1/sales/leads ---")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    async with httpx.AsyncClient() as client:
        res = await client.post("http://127.0.0.1:8000/api/v1/sales/leads", json=payload, headers=headers)
        
    print(f"\nStatus Code: {res.status_code}")
    print(f"Response Body: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_api())

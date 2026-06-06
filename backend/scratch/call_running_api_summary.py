import jwt
import urllib.request
import json
from datetime import datetime, timezone, timedelta
from app.config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM

users_to_test = [
    {"email": "admin@foxnoc360.com", "role": "superadmin", "tenant_id": "d7920374-2dda-424d-96bc-9a0653c80cb2"},
    {"email": "creatifzilla@gmail.com", "role": "isp_admin", "tenant_id": "2ad343bf-65e8-4af6-be4c-1be64d65750c"},
    {"email": "Shyamdata1@gmail.com", "role": "isp_admin", "tenant_id": "cd51d4ab-bfba-4dbc-a85d-f04fa1c0777a"},
    {"email": "shivanshisharmasps@gmail.com", "role": "isp_admin", "tenant_id": "3cff6bfd-868c-4eff-9e27-a7e1281118e8"},
]

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=60)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

for user in users_to_test:
    payload = {
        "sub": user["email"],
        "role": user["role"],
        "tenant_id": user["tenant_id"]
    }
    token = create_access_token(payload)
    print(f"\n=== User: {user['email']} ===")
    
    # Call dashboard
    req = urllib.request.Request(
        "http://localhost:8000/api/v1/monitoring/dashboard?period=7",
        headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            print(f"  Dashboard summary: Total={res_data['total_devices']}, Up={res_data['devices_up']}, Down={res_data['devices_down']}, Unknown={res_data['devices_unknown']}, Uptime={res_data['uptime_percentage']}%")
    except Exception as e:
        print("  Dashboard Error:", e)

    # Call devices-table
    req_table = urllib.request.Request(
        "http://localhost:8000/api/v1/monitoring/devices-table",
        headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req_table) as response:
            res_data = json.loads(response.read().decode())
            print(f"  Devices table: {len(res_data)} devices")
            for d in res_data:
                print(f"    - {d['device_name']} ({d['ip_address']}): Status={d['latest_status']}")
    except Exception as e:
        print("  Devices Table Error:", e)

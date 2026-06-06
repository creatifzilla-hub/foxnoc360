import requests
import json

API_BASE = "http://localhost:8000/api/v1"

def test_login(email, password):
    url = f"{API_BASE}/auth/login"
    data = {
        "username": email,
        "password": password
    }
    print(f"POSTing to {url} with {data}")
    try:
        res = requests.post(url, data=data, timeout=5)
        print(f"Status: {res.status_code}")
        print(f"Headers: {res.headers}")
        print(f"Body: {res.text}")
    except requests.exceptions.Timeout:
        print("Error: TIMEOUT after 5 seconds!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login("admin@foxnoc360.com", "Admin_Password_123!")

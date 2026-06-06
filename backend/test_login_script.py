import requests

API_BASE = "http://localhost:8000/api/v1"

def test_login(email, password):
    url = f"{API_BASE}/auth/login"
    data = {
        "username": email,
        "password": password
    }
    try:
        res = requests.post(url, data=data)
        print(f"Status: {res.status_code}")
        print(f"Body: {res.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test with standard superadmin
    print("Testing Superadmin Login:")
    test_login("admin@foxnoc360.com", "Admin_Password_123!")

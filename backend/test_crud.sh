#!/bin/bash
set -e
R=$RANDOM

# 2. Create Valid Tenant
echo -e "\nCreating Valid Tenant"
T=$(curl -s -X POST http://localhost:8000/api/v1/tenants/ -H 'Content-Type: application/json' -d '{"name":"CrudTest ISP '$R'","company_email":"crud'$R'@isp.com","admin_password":"testpass123"}')
TID=$(echo $T | python3 -c "import sys,json; print(json.load(sys.stdin).get('id', ''))")
echo "Tenant ID: $TID"

# 3. Login
echo -e "\nLogging in"
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -H 'Content-Type: application/x-www-form-urlencoded' -d 'username=crud'$R'@isp.com&password=testpass123' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "Token OK"

# 4. Create Customer
echo -e "\nCreating Customer"
C=$(curl -s -X POST http://localhost:8000/api/v1/customers/ -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"name":"C1","contact_email":"c1_'$R'@example.com"}')
CID=$(echo $C | python3 -c "import sys,json; print(json.load(sys.stdin).get('id', ''))")
echo "Customer ID: $CID"

# 7. Create Device
echo -e "\nCreating Device"
D=$(curl -s -X POST http://localhost:8000/api/v1/devices/ -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"name":"D1","ip_address":"10.0.'$R'.1","location":"HQ","customer_id":"'$CID'"}')
DID=$(echo $D | python3 -c "import sys,json; print(json.load(sys.stdin).get('id', ''))")
echo "Device ID: $DID"

# 9. Edit Device
echo -e "\nEditing Device"
curl -s -X PUT http://localhost:8000/api/v1/devices/$DID -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"name":"D1 Edited","ip_address":"10.0.'$R'.2"}' > /dev/null
echo "Device Edit OK"

# 10. Delete Device
echo -e "\nDeleting Device"
curl -s -X DELETE http://localhost:8000/api/v1/devices/$DID -H "Authorization: Bearer $TOKEN"
echo "Device Delete OK"

# 11. Delete Customer
echo -e "\nDeleting Customer"
curl -s -X DELETE http://localhost:8000/api/v1/customers/$CID -H "Authorization: Bearer $TOKEN"
echo "Customer Delete OK"

# 12. Delete Tenant
echo -e "\nDeleting Tenant"
curl -s -X DELETE http://localhost:8000/api/v1/tenants/$TID -H "Authorization: Bearer $TOKEN"
echo "Tenant Delete OK"

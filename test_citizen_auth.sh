#!/bin/bash

# Configuration
API_URL="http://localhost:8081"
RANDOM_VAL=$RANDOM
EMAIL="test.citizen.${RANDOM_VAL}@example.com"
PASSWORD="Password123!"
NAME="Test Citizen"

echo "=== Citizen Auth Flow Test ==="
echo "Target: ${API_URL}"
echo "User: ${EMAIL}"

# 1. Register
echo -e "\n1. Registering new citizen..."
REGISTER_RES=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"name\": \"${NAME}\",
    \"userType\": \"citizen\"
  }")

echo "${REGISTER_RES}" | jq .

# Check if registration was successful
SUCCESS=$(echo "${REGISTER_RES}" | jq -r '.success')
if [ "${SUCCESS}" != "true" ]; then
    echo "Registration failed!"
    exit 1
fi

# 2. Login
echo -e "\n2. Logging in..."
LOGIN_RES=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\"
  }")

echo "${LOGIN_RES}" | jq .

# Check if login was successful
SUCCESS=$(echo "${LOGIN_RES}" | jq -r '.success')
if [ "${SUCCESS}" != "true" ]; then
    echo "Login failed!"
    exit 1
fi

TOKEN=$(echo "${LOGIN_RES}" | jq -r '.token')
echo -e "\n3. Testing protected route (profile/preferences) with token..."
PREF_RES=$(curl -s -X POST "${API_URL}/api/v1/profile/preferences" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "categories": ["museum", "park"],
    "interests": ["history", "nature"]
  }')

echo "${PREF_RES}" | jq .

echo -e "\n=== Test Finished ==="

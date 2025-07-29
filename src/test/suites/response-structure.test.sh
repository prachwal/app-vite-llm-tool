#!/bin/bash

# Test GET_META endpoint structure
API_URL="http://localhost:8000/.netlify/functions/blobs"
KEY="meta-structure-test-$(date +%s)"

echo "🔍 GET_META Structure Test"
echo "==========================="

# Create blob with metadata
META='{"author":"test","type":"demo","version":1}'
ENCODED=$(printf '%s' "$META" | jq -sRr @uri)

echo "Creating blob with metadata..."
curl -s -X POST "$API_URL?action=POST&key=$KEY&metadata=$ENCODED" \
  -H "Content-Type: application/json" \
  -d '{"message":"Test data"}' | jq '.'

echo -e "\n📋 METADATA endpoint response:"
curl -s "$API_URL?action=METADATA&key=$KEY" | jq '.'

echo -e "\n📋 GET_META endpoint response:"
curl -s "$API_URL?action=GET_META&key=$KEY" | jq '.'

echo -e "\n🗑️ Cleaning up..."
curl -s -X DELETE "$API_URL?action=DELETE&key=$KEY" > /dev/null
echo "Done"

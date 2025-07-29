#!/bin/bash

# ===================================================================
# Netlify Blobs API - Quick Demo
# ===================================================================
# Simple demonstration of basic API usage
# ===================================================================

API_URL="http://localhost:8000/.netlify/functions/blobs"

echo "🚀 Netlify Blobs API Quick Demo"
echo "================================"

# 1. Check available stores
echo "📋 Available stores:"
curl -s "$API_URL?action=GET_STORES" | jq '.payload'

# 2. Create a simple document
echo -e "\n📝 Creating document..."
RESPONSE=$(curl -s -X POST "$API_URL?action=POST&key=demo-doc" \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo Document","content":"This is a test document","created":"'$(date -Iseconds)'"}')
echo "$RESPONSE" | jq '.'

# 2b. Create document with metadata
echo -e "\n📝 Creating document with metadata..."
META='{"author":"demo-user","category":"test","priority":1}'
ENCODED_META=$(printf '%s' "$META" | jq -sRr @uri)
RESPONSE_META=$(curl -s -X POST "$API_URL?action=POST&key=demo-with-meta&metadata=$ENCODED_META" \
  -H "Content-Type: application/json" \
  -d '{"message":"Document with metadata"}')
echo "$RESPONSE_META" | jq '.'

# 3. Retrieve and display
echo -e "\n📖 Retrieving document as JSON:"
curl -s "$API_URL?action=GET&key=demo-doc&type=json" | jq '.payload'

# 4. List all files
echo -e "\n📁 Current files in store:"
curl -s "$API_URL?action=LIST" | jq '.payload[].key'

# 4b. Get metadata example
echo -e "\n📋 Getting metadata for document with metadata:"
curl -s "$API_URL?action=METADATA&key=demo-with-meta" | jq '.payload'

# 5. Clean up
echo -e "\n🗑️ Cleaning up..."
curl -s -X DELETE "$API_URL?action=DELETE&key=demo-doc" | jq '.payload.message'
curl -s -X DELETE "$API_URL?action=DELETE&key=demo-with-meta" | jq '.payload.message'

echo -e "\n✅ Demo completed!"

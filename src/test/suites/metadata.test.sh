#!/bin/bash

# Quick metadata test
API_URL="http://localhost:8000/.netlify/functions/blobs"
KEY="meta-test-$(date +%s)"

echo "🧪 Metadata Encoding Test"
echo "========================"

# Test 1: Simple metadata
META1='{"test":true}'
ENCODED1=$(printf '%s' "$META1" | jq -sRr @uri)
echo "Original: $META1"
echo "Encoded:  $ENCODED1"
echo "Creating blob with metadata..."

RESULT1=$(curl -s -X POST "$API_URL?action=POST&key=$KEY&metadata=$ENCODED1" \
  -H "Content-Type: application/json" \
  -d '{"data":"test"}')

echo "Result:"
echo "$RESULT1" | jq '.'

if [ "$(echo "$RESULT1" | jq -r '.status')" = "201" ]; then
    echo "✅ Metadata test passed!"
    
    # Get metadata back
    echo -e "\nRetrieving metadata:"
    curl -s "$API_URL?action=METADATA&key=$KEY" | jq '.'
    
    # Cleanup
    curl -s -X DELETE "$API_URL?action=DELETE&key=$KEY" > /dev/null
    echo "🗑️ Cleaned up"
else
    echo "❌ Metadata test failed!"
fi

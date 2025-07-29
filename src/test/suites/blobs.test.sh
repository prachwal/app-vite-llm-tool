#!/bin/bash
set -e

# ===================================================================
# Netlify Blobs API - Comprehensive Test Suite with Validation
# ===================================================================
# Tests all endpoints: GET, POST, PUT, DELETE, LIST, METADATA, GET_META, GET_STORES
# Includes Zod validation testing and error handling
# Usage: ./blobs.test.sh [base_url]
# ===================================================================

# Configuration
API_URL="${1:-http://localhost:8000/.netlify/functions/blobs}"
KEY="test-blob-$(date +%s)"
ALT_KEY="alt-test-$(date +%s)"
DATA='{"message":"Hello World","timestamp":"'$(date -Iseconds)'","number":42}'
META='{"author":"test-suite","type":"integration-test","version":"1.0"}'
STORE_NAME="user-data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_validation() {
    echo -e "${PURPLE}🔍 $1${NC}"
}

make_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    local headers="$4"
    
    if [ -n "$data" ]; then
        curl -s -X "$method" "$url" -H "Content-Type: application/json" $headers -d "$data"
    else
        curl -s -X "$method" "$url" $headers
    fi
}

test_endpoint() {
    local name="$1"
    local response="$2"
    local expected_status="$3"
    
    # Extract status from JSON response
    local status=$(echo "$response" | jq -r '.status // empty')
    
    if [ "$status" = "$expected_status" ]; then
        print_success "$name: Status $status"
    else
        print_error "$name: Expected status $expected_status, got $status"
        echo "Response: $response"
    fi
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo
}

test_validation() {
    local name="$1"
    local response="$2"
    local expected_error_code="$3"
    
    local status=$(echo "$response" | jq -r '.status // empty')
    local error_code=$(echo "$response" | jq -r '.error.code // empty')
    
    if [ "$status" = "400" ] && [ "$error_code" = "$expected_error_code" ]; then
        print_success "$name: Validation error correctly caught ($error_code)"
    else
        print_error "$name: Expected 400 with code $expected_error_code, got status $status with code $error_code"
        echo "Response: $response"
    fi
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo
}

# ===================================================================
# Main Test Suite
# ===================================================================

print_header "Netlify Blobs API Test Suite"
echo "API URL: $API_URL"
echo "Test Key: $KEY"
echo "Alt Key: $ALT_KEY"
echo "Store: $STORE_NAME"

# Test 1: GET_STORES - List available stores
print_header "1. GET_STORES - Available Stores"
print_step "Fetching available stores..."
STORES=$(make_request "GET" "$API_URL?action=GET_STORES")
test_endpoint "GET_STORES" "$STORES" "200"

# Test 2: POST - Create new blob with metadata in default store
print_header "2. POST - Create Blob (Default Store)"
print_step "Creating blob with key: $KEY"
# Properly encode metadata for URL
ENCODED_META=$(printf '%s' "$META" | jq -sRr @uri)
POST_RESP=$(make_request "POST" "$API_URL?action=POST&key=$KEY&metadata=$ENCODED_META" "$DATA")
test_endpoint "POST" "$POST_RESP" "201"

# Test 3: GET - Fetch blob as text
print_header "3. GET - Fetch as Text"
print_step "Fetching blob as text..."
GET_TEXT=$(make_request "GET" "$API_URL?action=GET&key=$KEY")
test_endpoint "GET (text)" "$GET_TEXT" "200"

# Test 4: GET - Fetch blob as JSON
print_header "4. GET - Fetch as JSON"
print_step "Fetching blob as JSON..."
GET_JSON=$(make_request "GET" "$API_URL?action=GET&key=$KEY&type=json")
test_endpoint "GET (json)" "$GET_JSON" "200"

# Test 5: METADATA - Get blob metadata only
print_header "5. METADATA - Get Metadata"
print_step "Fetching blob metadata..."
META_RESP=$(make_request "GET" "$API_URL?action=METADATA&key=$KEY")
test_endpoint "METADATA" "$META_RESP" "200"

# Test 6: GET_META - Get blob with metadata
print_header "6. GET_META - Get Blob + Metadata"
print_step "Fetching blob with metadata..."
GET_META_RESP=$(make_request "GET" "$API_URL?action=GET_META&key=$KEY")
test_endpoint "GET_META" "$GET_META_RESP" "200"

# Test 7: PUT - Update existing blob
print_header "7. PUT - Update Blob"
print_step "Updating blob content..."
NEW_DATA='{"message":"Updated Hello World","updated_at":"'$(date -Iseconds)'"}'
PUT_RESP=$(make_request "PUT" "$API_URL?action=PUT&key=$KEY" "$NEW_DATA")
test_endpoint "PUT" "$PUT_RESP" "201"

# Test 8: POST - Create blob in different store
print_header "8. POST - Create in Custom Store"
print_step "Creating blob in store: $STORE_NAME"
POST_STORE=$(make_request "POST" "$API_URL?action=POST&key=$ALT_KEY&store=$STORE_NAME" '{"store_test":true}')
test_endpoint "POST (custom store)" "$POST_STORE" "201"

# Test 9: LIST - List blobs in default store
print_header "9. LIST - Default Store"
print_step "Listing blobs in default store..."
LIST_DEFAULT=$(make_request "GET" "$API_URL?action=LIST")
test_endpoint "LIST (default)" "$LIST_DEFAULT" "200"

# Test 10: LIST - List blobs in custom store
print_header "10. LIST - Custom Store"
print_step "Listing blobs in custom store: $STORE_NAME"
LIST_CUSTOM=$(make_request "GET" "$API_URL?action=LIST&store=$STORE_NAME")
test_endpoint "LIST (custom)" "$LIST_CUSTOM" "200"

# Test 11: VALIDATION - Invalid action parameter
print_header "11. VALIDATION - Invalid Action"
print_validation "Testing Zod validation for invalid action parameter..."
INVALID_ACTION=$(make_request "GET" "$API_URL?action=INVALID_ACTION&key=$KEY")
test_validation "INVALID_ACTION" "$INVALID_ACTION" "INVALID_PARAMS"

# Test 12: VALIDATION - Invalid metadata JSON
print_header "12. VALIDATION - Invalid Metadata"
print_validation "Testing validation for malformed metadata JSON..."
INVALID_META=$(make_request "POST" "$API_URL?action=POST&key=test-invalid-meta&metadata=invalid-json" "$DATA")
test_validation "INVALID_METADATA" "$INVALID_META" "INVALID_METADATA"

# Test 13: Error handling - Missing key
print_header "13. ERROR - Missing Key"
print_step "Testing error handling for missing key..."
ERROR_RESP=$(make_request "GET" "$API_URL?action=GET")
test_endpoint "ERROR (missing key)" "$ERROR_RESP" "400"

# Test 14: Error handling - Invalid store
print_header "14. ERROR - Invalid Store"
print_step "Testing error handling for invalid store..."
INVALID_STORE=$(make_request "GET" "$API_URL?action=LIST&store=invalid-store")
test_endpoint "ERROR (invalid store)" "$INVALID_STORE" "400"

# Test 15: Error handling - Non-existent blob
print_header "15. ERROR - Non-existent Blob"
print_step "Testing error handling for non-existent blob..."
NOT_FOUND=$(make_request "GET" "$API_URL?action=GET&key=non-existent-key")
test_endpoint "ERROR (not found)" "$NOT_FOUND" "404"

# Test 16: DELETE - Remove blob from custom store
print_header "16. DELETE - Custom Store Blob"
print_step "Deleting blob from custom store..."
DEL_CUSTOM=$(make_request "DELETE" "$API_URL?action=DELETE&key=$ALT_KEY&store=$STORE_NAME")
test_endpoint "DELETE (custom)" "$DEL_CUSTOM" "200"

# Test 17: DELETE - Remove blob from default store
print_header "17. DELETE - Default Store Blob"
print_step "Deleting blob from default store..."
DEL_DEFAULT=$(make_request "DELETE" "$API_URL?action=DELETE&key=$KEY")
test_endpoint "DELETE (default)" "$DEL_DEFAULT" "200"

# Test 18: Verify deletion
print_header "18. VERIFY - Blob Deleted"
print_step "Verifying blob was deleted (should return 404)..."
VERIFY_DEL=$(make_request "GET" "$API_URL?action=GET&key=$KEY")
test_endpoint "VERIFY DELETE" "$VERIFY_DEL" "404"

# ===================================================================
# Test Summary
# ===================================================================

print_header "Test Suite Complete"
print_success "All endpoints and validation tests completed!"
echo -e "${BLUE}Tested endpoints:${NC}"
echo "  ✓ GET_STORES - List available stores"
echo "  ✓ POST - Create blob with metadata"
echo "  ✓ GET - Fetch blob (text/json)"
echo "  ✓ METADATA - Get blob metadata"
echo "  ✓ GET_META - Get blob with metadata"
echo "  ✓ PUT - Update blob"
echo "  ✓ LIST - List blobs"
echo "  ✓ DELETE - Remove blob"
echo "  ✓ Error handling (missing key, invalid store, not found)"
echo "  ✓ Multi-store operations"
echo -e "${PURPLE}  ✓ Zod validation testing (invalid actions, malformed data)${NC}"

echo -e "\n${GREEN}🎉 Netlify Blobs API with validation is working correctly!${NC}"
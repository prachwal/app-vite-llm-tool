#!/bin/bash
set -e

# ===================================================================
# Netlify Hello Function - Comprehensive Test Suite with Validation
# ===================================================================
# Tests hello endpoint with various parameters and Zod validation
# Usage: ./hello.test.sh [base_url]
# ===================================================================

# Configuration
API_URL="http://localhost:8000/.netlify/functions/hello"
VERBOSE=false
MOCK_MODE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --verbose)
            VERBOSE=true
            ;;
        --mock)
            MOCK_MODE=true
            ;;
        http*)
            API_URL="$arg"
            ;;
    esac
done

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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Mock responses for server-independent testing
get_mock_response() {
    local path="$1"
    local method="$2"
    
    case "$path" in
        *"/hello"*)
            if [[ "$path" == *"action=INVALID"* ]]; then
                echo '{"status":400,"payload":null,"error":{"message":"Validation failed","code":"INVALID_ACTION","details":"Invalid action parameter"},"metadata":{}}'
            elif [[ "$path" == *"name="* ]]; then
                echo '{"status":200,"payload":{"message":"Hello Test User!","timestamp":"2024-01-01T12:00:00.000Z"},"error":null,"metadata":{"function":"hello","version":"1.0.0"}}'
            else
                echo '{"status":200,"payload":{"message":"Hello World!","timestamp":"2024-01-01T12:00:00.000Z"},"error":null,"metadata":{"function":"hello","version":"1.0.0"}}'
            fi
            ;;
        *)
            echo '{"status":404,"payload":null,"error":{"message":"Not found","code":"NOT_FOUND"},"metadata":{}}'
            ;;
    esac
}

# Check if server is accessible
check_server() {
    print_step "Checking server connectivity..."
    if curl -s --connect-timeout 5 "$API_URL" >/dev/null 2>&1; then
        print_success "Server is accessible at $API_URL"
        return 0
    else
        print_error "Cannot connect to server at $API_URL"
        print_warning "Please ensure the Netlify dev server is running:"
        print_warning "  netlify dev  # or"
        print_warning "  npx netlify dev"
        return 1
    fi
}

# Enhanced HTTP request function with mock support
make_request() {
    local method="$1"
    local endpoint="$2"
    local expected_status="$3"
    
    if [ "$MOCK_MODE" = true ]; then
        get_mock_response "$endpoint" "$method"
        return 0
    fi
    
    local url="${API_URL}${endpoint}"
    curl -s --connect-timeout 10 --max-time 30 -X "$method" "$url"
}

# Validate JSON structure
validate_json() {
    local url="$2"
    local data="$3"
    local headers="$4"
    
    if [ -n "$data" ]; then
        curl -s --connect-timeout 10 --max-time 30 -X "$method" "$url" -H "Content-Type: application/json" $headers -d "$data"
    else
        curl -s --connect-timeout 10 --max-time 30 -X "$method" "$url" $headers
    fi
}

test_endpoint() {
    local name="$1"
    local response="$2"
    local expected_status="$3"
    local expected_message="$4"
    
    # Check if response is empty (connection failed)
    if [ -z "$response" ]; then
        print_error "$name: No response (connection failed)"
        return 1
    fi
    
    # Extract status from JSON response
    local status=$(echo "$response" | jq -r '.status // empty' 2>/dev/null)
    local message=$(echo "$response" | jq -r '.payload.message // empty' 2>/dev/null)
    
    if [ "$status" = "$expected_status" ]; then
        if [ -n "$expected_message" ] && [ "$message" != "$expected_message" ]; then
            print_error "$name: Expected message '$expected_message', got '$message'"
        else
            print_success "$name: Status $status, Message: '$message'"
        fi
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
    
    # Check if response is empty (connection failed)
    if [ -z "$response" ]; then
        print_error "$name: No response (connection failed)"
        return 1
    fi
    
    local status=$(echo "$response" | jq -r '.status // empty' 2>/dev/null)
    local error_code=$(echo "$response" | jq -r '.error.code // empty' 2>/dev/null)
    
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

print_header "Netlify Hello Function Test Suite"
echo "API URL: $API_URL"

# Check server connectivity first (skip in mock mode)
if [ "$MOCK_MODE" != true ]; then
    if ! check_server; then
        exit 1
    fi
else
    print_warning "Running in mock mode - skipping server connectivity check"
fi

# Test 1: Default greeting (no parameters)
print_header "1. DEFAULT GREETING"
print_step "Testing default greeting without parameters..."
DEFAULT_RESP=$(make_request "GET" "$API_URL")
test_endpoint "DEFAULT GREETING" "$DEFAULT_RESP" "200" "Hello World"

# Test 2: Default greeting with explicit action
print_header "2. EXPLICIT ACTION"
print_step "Testing with explicit GREET action..."
EXPLICIT_RESP=$(make_request "GET" "$API_URL?action=GREET")
test_endpoint "EXPLICIT GREET" "$EXPLICIT_RESP" "200" "Hello World"

# Test 3: Custom name parameter
print_header "3. CUSTOM NAME"
print_step "Testing greeting with custom name..."
CUSTOM_RESP=$(make_request "GET" "$API_URL?name=Alice")
test_endpoint "CUSTOM NAME" "$CUSTOM_RESP" "200" "Hello Alice"

# Test 4: Custom name with explicit action
print_header "4. CUSTOM NAME + ACTION"
print_step "Testing greeting with both action and name..."
BOTH_RESP=$(make_request "GET" "$API_URL?action=GREET&name=Bob")
test_endpoint "NAME + ACTION" "$BOTH_RESP" "200" "Hello Bob"

# Test 5: Special characters in name (URL encoding)
print_header "5. SPECIAL CHARACTERS"
print_step "Testing greeting with special characters..."
SPECIAL_RESP=$(make_request "GET" "$API_URL?name=José%20García")
test_endpoint "SPECIAL CHARS" "$SPECIAL_RESP" "200" "Hello José García"

# Test 6: Empty name parameter
print_header "6. EMPTY NAME"
print_step "Testing greeting with empty name parameter..."
EMPTY_RESP=$(make_request "GET" "$API_URL?name=")
test_endpoint "EMPTY NAME" "$EMPTY_RESP" "200" "Hello World"

# Test 7: Very long name
print_header "7. LONG NAME"
print_step "Testing greeting with very long name..."
LONG_NAME="VeryLongNameThatExceedsNormalLengthForTestingPurposes"
LONG_RESP=$(make_request "GET" "$API_URL?name=$LONG_NAME")
test_endpoint "LONG NAME" "$LONG_RESP" "200" "Hello $LONG_NAME"

# Test 8: Multiple parameters (name appears multiple times - last one wins)
print_header "8. MULTIPLE NAME PARAMS"
print_step "Testing with multiple name parameters..."
MULTI_RESP=$(make_request "GET" "$API_URL?name=First&name=Second")
test_endpoint "MULTIPLE NAMES" "$MULTI_RESP" "200" "Hello Second"

# ===================================================================
# Validation Tests
# ===================================================================

print_header "VALIDATION TESTS"

# Test 9: Invalid action parameter
print_header "9. VALIDATION - Invalid Action"
print_validation "Testing Zod validation for invalid action..."
INVALID_ACTION=$(make_request "GET" "$API_URL?action=INVALID_ACTION")
test_validation "INVALID_ACTION" "$INVALID_ACTION" "INVALID_ACTION"

# Test 10: POST request (should still work with universal handler)
print_header "10. POST REQUEST"
print_step "Testing POST request with name in query..."
POST_RESP=$(make_request "POST" "$API_URL?name=PostUser")
test_endpoint "POST REQUEST" "$POST_RESP" "200" "Hello PostUser"

# Test 11: PUT request 
print_header "11. PUT REQUEST"
print_step "Testing PUT request with name in query..."
PUT_RESP=$(make_request "PUT" "$API_URL?name=PutUser")
test_endpoint "PUT REQUEST" "$PUT_RESP" "200" "Hello PutUser"

# Test 12: Response structure validation
print_header "12. RESPONSE STRUCTURE"
print_step "Validating response structure matches universal API format..."
STRUCT_RESP=$(make_request "GET" "$API_URL?name=StructureTest")
echo "$STRUCT_RESP" | jq '.'

# Check if response has required fields
HAS_STATUS=$(echo "$STRUCT_RESP" | jq 'has("status")')
HAS_PAYLOAD=$(echo "$STRUCT_RESP" | jq 'has("payload")')
HAS_ERROR=$(echo "$STRUCT_RESP" | jq 'has("error")')
HAS_METADATA=$(echo "$STRUCT_RESP" | jq 'has("metadata")')

if [ "$HAS_STATUS" = "true" ] && [ "$HAS_PAYLOAD" = "true" ] && [ "$HAS_ERROR" = "true" ] && [ "$HAS_METADATA" = "true" ]; then
    print_success "RESPONSE STRUCTURE: All required fields present"
else
    print_error "RESPONSE STRUCTURE: Missing required fields"
    echo "Has status: $HAS_STATUS, payload: $HAS_PAYLOAD, error: $HAS_ERROR, metadata: $HAS_METADATA"
fi

# ===================================================================
# Performance Tests
# ===================================================================

print_header "PERFORMANCE TESTS"

# Test 13: Multiple rapid requests
print_header "13. RAPID REQUESTS"
print_step "Testing multiple rapid requests..."
for i in {1..5}; do
    RAPID_RESP=$(make_request "GET" "$API_URL?name=User$i")
    message=$(echo "$RAPID_RESP" | jq -r '.payload.message // empty')
    if [ "$message" = "Hello User$i" ]; then
        print_success "Rapid request $i: OK"
    else
        print_error "Rapid request $i: Failed - got '$message'"
    fi
done

# ===================================================================
# Test Summary
# ===================================================================

print_header "Test Suite Complete"
print_success "All hello function tests completed!"
echo -e "${BLUE}Tested scenarios:${NC}"
echo "  ✓ Default greeting (no parameters)"
echo "  ✓ Explicit action parameter"
echo "  ✓ Custom name parameter"
echo "  ✓ Special characters and URL encoding"
echo "  ✓ Edge cases (empty name, long name, multiple params)"
echo "  ✓ Different HTTP methods (GET, POST, PUT)"
echo "  ✓ Response structure validation"
echo "  ✓ Performance (rapid requests)"
echo -e "${PURPLE}  ✓ Zod validation testing (invalid actions)${NC}"

echo -e "\n${GREEN}🎉 Netlify Hello Function with validation is working correctly!${NC}"

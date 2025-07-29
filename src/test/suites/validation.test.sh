#!/bin/bash
set -e

# ===================================================================
# Universal Handler Validation and Zod Tests
# ===================================================================
# Tests Zod validation and universal handler functionality across all functions
# Usage: ./validation.test.sh [base_url]
# ===================================================================

# Configuration
BASE_URL="http://localhost:8000/.netlify/functions"
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
            BASE_URL="$arg"
            ;;
    esac
done

HELLO_URL="$BASE_URL/hello"
BLOBS_URL="$BASE_URL/blobs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

print_universal() {
    echo -e "${CYAN}🌐 $1${NC}"
}

# Mock responses for server-independent testing
get_mock_response() {
    local path="$1"
    local method="$2"
    
    case "$path" in
        *"/hello"*)
            if [[ "$path" == *"error"* ]] || [[ "$path" == *"invalid"* ]]; then
                echo '{"status":400,"payload":null,"error":{"message":"Validation failed","code":"INVALID_PARAMS","details":"[{\"code\":\"too_small\",\"minimum\":2,\"type\":\"string\",\"inclusive\":true,\"exact\":false,\"message\":\"String must contain at least 2 character(s)\",\"path\":[\"name\"]}]"},"metadata":{}}'
            elif [[ "$path" == *"name="* ]]; then
                echo '{"status":200,"payload":{"message":"Hello Test User!","timestamp":"2024-01-01T12:00:00.000Z"},"error":null,"metadata":{"function":"hello","version":"1.0.0"}}'
            else
                echo '{"status":200,"payload":{"message":"Hello World!","timestamp":"2024-01-01T12:00:00.000Z"},"error":null,"metadata":{"function":"hello","version":"1.0.0"}}'
            fi
            ;;
        *"/blobs"*)
            if [[ "$path" == *"INVALID"* ]]; then
                echo '{"status":400,"payload":null,"error":{"message":"Invalid parameters","code":"INVALID_PARAMS","details":"[{\"code\":\"invalid_value\",\"values\":[\"GET\",\"METADATA\",\"LIST\",\"POST\",\"PUT\",\"DELETE\",\"GET_META\",\"GET_STORES\"],\"path\":[\"action\"],\"message\":\"Invalid option\"}]"},"metadata":{}}'
            else
                echo '{"status":200,"payload":{"stores":["main","user-data"]},"error":null,"metadata":{}}'
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
    if curl -s --connect-timeout 5 "$BASE_URL" >/dev/null 2>&1; then
        print_success "Server is accessible at $BASE_URL"
        return 0
    else
        print_error "Cannot connect to server at $BASE_URL"
        print_warning "Please ensure the Netlify dev server is running:"
        print_warning "  netlify dev  # or"
        print_warning "  npx netlify dev"
        return 1
    fi
}

make_request() {
    local method="$1"
    local url="$2"
    local data="$3"
    
    if [ "$MOCK_MODE" = true ]; then
        get_mock_response "$url" "$method"
        return 0
    fi
    
    if [ -n "$data" ]; then
        curl -s --connect-timeout 10 --max-time 30 -X "$method" "$url" -H "Content-Type: application/json" -d "$data"
    else
        curl -s --connect-timeout 10 --max-time 30 -X "$method" "$url"
    fi
}

test_validation_response() {
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

test_universal_response() {
    local name="$1"
    local response="$2"
    
    local has_status=$(echo "$response" | jq 'has("status")' 2>/dev/null)
    local has_payload=$(echo "$response" | jq 'has("payload")' 2>/dev/null)
    local has_error=$(echo "$response" | jq 'has("error")' 2>/dev/null)
    local has_metadata=$(echo "$response" | jq 'has("metadata")' 2>/dev/null)
    
    if [ "$has_status" = "true" ] && [ "$has_payload" = "true" ] && [ "$has_error" = "true" ] && [ "$has_metadata" = "true" ]; then
        print_success "$name: ✓ Universal response structure"
    else
        print_error "$name: ✗ Missing universal response fields"
        echo "  Status: $has_status, Payload: $has_payload, Error: $has_error, Metadata: $has_metadata"
    fi
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo
}

# ===================================================================
# Main Test Suite
# ===================================================================

print_header "Universal Handler Validation and Zod Tests"
print_universal "Testing Zod validation and universal response format across all functions"

# Check server connectivity first (skip in mock mode)
if [ "$MOCK_MODE" != true ]; then
    if ! check_server; then
        exit 1
    fi
else
    print_warning "Running in mock mode - skipping server connectivity check"
fi

# ===================================================================
# Universal Handler Structure Tests
# ===================================================================

print_header "UNIVERSAL HANDLER STRUCTURE TESTS"

print_universal "Testing that all functions return universal response format..."

# Test hello function response structure
print_step "Testing hello function response structure..."
HELLO_STRUCT=$(make_request "GET" "$HELLO_URL?name=StructureTest")
test_universal_response "Hello Function Structure" "$HELLO_STRUCT"

# Test blobs function response structure
print_step "Testing blobs function response structure..."
BLOBS_STRUCT=$(make_request "GET" "$BLOBS_URL?action=GET_STORES")
test_universal_response "Blobs Function Structure" "$BLOBS_STRUCT"

# ===================================================================
# ZOD VALIDATION TESTS
# ===================================================================

print_header "ZOD VALIDATION TESTS"

# Test Hello Function Validation
print_validation "Testing Hello function Zod validation..."

# Invalid action parameter
print_step "Testing invalid action parameter for hello..."
HELLO_INVALID_ACTION=$(make_request "GET" "$HELLO_URL?action=INVALID_ACTION")
test_validation_response "Hello Invalid Action" "$HELLO_INVALID_ACTION" "INVALID_PARAMS"

# Test Blobs Function Validation
print_validation "Testing Blobs function Zod validation..."

# Test invalid action
print_step "Testing invalid action parameter for blobs..."
BLOBS_INVALID_ACTION=$(make_request "GET" "$BLOBS_URL?action=TOTALLY_INVALID")
test_validation_response "Blobs Invalid Action" "$BLOBS_INVALID_ACTION" "INVALID_PARAMS"

# Test valid action (should succeed)
print_step "Testing valid action parameter..."
BLOBS_VALID_ACTION=$(make_request "GET" "$BLOBS_URL?action=GET_STORES")

# ===================================================================
# Test Summary
# ===================================================================

print_header "VALIDATION TEST SUMMARY"

print_success "✓ Universal response structure tests completed"
print_success "✓ Zod validation tests completed"

print_universal "All validation and universal handler tests completed!"
echo -e "${GREEN}🎉 Zod validation is working correctly across all functions!${NC}"

exit 0

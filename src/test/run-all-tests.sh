#!/bin/bash

# ===================================================================
# Netlify Functions - Consolidated Test Runner
# ===================================================================
# Executes all test suites for Netlify Functions with validation
# Usage: ./run-all-tests.sh [base_url] [--suite=suite_name] [--verbose]
# ===================================================================

set -e

# Configuration
BASE_URL="http://localhost:8000/.netlify/functions"
SUITE_FILTER=""
VERBOSE=false
MOCK_MODE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --suite=*)
            SUITE_FILTER="${arg#*=}"
            ;;
        --verbose)
            VERBOSE=true
            ;;
        --mock)
            MOCK_MODE=true
            ;;
        --help)
            echo "Usage: $0 [base_url] [--suite=suite_name] [--verbose] [--mock] [--help]"
            echo ""
            echo "Arguments:"
            echo "  base_url          Base URL for functions (default: http://localhost:8000/.netlify/functions)"
            echo "  --suite=name      Run only specific test suite (hello|blobs|validation|structure|metadata)"
            echo "  --verbose         Show detailed output"
            echo "  --mock           Run in mock mode (skip server connectivity tests)"
            echo "  --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run-all-tests.sh                                    # Run all tests"
            echo "  ./run-all-tests.sh --suite=hello                      # Run only hello tests"
            echo "  ./run-all-tests.sh http://localhost:3000 --verbose    # Custom URL with verbose output"
            echo "  ./run-all-tests.sh --mock                             # Run without server"
            exit 0
            ;;
        http*)
            BASE_URL="$arg"
            ;;
    esac
done

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║               NETLIFY FUNCTIONS TEST SUITE                     ║"
    echo "║                 Comprehensive Testing                          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_section() {
    echo -e "\n${BLUE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
}

print_result() {
    local exit_code=$1
    local name="$2"
    local duration="$3"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ $name - PASSED${NC} ${YELLOW}($duration)${NC}"
    else
        echo -e "${RED}✗ $name - FAILED${NC} ${YELLOW}($duration)${NC}"
    fi
}

# Add helper functions
print_info() {
    echo -e "${BLUE}INFO:${NC} $1"
}

print_success() {
    echo -e "${GREEN}SUCCESS:${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

check_server_connectivity() {
    local base_url=${SERVER_BASE_URL:-"http://localhost:8888"}
    
    if [ "$VERBOSE" = true ]; then
        print_info "Checking server connectivity at $base_url..."
    fi
    
    if curl --silent --connect-timeout 5 --max-time 10 "$base_url" > /dev/null 2>&1; then
        if [ "$VERBOSE" = true ]; then
            print_success "Server is available at $base_url"
        fi
        return 0
    else
        if [ "$VERBOSE" = true ]; then
            print_warning "Server not available at $base_url"
        fi
        return 1
    fi
}

check_server_connectivity() {
    if [ "$MOCK_MODE" = true ]; then
        print_info "Running in mock mode - skipping server connectivity check"
        return 0
    fi
    
    print_info "Checking server connectivity..."
    if curl -s --connect-timeout 5 "$BASE_URL/hello" >/dev/null 2>&1; then
        print_success "Server is accessible at $BASE_URL"
        return 0
    else
        print_warning "Cannot connect to server at $BASE_URL"
        print_warning "To start the development server, run:"
        print_warning "  ./start-dev-server.sh"
        print_warning "Or use mock mode: ./run-all-tests.sh --mock"
        return 1
    fi
}

run_test_suite() {
    local suite_name="$1"
    local script_path="$2"
    local description="$3"
    local url_param="$4"
    
    # Check if suite filter is set and doesn't match
    if [ -n "$SUITE_FILTER" ] && [ "$SUITE_FILTER" != "$suite_name" ]; then
        return 0
    fi
    
    if [ ! -f "$script_path" ]; then
        print_warning "$description - Script not found: $script_path"
        return 1
    fi
    
    echo -e "\n${PURPLE}Running $description...${NC}"
    local start_time=$(date +%s)
    
    # Pass mock mode and verbose flags to test suites
    local test_args=""
    if [ "$MOCK_MODE" = true ]; then
        test_args="$test_args --mock"
    fi
    if [ "$VERBOSE" = true ]; then
        test_args="$test_args --verbose"
    fi
    
    if [ "$VERBOSE" = true ]; then
        "$script_path" "$url_param" $test_args
        local exit_code=$?
    else
        "$script_path" "$url_param" $test_args >/dev/null 2>&1
        local exit_code=$?
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    print_result $exit_code "$description" "${duration}s"
    return $exit_code
}

# Test suite definitions
declare -A TEST_SUITES=(
    ["hello"]="suites/hello.test.sh|Hello Function Tests|$BASE_URL/hello"
    ["blobs"]="suites/blobs.test.sh|Blobs Function Tests|$BASE_URL/blobs"
    ["validation"]="suites/validation.test.sh|Validation & Universal Handler Tests|$BASE_URL"
    ["structure"]="suites/response-structure.test.sh|Response Structure Tests|$BASE_URL"
    ["metadata"]="suites/metadata.test.sh|Metadata Tests|$BASE_URL"
)

print_banner

echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Base URL: ${CYAN}$BASE_URL${NC}"
echo -e "  Test Directory: ${CYAN}$(pwd)${NC}"
echo -e "  Timestamp: ${CYAN}$(date)${NC}"
if [ -n "$SUITE_FILTER" ]; then
    echo -e "  Suite Filter: ${PURPLE}$SUITE_FILTER${NC}"
fi
if [ "$VERBOSE" = true ]; then
    echo -e "  Verbose Mode: ${GREEN}ON${NC}"
fi
if [ "$MOCK_MODE" = true ]; then
    echo -e "  Mock Mode: ${YELLOW}ON${NC}"
fi
echo

# Check server connectivity (unless in mock mode)
if ! check_server_connectivity; then
    if [ "$MOCK_MODE" != true ]; then
        print_error "Server connectivity check failed. Exiting."
        print_info "Use --mock flag to run tests without server connectivity."
        exit 1
    fi
fi

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
declare -a FAILED_SUITES=()

# Run test suites
for suite_name in "${!TEST_SUITES[@]}"; do
    IFS='|' read -r script_path description url_param <<< "${TEST_SUITES[$suite_name]}"
    
    # Skip if suite filter is set and doesn't match
    if [ -n "$SUITE_FILTER" ] && [ "$SUITE_FILTER" != "$suite_name" ]; then
        continue
    fi
    
    print_section "$description"
    
    if run_test_suite "$suite_name" "$script_path" "$description" "$url_param"; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_SUITES+=("$suite_name")
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
done

# Handle case when no tests were run due to filtering
if [ $TOTAL_TESTS -eq 0 ]; then
    if [ -n "$SUITE_FILTER" ]; then
        echo -e "${RED}No test suite found matching filter: $SUITE_FILTER${NC}"
        echo -e "${YELLOW}Available suites: ${!TEST_SUITES[*]}${NC}"
        exit 1
    else
        echo -e "${RED}No test suites found${NC}"
        exit 1
    fi
fi

# ===================================================================
# Test Summary
# ===================================================================

print_section "TEST SUMMARY"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                          TEST RESULTS                          ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
printf "${CYAN}║${NC} Total Tests:   ${YELLOW}%-2s${NC}                                              ${CYAN}║${NC}\n" "$TOTAL_TESTS"
printf "${CYAN}║${NC} Passed:        ${GREEN}%-2s${NC}                                              ${CYAN}║${NC}\n" "$PASSED_TESTS"
printf "${CYAN}║${NC} Failed:        ${RED}%-2s${NC}                                              ${CYAN}║${NC}\n" "$FAILED_TESTS"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                    ${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}                     ${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "\n${GREEN}✅ Netlify Functions with Zod validation are working correctly!${NC}"
    
    if [ -n "$SUITE_FILTER" ]; then
        echo -e "${CYAN}ℹ Note: Only ran suite '$SUITE_FILTER'. Run without --suite to test all.${NC}"
    fi
    
    exit 0
else
    echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
    echo -e "${CYAN}║${NC}                   ${RED}❌ SOME TESTS FAILED ❌${NC}                      ${CYAN}║${NC}"
    if [ ${#FAILED_SUITES[@]} -gt 0 ]; then
        echo -e "${CYAN}║${NC}                                                                ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC} Failed Suites: ${RED}${FAILED_SUITES[*]}${NC}                                ${CYAN}║${NC}"
    fi
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo -e "\n${RED}❌ Please check the failed tests above for details.${NC}"
    echo -e "${YELLOW}💡 Use --verbose flag to see detailed output.${NC}"
    echo -e "${YELLOW}💡 Use --suite=<name> to run specific test suite.${NC}"
    exit 1
fi

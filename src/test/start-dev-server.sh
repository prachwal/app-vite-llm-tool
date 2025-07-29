#!/bin/bash

# ===================================================================
# Development Helper - Start Netlify Dev Server for Testing
# ===================================================================
# Starts the Netlify dev server and waits for it to be ready
# Usage: ./start-dev-server.sh
# ===================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if netlify CLI is available
check_netlify_cli() {
    if command -v netlify >/dev/null 2>&1; then
        return 0
    elif command -v npx >/dev/null 2>&1; then
        print_info "Using npx netlify..."
        return 0
    else
        print_error "Netlify CLI not found. Please install it:"
        echo "  npm install -g netlify-cli"
        echo "  # or use npx: npx netlify dev"
        return 1
    fi
}

# Wait for server to be ready
wait_for_server() {
    local url="$1"
    local max_attempts=30
    local attempt=1
    
    print_info "Waiting for server to start at $url..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --connect-timeout 2 "$url" >/dev/null 2>&1; then
            print_success "Server is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Server did not start within $((max_attempts * 2)) seconds"
    return 1
}

# Check if server is already running
if curl -s --connect-timeout 2 "http://localhost:8000/.netlify/functions/hello" >/dev/null 2>&1; then
    print_success "Netlify dev server is already running at http://localhost:8000"
    exit 0
fi

# Check Netlify CLI availability
if ! check_netlify_cli; then
    exit 1
fi

print_info "Starting Netlify dev server..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Start the server
if command -v netlify >/dev/null 2>&1; then
    netlify dev --port 8000 &
else
    npx netlify dev --port 8000 &
fi

SERVER_PID=$!
print_info "Started Netlify dev server (PID: $SERVER_PID)"

# Wait for server to be ready
if wait_for_server "http://localhost:8000/.netlify/functions/hello"; then
    print_success "Netlify dev server is ready for testing!"
    print_info "Functions available at:"
    echo "  http://localhost:8000/.netlify/functions/hello"
    echo "  http://localhost:8000/.netlify/functions/blobs"
    echo ""
    print_info "To stop the server, run: kill $SERVER_PID"
    echo ""
    print_info "Now you can run the tests:"
    echo "  cd src/test"
    echo "  ./run-all-tests.sh"
else
    print_error "Failed to start server. Killing process..."
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

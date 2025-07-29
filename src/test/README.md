# Netlify Functions Test Suite

Comprehensive test suite for Netlify Functions with Zod validation and universal handler architecture.

## Overview

This test suite validates:
- **Function Endpoints**: All CRUD operations for blobs and greeting functionality
- **Zod Validation**: Parameter validation using Zod schemas
- **Universal Handler**: Consistent error handling and response format
- **Error Handling**: Proper error codes and messages
- **Integration**: Cross-function workflows

## Project Structure

```
src/test/
├── run-all-tests.sh          # Main test runner (only script in root)
├── README.md                 # This documentation
├── suites/                   # All test scripts organized in subfolder
│   ├── hello.test.sh         # Hello function tests
│   ├── blobs.test.sh         # Blobs API tests
│   ├── validation.test.sh    # Universal handler & validation tests
│   ├── response-structure.test.sh    # Response structure tests
│   ├── metadata.test.sh      # Metadata handling tests
│   └── blobs.demo.sh         # Demo scripts
└── setup.ts                  # Test setup configuration
```

## Usage

### Quick Start - Run All Tests
```bash
cd src/test
./run-all-tests.sh
```

### Advanced Usage
```bash
# Run with custom URL
./run-all-tests.sh https://your-site.netlify.app/.netlify/functions

# Run specific test suite
./run-all-tests.sh --suite=hello
./run-all-tests.sh --suite=blobs
./run-all-tests.sh --suite=validation

# Verbose output for debugging
./run-all-tests.sh --verbose

# Combine options
./run-all-tests.sh http://localhost:3000 --suite=validation --verbose

# Show help
./run-all-tests.sh --help
```

### Available Test Suites
- **`hello`** - Hello function tests with parameter validation
- **`blobs`** - Complete CRUD tests for Blobs API
- **`validation`** - Universal handler and Zod validation tests
- **`structure`** - Response structure consistency tests
- **`metadata`** - Metadata handling tests

## Test Categories

### 1. Hello Function Tests (`hello.test.sh`)
- Default greeting (no parameters)
- Custom name parameter
- Special characters and URL encoding
- Edge cases (empty name, long name)
- Different HTTP methods
- Zod validation (invalid actions)
- Response structure validation
- Performance tests

### 2. Blobs Function Tests (`blobs.test.sh`)
- **CRUD Operations**: GET, POST, PUT, DELETE
- **Metadata Operations**: METADATA, GET_META
- **Store Operations**: LIST, GET_STORES
- **Multi-store Support**: Different blob stores
- **Error Handling**: Missing keys, invalid stores, not found
- **Zod Validation**: Invalid actions, malformed metadata
- **Edge Cases**: Large payloads, special characters

### 3. Validation Tests (`validation.test.sh`)
- Universal response structure consistency
- Zod schema validation across functions
- Error handling consistency
- Cross-function workflows
- Performance under load
- Integration scenarios

## Response Format

All functions follow the universal response format:
```json
{
  "status": 200,
  "payload": { /* response data */ },
  "error": null,
  "metadata": { /* additional info */ }
}
```

Error responses:
```json
{
  "status": 400,
  "payload": null,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": "Additional details"
  },
  "metadata": { /* additional info */ }
}
```

## Prerequisites

- **curl** - For making HTTP requests
- **jq** - For JSON parsing and validation
- **bash** - Shell environment
- **Local dev server** - Netlify Functions running locally (default: http://localhost:8000)

## Expected Test Results

### Success Indicators
- ✅ All endpoints return proper HTTP status codes
- ✅ Response structure matches universal format
- ✅ Zod validation correctly rejects invalid parameters
- ✅ Error messages are descriptive and consistent
- ✅ CRUD operations work correctly
- ✅ Multi-store operations function properly

### Common Issues
- ❌ **Connection Refused**: Dev server not running
- ❌ **Invalid JSON**: Response parsing errors
- ❌ **Missing Fields**: Response structure issues
- ❌ **Validation Bypassed**: Zod schema not working

## Development Workflow

1. **Start Dev Server**: `npm run dev` or `netlify dev`
2. **Run All Tests**: `./run-all-tests.sh`
3. **Run Specific Suite**: `./run-all-tests.sh --suite=validation`
4. **Debug with Verbose**: `./run-all-tests.sh --verbose`
5. **Fix Issues**: Address any failing tests
6. **Deploy**: Deploy with confidence

## Test Runner Features

The main `run-all-tests.sh` script provides:

### Command Line Options
- **Suite Filtering**: `--suite=<name>` to run specific test suite
- **Verbose Mode**: `--verbose` for detailed output during test execution
- **Help**: `--help` for usage information
- **Custom URLs**: Support for different deployment environments

### Enhanced Reporting
- ⏱️ **Execution Time**: Shows duration for each test suite
- 📊 **Summary Statistics**: Total/passed/failed test counts
- 🎯 **Failed Suite Tracking**: Lists which specific suites failed
- 💡 **Helpful Tips**: Guidance on using verbose mode and suite filtering
- 🎨 **Color-coded Output**: Easy visual distinction of results

### Examples
```bash
# Quick test of just validation
./run-all-tests.sh --suite=validation

# Debug a specific failing suite
./run-all-tests.sh --suite=blobs --verbose

# Test against staging environment
./run-all-tests.sh https://staging.netlify.app/.netlify/functions

# Full test with verbose output
./run-all-tests.sh --verbose
```

## Test Output

The test suite provides detailed output including:
- 🔍 **Validation Tests**: Purple indicators for validation testing
- 🔧 **Universal Handler**: Cyan indicators for handler testing  
- ✓ **Success**: Green checkmarks for passing tests
- ✗ **Failure**: Red X marks for failing tests
- ▶ **Progress**: Yellow arrows for test steps

## Continuous Integration

These tests can be integrated into CI/CD pipelines:
```yaml
# Example GitHub Actions step
- name: Run Function Tests
  run: |
    cd src/test
    ./run-all-tests.sh ${{ env.FUNCTIONS_URL }}

# Run specific critical tests first
- name: Run Critical Tests
  run: |
    cd src/test
    ./run-all-tests.sh --suite=validation
    ./run-all-tests.sh --suite=hello
```

## Contributing

When adding new functions or modifying existing ones:
1. Create new test files in `suites/` directory
2. Add new test suite to the `TEST_SUITES` array in `run-all-tests.sh`
3. Ensure all tests pass: `./run-all-tests.sh`
4. Update this README if needed

### Adding a New Test Suite
```bash
# 1. Create test file
touch suites/my-new-function.test.sh
chmod +x suites/my-new-function.test.sh

# 2. Edit run-all-tests.sh and add to TEST_SUITES array:
["my-new"]="suites/my-new-function.test.sh|My New Function Tests|$BASE_URL/my-new"

# 3. Test the new suite
./run-all-tests.sh --suite=my-new
```

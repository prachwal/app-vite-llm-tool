# Test Suites Directory

This directory contains all individual test scripts for the Netlify Functions test suite.

## Test Files

| Script | Purpose | URL Parameter |
|--------|---------|---------------|
| `hello.test.sh` | Hello function tests with parameter validation | `{base_url}/hello` |
| `blobs.test.sh` | Complete CRUD tests for Blobs API | `{base_url}/blobs` |
| `validation.test.sh` | Universal handler and Zod validation tests | `{base_url}` |
| `response-structure.test.sh` | Response structure consistency tests | `{base_url}` |
| `metadata.test.sh` | Metadata handling tests | `{base_url}` |
| `blobs.demo.sh` | Demo/example scripts | N/A |

## Usage

These scripts are typically run via the main test runner:
```bash
cd ../
./run-all-tests.sh --suite=hello
```

But can also be run individually:
```bash
./hello.test.sh http://localhost:8000/.netlify/functions/hello
./blobs.test.sh http://localhost:8000/.netlify/functions/blobs
./validation.test.sh http://localhost:8000/.netlify/functions
```

## Test Categories

### 🏠 Hello Function Tests (`hello.test.sh`)
- Default greeting (no parameters)
- Custom name parameter  
- Special characters and URL encoding
- Edge cases (empty name, long name)
- Different HTTP methods
- Zod validation (invalid actions)
- Response structure validation
- Performance tests

### 📦 Blobs Function Tests (`blobs.test.sh`)
- **CRUD Operations**: GET, POST, PUT, DELETE
- **Metadata Operations**: METADATA, GET_META
- **Store Operations**: LIST, GET_STORES
- **Multi-store Support**: Different blob stores
- **Error Handling**: Missing keys, invalid stores, not found
- **Zod Validation**: Invalid actions, malformed metadata
- **Edge Cases**: Large payloads, special characters

### 🔍 Validation Tests (`validation.test.sh`)
- Universal response structure consistency
- Zod schema validation across functions
- Error handling consistency
- Cross-function workflows
- Performance under load
- Integration scenarios

### 🏗️ Structure Tests (`response-structure.test.sh`)
- Response format validation
- API consistency checks
- Field presence validation

### 📋 Metadata Tests (`metadata.test.sh`)
- Metadata storage and retrieval
- JSON parsing and encoding
- Metadata validation

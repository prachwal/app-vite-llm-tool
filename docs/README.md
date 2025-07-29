# Documentation

## Netlify Blobs API

This directory contains comprehensive documentation for the Netlify Blobs API implementation.

### Files

- **[blobs-api.md](./blobs-api.md)** - Complete API reference with all endpoints, parameters, responses, and error codes
- **[blobs-usage-examples.md](./blobs-usage-examples.md)** - Practical usage examples for common scenarios

### Test Scripts

Located in `../src/test/`:

- **`blobs.test.sh`** - Comprehensive test suite covering all endpoints
- **`blobs.demo.sh`** - Quick demo of basic functionality  
- **`metadata.test.sh`** - Metadata encoding/decoding tests
- **`response-structure.test.sh`** - Response format validation

### Quick Start

1. **Basic usage:**
   ```bash
   # Create a file
   curl -X POST "/.netlify/functions/blobs?action=POST&key=my-file" \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello World"}'
   
   # Retrieve as JSON
   curl "/.netlify/functions/blobs?action=GET&key=my-file&type=json"
   ```

2. **Run tests:**
   ```bash
   # Full test suite
   ./src/test/blobs.test.sh
   
   # Quick demo
   ./src/test/blobs.demo.sh
   ```

3. **Check available stores:**
   ```bash
   curl "/.netlify/functions/blobs?action=GET_STORES"
   ```

### API Features

- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ Multiple storage stores (`file-uploads`, `user-data`, `images`, `logs`)
- ✅ Metadata support with JSON encoding
- ✅ JSON and text response formats
- ✅ Comprehensive error handling with structured error codes
- ✅ Universal response format across all endpoints
- ✅ Auto-generated keys with nanoid
- ✅ Robust URL encoding support for metadata

### Response Format

All endpoints return a consistent JSON structure:

```json
{
  "status": 200,
  "payload": { /* response data */ },
  "error": null,
  "metadata": { /* optional metadata */ }
}
```

For errors:

```json
{
  "status": 400,
  "payload": null,
  "error": {
    "message": "Human readable error",
    "code": "ERROR_CODE",
    "details": "Additional context"
  },
  "metadata": {}
}
```

### Available Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET_STORES` | List available storage stores |
| `POST` | Create new blob with optional metadata |
| `GET` | Retrieve blob content (text or JSON) |
| `PUT` | Update existing blob |
| `DELETE` | Remove blob from storage |
| `LIST` | List all blobs in a store |
| `METADATA` | Get blob metadata only |
| `GET_META` | Get blob content with metadata |

### Error Codes

- `BLOB_NOT_FOUND` - Requested blob doesn't exist
- `INVALID_JSON` - Blob contains malformed JSON
- `INVALID_METADATA` - Metadata parameter is invalid
- `MISSING_KEY` - Required key parameter missing
- `INVALID_STORE` - Unknown store name
- `INVALID_ACTION` - Unsupported action
- `INTERNAL_ERROR` - Server-side error

### Testing Status

All tests passing ✅:
- GET_STORES endpoint
- POST with metadata encoding
- GET (text and JSON formats)
- PUT operations
- DELETE operations
- LIST functionality
- METADATA retrieval
- GET_META operations
- Error handling scenarios
- Multi-store operations

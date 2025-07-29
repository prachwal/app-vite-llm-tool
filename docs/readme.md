# Netlify Blobs API Documentation

Kompletne API do zarządzania blob storage w Netlify Functions. Obsługuje wszystkie operacje CRUD z obsługą wielu store i szczegółowym error handling.

## Base URL
```
/.netlify/functions/blobs
```

## Universal Response Format
Wszystkie endpointy zwracają jednolity format JSON:

```typescript
{
  status: number,           // HTTP status code
  payload?: any,            // Response data (null for errors)
  error?: {                 // Error object (null for success)
    message: string,        // Human-readable error message
    code: string | number,  // Error code identifier
    details?: string        // Optional additional details
  } | null,
  metadata?: object         // Optional metadata object
}
```

## Available Stores
- `file-uploads` (default)
- `user-data`
- `images` 
- `logs`

## Endpoints

### 1. GET_STORES - List Available Stores
Lists all available blob stores.

**Request:**
```bash
GET /.netlify/functions/blobs?action=GET_STORES
```

**Response:**
```json
{
  "status": 200,
  "payload": {
    "stores": ["file-uploads", "user-data", "images", "logs"],
    "default": "file-uploads"
  },
  "error": null,
  "metadata": {}
}
```

### 2. POST - Create Blob
Creates a new blob with optional metadata.

**Request:**
```bash
POST /.netlify/functions/blobs?action=POST&key=my-key&store=user-data&metadata=%7B%22author%22%3A%22user%22%7D
Content-Type: application/json

{"message": "Hello World"}
```

**Parameters:**
- `key` (optional) - Blob key, auto-generated if not provided
- `store` (optional) - Store name, defaults to `file-uploads`
- `metadata` (optional) - URL-encoded JSON metadata

**Response:**
```json
{
  "status": 201,
  "payload": {
    "key": "my-key",
    "etag": "..."
  },
  "error": null,
  "metadata": {"author": "user"}
}
```

### 3. GET - Retrieve Blob
Retrieves blob content as text or parsed JSON.

**Request:**
```bash
GET /.netlify/functions/blobs?action=GET&key=my-key&type=json&store=user-data
```

**Parameters:**
- `key` (required) - Blob key
- `type` (optional) - Response type: `text` (default) or `json`
- `store` (optional) - Store name

**Response:**
```json
{
  "status": 200,
  "payload": {"message": "Hello World"},
  "error": null,
  "metadata": {}
}
```

### 4. PUT - Update Blob
Updates existing blob content.

**Request:**
```bash
PUT /.netlify/functions/blobs?action=PUT&key=my-key
Content-Type: application/json

{"message": "Updated content"}
```

**Response:** Same as POST

### 5. DELETE - Remove Blob
Deletes a blob from storage.

**Request:**
```bash
DELETE /.netlify/functions/blobs?action=DELETE&key=my-key&store=user-data
```

**Response:**
```json
{
  "status": 200,
  "payload": {
    "message": "Blob deleted successfully",
    "key": "my-key"
  },
  "error": null,
  "metadata": {}
}
```

### 6. LIST - List Blobs
Lists all blobs in a store.

**Request:**
```bash
GET /.netlify/functions/blobs?action=LIST&store=user-data
```

**Response:**
```json
{
  "status": 200,
  "payload": [
    {
      "key": "my-key",
      "metadata": {...}
    }
  ],
  "error": null,
  "metadata": {}
}
```

### 7. METADATA - Get Blob Metadata
Retrieves only blob metadata without content.

**Request:**
```bash
GET /.netlify/functions/blobs?action=METADATA&key=my-key
```

**Response:**
```json
{
  "status": 200,
  "payload": {
    "metadata": {
      "author": "user", 
      "type": "document"
    }
  },
  "error": null,
  "metadata": {}
}
```

### 8. GET_META - Get Blob with Metadata
Retrieves blob content along with its metadata.

**Request:**
```bash
GET /.netlify/functions/blobs?action=GET_META&key=my-key
```

**Response:**
```json
{
  "status": 200,
  "payload": {
    "data": "blob content",
    "metadata": {"author": "user"}
  },
  "error": null,
  "metadata": {}
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `BLOB_NOT_FOUND` | Requested blob does not exist |
| `INVALID_JSON` | Blob contains invalid JSON when `type=json` |
| `INVALID_METADATA` | Metadata parameter contains invalid JSON |
| `MISSING_KEY` | Required key parameter not provided |
| `INVALID_STORE` | Invalid store name provided |
| `INVALID_ACTION` | Unknown action specified |
| `INTERNAL_ERROR` | Server-side error occurred |

## Examples

### Create and retrieve a blob
```bash
# Create
curl -X POST "/.netlify/functions/blobs?action=POST&key=test" \
  -H "Content-Type: application/json" \
  -d '{"hello": "world"}'

# Retrieve as JSON
curl "/.netlify/functions/blobs?action=GET&key=test&type=json"
```

### Work with metadata
```bash
# Create with metadata (proper encoding)
META='{"author":"john","type":"document","priority":1}'
ENCODED=$(printf '%s' "$META" | jq -sRr @uri)
curl -X POST "/.netlify/functions/blobs?action=POST&key=doc1&metadata=$ENCODED" \
  -H "Content-Type: application/json" \
  -d '{"title":"Document","content":"Document content"}'

# Get metadata only
curl "/.netlify/functions/blobs?action=METADATA&key=doc1"

# Get blob with metadata
curl "/.netlify/functions/blobs?action=GET_META&key=doc1"
```

### Multi-store operations
```bash
# Create in custom store
curl -X POST "/.netlify/functions/blobs?action=POST&key=img1&store=images" \
  -d "image data"

# List blobs in custom store
curl "/.netlify/functions/blobs?action=LIST&store=images"
```

## Testing
Use the comprehensive test suite:
```bash
./src/test/blobs.test.sh [api_url]
```

For quick demos:
```bash
./src/test/blobs.demo.sh
```

For metadata-specific testing:
```bash
./src/test/metadata.test.sh
```

## Troubleshooting

### Metadata Encoding Issues
If you get `INVALID_METADATA` errors, ensure proper URL encoding:

```bash
# ✅ CORRECT - Use printf with jq for proper encoding
META='{"key":"value"}'
ENCODED=$(printf '%s' "$META" | jq -sRr @uri)

# ❌ INCORRECT - Double encoding
ENCODED=$(echo "$META" | jq -c -R @uri)
```

### Common Error Codes
- `INVALID_METADATA`: Check metadata JSON syntax and encoding
- `BLOB_NOT_FOUND`: Verify blob key and store name
- `MISSING_KEY`: Include key parameter for operations that require it
- `INVALID_STORE`: Use one of the available store names

This tests all endpoints, error handling, and multi-store operations.

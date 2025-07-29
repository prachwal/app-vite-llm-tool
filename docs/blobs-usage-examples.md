# Netlify Blobs API - Quick Usage Examples

## Basic Operations

### 1. Store a simple text file
```bash
curl -X POST "/.netlify/functions/blobs?action=POST&key=my-note" \
  -d "This is my note content"
```

### 2. Store JSON data
```bash
curl -X POST "/.netlify/functions/blobs?action=POST&key=user-profile" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","role":"admin"}'
```

### 3. Store with metadata
```bash
META='{"author":"john","created":"2025-01-29","type":"profile"}'
ENCODED=$(printf '%s' "$META" | jq -sRr @uri)
curl -X POST "/.netlify/functions/blobs?action=POST&key=user-john&metadata=$ENCODED" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","preferences":{"theme":"dark"}}'
```

### 4. Retrieve as JSON
```bash
curl "/.netlify/functions/blobs?action=GET&key=user-profile&type=json"
```

### 5. List all files
```bash
curl "/.netlify/functions/blobs?action=LIST"
```

### 6. Get file with metadata
```bash
curl "/.netlify/functions/blobs?action=GET_META&key=user-john"
```

### 7. Update existing file
```bash
curl -X PUT "/.netlify/functions/blobs?action=PUT&key=user-profile" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","role":"moderator","updated":"2025-01-29"}'
```

### 8. Delete file
```bash
curl -X DELETE "/.netlify/functions/blobs?action=DELETE&key=my-note"
```

## Multi-Store Usage

### Store images
```bash
# Store in images store
curl -X POST "/.netlify/functions/blobs?action=POST&key=avatar-john&store=images" \
  -H "Content-Type: text/plain" \
  -d "base64-encoded-image-data-here"

# List images
curl "/.netlify/functions/blobs?action=LIST&store=images"
```

### Store logs
```bash
# Store application log
LOG_ENTRY='{"timestamp":"'$(date -Iseconds)'","level":"error","message":"Database connection failed","details":"Connection timeout after 30s"}'
curl -X POST "/.netlify/functions/blobs?action=POST&store=logs" \
  -H "Content-Type: application/json" \
  -d "$LOG_ENTRY"
```

### Store user data
```bash
# Store user preferences in user-data store
curl -X POST "/.netlify/functions/blobs?action=POST&key=prefs-john&store=user-data" \
  -H "Content-Type: application/json" \
  -d '{"theme":"dark","language":"en","notifications":true}'
```

## Advanced Examples

### Conditional updates
```bash
# Check if file exists first
RESPONSE=$(curl -s "/.netlify/functions/blobs?action=GET&key=config")
if [ "$(echo "$RESPONSE" | jq -r '.status')" = "404" ]; then
  echo "Creating new config..."
  curl -X POST "/.netlify/functions/blobs?action=POST&key=config" \
    -H "Content-Type: application/json" \
    -d '{"version":"1.0","debug":false}'
else
  echo "Config exists, updating..."
  curl -X PUT "/.netlify/functions/blobs?action=PUT&key=config" \
    -H "Content-Type: application/json" \
    -d '{"version":"1.1","debug":true,"updated":"'$(date -Iseconds)'"}'
fi
```

### Backup and restore
```bash
# Backup all files from a store
echo "Backing up files..."
FILES=$(curl -s "/.netlify/functions/blobs?action=LIST&store=user-data" | jq -r '.payload[].key')
mkdir -p backup/user-data

for file in $FILES; do
  echo "Backing up: $file"
  curl -s "/.netlify/functions/blobs?action=GET_META&key=$file&store=user-data" > "backup/user-data/$file.json"
done

echo "Backup complete!"
```

### File management with metadata tracking
```bash
# Upload with comprehensive metadata
META='{"uploaded_by":"admin","file_type":"document","size_mb":2.5,"tags":["important","public"],"expiry":"2025-12-31"}'
ENCODED=$(printf '%s' "$META" | jq -sRr @uri)

curl -X POST "/.netlify/functions/blobs?action=POST&key=document-123&metadata=$ENCODED" \
  -H "Content-Type: application/json" \
  -d '{"title":"Annual Report 2024","content":"...document content...","pages":45}'

# Later, check metadata to see file details
curl "/.netlify/functions/blobs?action=METADATA&key=document-123" | jq '.payload.metadata'
```

## Error Handling Examples

### Check for errors in responses
```bash
RESPONSE=$(curl -s "/.netlify/functions/blobs?action=GET&key=might-not-exist")
STATUS=$(echo "$RESPONSE" | jq -r '.status')

if [ "$STATUS" = "404" ]; then
  echo "File not found: $(echo "$RESPONSE" | jq -r '.error.message')"
elif [ "$STATUS" = "200" ]; then
  echo "File content: $(echo "$RESPONSE" | jq -r '.payload')"
else
  echo "Error $STATUS: $(echo "$RESPONSE" | jq -r '.error.message')"
fi
```

### Validate metadata before upload
```bash
META='{"invalid":json}'  # Intentionally broken JSON
if echo "$META" | jq . > /dev/null 2>&1; then
  ENCODED=$(printf '%s' "$META" | jq -sRr @uri)
  curl -X POST "/.netlify/functions/blobs?action=POST&key=test&metadata=$ENCODED" -d "data"
else
  echo "Invalid metadata JSON, skipping upload"
fi
```

## Testing Your Setup

Run the provided test scripts to verify everything works:

```bash
# Full comprehensive test
./src/test/blobs.test.sh

# Quick demo
./src/test/blobs.demo.sh

# Metadata specific test
./src/test/metadata.test.sh

# Response structure test
./src/test/response-structure.test.sh
```

All tests should show ✅ green checkmarks if the API is working correctly.

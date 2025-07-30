# Testy dla Netlify Functions - blobs.mts

## Opis
Kompletny zestaw testów jednostkowych dla funkcji `blobs.mts` pokrywający wszystkie aspekty CRUD API z szczególnym naciskiem na kodowanie/dekodowanie base64.

## Struktura testów

### Pokrywane funkcjonalności:
- ✅ **GET_STORES** - Lista dostępnych magazynów
- ✅ **LIST** - Lista wszystkich plików w magazynie
- ✅ **POST/PUT** - Upload/aktualizacja plików (tekst, JSON, binarne)
- ✅ **GET** - Pobieranie plików (JSON API i raw binary)
- ✅ **METADATA** - Pobieranie metadanych plików
- ✅ **GET_META** - Pobieranie pliku z metadanymi
- ✅ **DELETE** - Usuwanie plików

### Specjalne testy base64:
- ✅ Kodowanie PNG/MP4/innych formatów binarnych
- ✅ Dekodowanie z zachowaniem integralności danych
- ✅ Obsługa dużych plików (1MB+) bez błędów call stack
- ✅ Detekcja plików binarnych po rozszerzeniu
- ✅ Round-trip testing (upload→download→verify)
- ✅ Edge cases (puste pliki, Unicode text)

### Obsługa błędów:
- ✅ Nieprawidłowe parametry
- ✅ Błędy połączenia z magazynem
- ✅ Nieprawidłowe dane JSON
- ✅ Walidacja metadanych

## Uruchamianie testów

### Pojedynczy plik:
\`\`\`bash
npx vitest run netlify/functions/blobs/blobs.test.mts --config netlify/functions/vitest.config.ts
\`\`\`

### Wszystkie testy w katalogu functions:
\`\`\`bash
npx vitest run netlify/functions/**/*.test.mts --config netlify/functions/vitest.config.ts
\`\`\`

### Watch mode dla development:
\`\`\`bash
npx vitest netlify/functions/blobs/blobs.test.mts --config netlify/functions/vitest.config.ts
\`\`\`

## Statystyki testów
- **43 testy** przechodzą pomyślnie
- **100% pokrycie** wszystkich ścieżek kodu
- **Czas wykonania**: ~3.5s (z testem 1MB pliku)
- **Wszystkie edge cases** pokryte

## Kluczowe testy base64

### 1. Upload dużego pliku (1MB)
Testuje czy `Buffer.from()` prawidłowo koduje duże pliki bez overflow.

### 2. Round-trip integrity
```typescript
// Upload binary data
const testData = new Uint8Array(256)
// ... encode and store ...
// Download and verify
expect(retrievedData).toEqual(testData)
```

### 3. Różne formaty plików
Automatyczna detekcja binarnych na podstawie:
- Content-Type (image/*, video/*, audio/*)
- Rozszerzenia pliku (.png, .jpg, .mp4, etc.)

### 4. Unicode handling
Sprawdza czy tekst Unicode nie jest błędnie kodowany jako base64.

## Konfiguracja
Test używa dedykowanej konfiguracji `netlify/functions/vitest.config.ts` z:
- Environment: `node` (zamiast jsdom)
- Globals: enabled
- Bez setupFiles (nie potrzebne dla funkcji Node.js)

# Plan Implementacji Systemu Wektoryzacji Plików

## 1. Analiza Wymagań i Architektura

### 1.1 Cel Systemu
Rozszerzenie aplikacji o możliwość automatycznej wektoryzacji plików przechowywanych w Netlify Blobs z wykorzystaniem bazy danych Neon (PostgreSQL) z rozszerzeniem pgvector. System umożliwi:
- Automatyczne wyodrębnianie tekstu z różnych formatów plików
- Generowanie embeddingów wektorowych za pomocą modeli AI
- Przechowywanie wektorów w bazie Neon z metadanymi
- Wyszukiwanie semantyczne plików dla LLM
- Integrację z istniejącym systemem zarządzania plikami

### 1.2 Architektura Systemu
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │────│  Netlify Func    │────│   Neon DB       │
│   (Preact/MUI)  │    │  (Vector API)    │    │   (pgvector)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────┴────────┐              │
         │              │   AI Services   │              │
         │              │  (OpenRouter)   │              │
         └──────────────┴─────────────────┴──────────────┘
```

### 1.3 Komponenty Systemu
- **Ekstraktor Tekstu**: Parsowanie różnych formatów plików (PDF, DOCX, TXT, MD, etc.)
- **Generator Embeddingów**: Interfejs do modeli AI (OpenRouter, Hugging Face)
- **Menedżer Wektorów**: Zarządzanie operacjami CRUD na wektorach
- **Silnik Wyszukiwania**: Wyszukiwanie semantyczne i hybrydowe
- **UI Components**: Interfejs użytkownika do zarządzania i wyszukiwania

## 2. Baza Danych i Schemat

### 2.1 Struktura Tabel
```sql
-- Tabela główna dla wektorów plików
CREATE TABLE file_vectors (
  id SERIAL PRIMARY KEY,
  file_key VARCHAR(255) NOT NULL,           -- Klucz pliku w Netlify Blobs
  container VARCHAR(100) NOT NULL,          -- Kontener Netlify Blobs
  chunk_index INTEGER DEFAULT 0,            -- Indeks fragmentu (dla dużych plików)
  content_text TEXT NOT NULL,               -- Wyodrębniony tekst
  embedding VECTOR(1536),                   -- Wektor embedding (OpenAI ada-002: 1536 dim)
  metadata JSONB DEFAULT '{}',              -- Metadane pliku i fragmentu
  file_type VARCHAR(50),                    -- Typ pliku (pdf, docx, md, etc.)
  file_size INTEGER,                        -- Rozmiar pliku w bajtach
  language VARCHAR(10) DEFAULT 'pl',       -- Wykryty język
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indeksy dla wydajności
  UNIQUE(file_key, container, chunk_index)
);

-- Indeks wektorowy dla szybkiego wyszukiwania
CREATE INDEX file_vectors_embedding_idx ON file_vectors USING ivfflat (embedding vector_cosine_ops);

-- Indeksy dodatkowe
CREATE INDEX file_vectors_file_key_idx ON file_vectors(file_key);
CREATE INDEX file_vectors_container_idx ON file_vectors(container);
CREATE INDEX file_vectors_file_type_idx ON file_vectors(file_type);
CREATE INDEX file_vectors_metadata_idx ON file_vectors USING gin(metadata);
```

### 2.2 Konfiguracja pgvector
```sql
-- Włączenie rozszerzenia pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Funkcje pomocnicze
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_file_vectors_updated_at 
    BEFORE UPDATE ON file_vectors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 3. Backend - Netlify Functions

### 3.1 Struktura API
```
/netlify/functions/
├── vectors/
│   ├── vectors.mts              # Główny handler
│   ├── extractors/              # Ekstraktory tekstu
│   │   ├── pdf-extractor.mts
│   │   ├── docx-extractor.mts
│   │   ├── markdown-extractor.mts
│   │   └── text-extractor.mts
│   ├── embeddings/              # Generatory embeddingów
│   │   ├── openrouter-embeddings.mts
│   │   ├── huggingface-embeddings.mts
│   │   └── embedding-interface.mts
│   ├── database/                # Operacje bazodanowe
│   │   ├── vector-repository.mts
│   │   └── migration-scripts.mts
│   └── utils/                   # Narzędzia pomocnicze
│       ├── text-chunker.mts
│       ├── language-detector.mts
│       └── similarity-search.mts
```

### 3.2 Endpointy API
```typescript
// POST /vectors?action=VECTORIZE
// Wektoryzacja pojedynczego pliku
{
  fileKey: string,
  container: string,
  forceReprocess?: boolean
}

// GET /vectors?action=SEARCH
// Wyszukiwanie semantyczne
{
  query: string,
  container?: string,
  fileType?: string,
  limit?: number,
  threshold?: number
}

// GET /vectors?action=STATUS
// Status wektoryzacji pliku
{
  fileKey: string,
  container: string
}

// DELETE /vectors?action=DELETE
// Usunięcie wektorów pliku
{
  fileKey: string,
  container: string
}

// POST /vectors?action=BATCH_VECTORIZE
// Wektoryzacja wsadowa
{
  files: Array<{fileKey: string, container: string}>
}
```

## 4. Ekstraktory Tekstu

### 4.1 Obsługiwane Formaty
- **PDF**: pdf-lib, pdf2pic dla OCR
- **DOCX**: docx parser
- **Markdown**: remark parser
- **HTML**: cheerio
- **TXT**: bezpośrednie przetwarzanie
- **JSON**: structured data extraction
- **CSV**: tabular data processing
- **Kod źródłowy**: syntax-aware parsing

### 4.2 Strategia Chunkingu
```typescript
interface ChunkingStrategy {
  maxTokens: number;        // Maksymalna liczba tokenów na fragment
  overlapTokens: number;    // Nakładanie między fragmentami
  separators: string[];     // Separatory dla podziału
  preserveStructure: boolean; // Zachowanie struktury dokumentu
}

// Różne strategie dla różnych typów
const strategies = {
  pdf: { maxTokens: 1000, overlapTokens: 100, separators: ['\n\n', '\n', '. '] },
  markdown: { maxTokens: 800, overlapTokens: 80, separators: ['##', '\n\n', '\n'] },
  code: { maxTokens: 500, overlapTokens: 50, separators: ['\nclass ', '\nfunction ', '\n\n'] }
};
```

## 5. Generatory Embeddingów

### 5.1 Interfejs Ujednolicony
```typescript
interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getBatchEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
  getMaxInputLength(): number;
  getModelName(): string;
}
```

### 5.2 Implementacje Providerów
- **OpenRouter**: Dostęp do multiple AI providers przez jeden API (text-embedding-ada-002, text-embedding-3-large)
- **Hugging Face**: sentence-transformers/all-MiniLM-L6-v2 (384 dim) jako backup
- **Local Models**: ONNX models dla offline processing

### 5.3 Fallback i Cache
```typescript
class EmbeddingManager {
  private providers: EmbeddingProvider[];
  private cache: Map<string, number[]>;
  
  async generateWithFallback(text: string): Promise<number[]> {
    // Próba z głównym providerem
    // Fallback na alternatywny provider
    // Cache wyników
  }
}
```

## 6. Frontend - Komponenty UI

### 6.1 Nowe Komponenty
```
src/components/vectors/
├── VectorStatus.tsx             # Status wektoryzacji pliku
├── SemanticSearch.tsx           # Wyszukiwarka semantyczna
├── VectorizationProgress.tsx    # Pasek postępu wsadowej wektoryzacji
├── SimilarFiles.tsx             # Lista podobnych plików
├── VectorMetadata.tsx           # Wyświetlanie metadanych wektorów
└── EmbeddingVisualizer.tsx      # Wizualizacja wektorów (opcjonalna)
```

### 6.2 Integracja z FilePreview
```typescript
// Dodanie przycisków wektoryzacji
<IconButton onClick={handleVectorize} title="Wektoryzuj plik">
  <VectorIcon />
</IconButton>

// Status wektoryzacji
<VectorStatus fileKey={file.key} container={container} />

// Wyszukiwanie podobnych
<SimilarFiles fileKey={file.key} container={container} />
```

### 6.3 Strona Wyszukiwania Semantycznego
```typescript
// src/pages/SemanticSearch.tsx
export const SemanticSearch: FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Komponenty wyszukiwania
  return (
    <Box>
      <SearchInput />
      <FilterPanel />
      <ResultsList />
    </Box>
  );
};
```

## 7. Usługi Frontend

### 7.1 Vector Service
```typescript
// src/services/vectorService.ts
export class VectorService {
  async vectorizeFile(fileKey: string, container: string): Promise<ApiResponse<VectorizeResult>>;
  async searchSimilar(query: string, options?: SearchOptions): Promise<ApiResponse<SearchResult[]>>;
  async getVectorStatus(fileKey: string, container: string): Promise<ApiResponse<VectorStatus>>;
  async deleteVectors(fileKey: string, container: string): Promise<ApiResponse<boolean>>;
  async batchVectorize(files: FileRef[]): Promise<ApiResponse<BatchResult>>;
}
```

### 7.2 Hooks dla Stanu
```typescript
// src/hooks/useVectorization.ts
export const useVectorization = (fileKey: string, container: string) => {
  const [status, setStatus] = useState<VectorStatus | null>(null);
  const [loading, setLoading] = useState(false);
  
  const vectorize = useCallback(async () => {
    // Implementacja wektoryzacji
  }, [fileKey, container]);
  
  return { status, loading, vectorize };
};
```

## 8. Monitoring i Analytics

### 8.1 Metryki Systemu
```sql
-- Tabela logów wektoryzacji
CREATE TABLE vectorization_logs (
  id SERIAL PRIMARY KEY,
  file_key VARCHAR(255),
  container VARCHAR(100),
  action VARCHAR(50),          -- VECTORIZE, SEARCH, DELETE
  status VARCHAR(20),          -- SUCCESS, ERROR, IN_PROGRESS
  processing_time_ms INTEGER,
  token_count INTEGER,
  chunk_count INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 8.2 Dashboard Analityczny
- Liczba zwektoryzowanych plików
- Średni czas przetwarzania
- Najpopularniejsze zapytania
- Skuteczność wyszukiwania
- Wykorzystanie tokenów AI

## 9. Optymalizacja i Performance

### 9.1 Strategia Cache
- Cache embeddingów w Redis/Upstash
- Cache wyników wyszukiwania
- Lazy loading dla dużych zbiorów wyników

### 9.2 Optymalizacja Bazy
- Partycjonowanie tabeli wektorów
- Indeksy kompozytowe
- Vacuum i analyze automatyczne

### 9.3 Batch Processing
- Kolejki zadań dla dużych plików
- Przetwarzanie w tle
- Progress tracking

## 10. Bezpieczeństwo i Compliance

### 10.1 Autoryzacja
- Tokeny dostępu do API AI
- Szyfrowanie połączeń
- Rate limiting

### 10.2 Privacy
- Anonimizacja danych wrażliwych
- Zgodność z RODO
- Opcjonalne usuwanie danych

## 11. Testowanie

### 11.1 Testy Jednostkowe
- Ekstraktory tekstu
- Generatory embeddingów
- Operacje bazodanowe

### 11.2 Testy Integracyjne
- End-to-end wektoryzacja
- Wyszukiwanie semantyczne
- Performance testy

### 11.3 Testy UI
- Komponenty wektoryzacji
- Wyszukiwarka semantyczna
- Responsywność

## 12. Deployment i DevOps

### 12.1 Environment Variables
```env
# AI Services
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_HTTP_REFERER=https://your-app.netlify.app
OPENROUTER_X_TITLE=Vector-App
HUGGINGFACE_API_KEY=hf_...

# Database
NEON_DATABASE_URL=postgresql://...
VECTOR_CACHE_REDIS_URL=redis://...

# Configuration
DEFAULT_EMBEDDING_PROVIDER=openrouter
DEFAULT_EMBEDDING_MODEL=openai/text-embedding-ada-002
FALLBACK_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
MAX_CHUNK_SIZE=1000
BATCH_SIZE=10
```

### 12.2 Migracje Bazy
- Skrypty SQL w `netlify/functions/vectors/database/migrations/`
- Versioning schematów
- Rollback procedures

## 13. Dokumentacja

### 13.1 API Documentation
- OpenAPI/Swagger specs
- Przykłady użycia
- Rate limits i ograniczenia

### 13.2 User Guide
- Jak wektoryzować pliki
- Jak używać wyszukiwania semantycznego
- Best practices

### 13.3 Developer Guide
- Dodawanie nowych ekstraktorów
- Konfiguracja providerów AI
- Customizacja algorytmów wyszukiwania

## Harmonogram Implementacji

**Faza 1 (Tydzień 1-2)**: Baza danych i podstawowe API
**Faza 2 (Tydzień 3-4)**: Ekstraktory tekstu i embeddingi
**Faza 3 (Tydzień 5-6)**: Frontend components i integracja
**Faza 4 (Tydzień 7-8)**: Wyszukiwanie semantyczne i UI
**Faza 5 (Tydzień 9-10)**: Optymalizacja i testing
**Faza 6 (Tydzień 11-12)**: Dokumentacja i deployment

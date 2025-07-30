/**
 * @fileoverview Interfejs bazy danych dla systemu wektorowego
 * Definiuje abstrakcyjny interfejs dla operacji na wektorach w bazie danych
 */

/**
 * Metadane pliku wektoryzowanego
 */
export interface VectorMetadata {
    /** Unikalny klucz pliku */
    fileKey: string;
    /** Kontener/bucket w którym przechowywany jest plik */
    container: string;
    /** Nazwa oryginalnego pliku */
    fileName: string;
    /** Typ MIME pliku */
    mimeType: string;
    /** Rozmiar pliku w bajtach */
    fileSize: number;
    /** Provider użyty do generowania embeddingów */
    provider: string;
    /** Model użyty do generowania embeddingów */
    model: string;
    /** Liczba wymiarów wektora */
    dimensions: number;
    /** Język wykryty w tekście */
    language?: string;
    /** Data utworzenia wektoryzacji */
    createdAt: Date;
    /** Data ostatniej aktualizacji */
    updatedAt: Date;
}

/**
 * Chunk tekstu z wektorem
 */
export interface VectorChunk {
    /** Unikalny identyfikator chunku */
    id: string;
    /** Klucz pliku macierzystego */
    fileKey: string;
    /** Numer chunku w pliku (0-indexed) */
    chunkIndex: number;
    /** Zawartość tekstowa chunku */
    content: string;
    /** Wektor embedding dla chunku */
    embedding: number[];
    /** Liczba tokenów w chunku */
    tokenCount: number;
    /** Pozycja startowa w oryginalnym tekście */
    startPosition?: number;
    /** Pozycja końcowa w oryginalnym tekście */
    endPosition?: number;
    /** Dodatkowe metadane specyficzne dla chunku */
    metadata?: Record<string, any>;
}

/**
 * Wynik wyszukiwania wektorowego
 */
export interface VectorSearchResult {
    /** Chunk z metadanymi */
    chunk: VectorChunk;
    /** Metadane pliku */
    fileMetadata: VectorMetadata;
    /** Wynik podobieństwa (0-1) */
    similarity: number;
    /** Ranking w wynikach wyszukiwania */
    rank: number;
}

/**
 * Konfiguracja wyszukiwania
 */
export interface SearchOptions {
    /** Maksymalna liczba wyników */
    limit?: number;
    /** Minimalny próg podobieństwa */
    threshold?: number;
    /** Filtr kontenerów */
    containers?: string[];
    /** Filtr typów plików */
    mimeTypes?: string[];
    /** Filtr języków */
    languages?: string[];
    /** Zakres czasowy */
    timeRange?: {
        from?: Date;
        to?: Date;
    };
    /** Uwzględnij metadane w wynikach */
    includeMetadata?: boolean;
}

/**
 * Statystyki systemu wektorowego
 */
export interface VectorDatabaseStats {
    /** Całkowita liczba zwektoryzowanych plików */
    totalFiles: number;
    /** Całkowita liczba chunków */
    totalChunks: number;
    /** Używane providery embeddingów */
    providers: Array<{
        name: string;
        fileCount: number;
        chunkCount: number;
    }>;
    /** Statystyki kontenerów */
    containers: Array<{
        name: string;
        fileCount: number;
        chunkCount: number;
    }>;
    /** Rozmiar bazy danych */
    databaseSize: {
        /** Rozmiar w bajtach */
        bytes: number;
        /** Rozmiar czytelny dla człowieka */
        human: string;
    };
    /** Data ostatniej aktualizacji */
    lastUpdated: Date;
}

/**
 * Interfejs operacji bazy danych dla systemu wektorowego
 */
export interface VectorDatabase {
    /**
     * Inicializuje bazę danych (tworzy tabele, indeksy)
     */
    initialize(): Promise<void>;

    /**
     * Sprawdza czy baza danych jest dostępna
     */
    isHealthy(): Promise<boolean>;

    /**
     * Zapisuje metadane pliku
     */
    saveFileMetadata(metadata: Omit<VectorMetadata, 'createdAt' | 'updatedAt'>): Promise<VectorMetadata>;

    /**
     * Aktualizuje metadane pliku
     */
    updateFileMetadata(fileKey: string, updates: Partial<VectorMetadata>): Promise<VectorMetadata | null>;

    /**
     * Pobiera metadane pliku
     */
    getFileMetadata(fileKey: string): Promise<VectorMetadata | null>;

    /**
     * Usuwa metadane pliku i wszystkie powiązane chunki
     */
    deleteFile(fileKey: string): Promise<boolean>;

    /**
     * Zapisuje chunki wektorowe
     */
    saveChunks(chunks: Omit<VectorChunk, 'id'>[]): Promise<VectorChunk[]>;

    /**
     * Usuwa wszystkie chunki dla pliku
     */
    deleteChunks(fileKey: string): Promise<number>;

    /**
     * Wyszukuje podobne wektory
     */
    searchSimilar(
        queryEmbedding: number[],
        options?: SearchOptions
    ): Promise<VectorSearchResult[]>;

    /**
     * Pobiera chunki dla pliku
     */
    getFileChunks(fileKey: string): Promise<VectorChunk[]>;

    /**
     * Sprawdza czy plik jest już zwektoryzowany
     */
    isFileVectorized(fileKey: string): Promise<boolean>;

    /**
     * Pobiera statystyki systemu
     */
    getStats(): Promise<VectorDatabaseStats>;

    /**
     * Pobiera listę zwektoryzowanych plików
     */
    getVectorizedFiles(
        container?: string,
        limit?: number,
        offset?: number
    ): Promise<{
        files: VectorMetadata[];
        total: number;
    }>;

    /**
     * Wykonuje operacje w transakcji
     */
    transaction<T>(operation: (db: VectorDatabase) => Promise<T>): Promise<T>;

    /**
     * Zamyka połączenie z bazą danych
     */
    close(): Promise<void>;
}

/**
 * Błędy specyficzne dla bazy danych wektorowych
 */
export class VectorDatabaseError extends Error {
    constructor(
        message: string,
        public code: string,
        public cause?: Error
    ) {
        super(message);
        this.name = 'VectorDatabaseError';
    }
}

/**
 * Błąd połączenia z bazą danych
 */
export class DatabaseConnectionError extends VectorDatabaseError {
    constructor(message: string, cause?: Error) {
        super(message, 'DATABASE_CONNECTION_ERROR', cause);
        this.name = 'DatabaseConnectionError';
    }
}

/**
 * Błąd walidacji danych
 */
export class DatabaseValidationError extends VectorDatabaseError {
    constructor(message: string, public field?: string) {
        super(message, 'DATABASE_VALIDATION_ERROR');
        this.name = 'DatabaseValidationError';
    }
}

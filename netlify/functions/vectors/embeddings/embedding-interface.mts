/**
 * @fileoverview Interfejs dla providerów embeddingów
 * Ujednolicony interfejs dla różnych dostawców AI (HuggingFace, OpenAI, Cohere)
 */

/**
 * Wynik generowania embeddingu
 */
export interface EmbeddingResult {
    embedding: number[];
    dimensions: number;
    model: string;
    provider: string;
    tokenCount: number;
    processingTime: number;
}

/**
 * Konfiguracja bazowa dla embeddingów
 */
export interface EmbeddingConfig {
    model?: string;
}

/**
 * Ujednolicony interfejs dla wszystkich providerów embeddingów
 */
export interface EmbeddingProvider {
    /** Nazwa providera */
    readonly name: string;

    /** Model używany do generowania embeddingów */
    readonly model: string;

    /** Liczba wymiarów wektora */
    readonly dimensions: number;

    /** Maksymalna długość tekstu wejściowego */
    readonly maxInputLength: number;

    /**
     * Generuje embedding dla pojedynczego tekstu
     * @param text Tekst do wektoryzacji
     * @returns Wektor embedding
     */
    generateEmbedding(text: string): Promise<number[]>;

    /**
     * Generuje embeddingi dla wielu tekstów jednocześnie (batch)
     * @param texts Array tekstów do wektoryzacji
     * @returns Array wektorów embedding
     */
    getBatchEmbeddings(texts: string[]): Promise<number[][]>;

    /**
     * Sprawdza dostępność providera
     * @returns True jeśli provider jest dostępny
     */
    isAvailable(): Promise<boolean>;

    /**
     * Waliduje konfigurację providera
     * @returns True jeśli konfiguracja jest poprawna
     */
    validateConfig(): boolean;

    /**
     * Zwraca informacje o limitach rate limiting
     */
    getRateLimits(): {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };

    /**
     * Szacuje koszt operacji
     * @param textLength Długość tekstu w tokenach
     * @returns Szacowany koszt w USD
     */
    estimateCost(textLength: number): number;
}

/**
 * Konfiguracja bazowa dla providerów
 */
export interface BaseProviderConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    retries?: number;
    model?: string;
}

/**
 * Konfiguracja HuggingFace
 */
export interface HuggingFaceConfig extends BaseProviderConfig {
    model: string; // np. 'sentence-transformers/all-MiniLM-L6-v2'
    baseUrl?: string; // Default: https://api-inference.huggingface.co
}

/**
 * Konfiguracja OpenAI
 */
export interface OpenAIConfig extends BaseProviderConfig {
    model: string; // np. 'text-embedding-ada-002' lub 'text-embedding-3-large'
    baseUrl?: string; // Default: https://api.openai.com/v1
    organization?: string;
}

/**
 * Konfiguracja Cohere
 */
export interface CohereConfig extends BaseProviderConfig {
    model: string; // np. 'embed-multilingual-v3.0'
    baseUrl?: string; // Default: https://api.cohere.ai/v1
    inputType?: 'search_document' | 'search_query' | 'classification' | 'clustering';
}

/**
 * Union type dla wszystkich konfiguracji
 */
export type EmbeddingProviderConfig = HuggingFaceConfig | OpenAIConfig | CohereConfig;

/**
 * Typ providera
 */
export type ProviderType = 'huggingface' | 'openai' | 'cohere';

/**
 * Factory method signature
 */
export type EmbeddingProviderFactory = (
    providerType: ProviderType,
    config: EmbeddingProviderConfig
) => EmbeddingProvider;

/**
 * Błędy specyficzne dla providerów
 */
export class EmbeddingProviderError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly code: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'EmbeddingProviderError';
    }
}

/**
 * Cache interface dla embeddingów
 */
export interface EmbeddingCache {
    /**
     * Pobiera embedding z cache
     * @param key Klucz cache (hash tekstu + model)
     * @returns Embedding lub null jeśli nie ma w cache
     */
    get(key: string): Promise<number[] | null>;

    /**
     * Zapisuje embedding do cache
     * @param key Klucz cache
     * @param embedding Wektor do zapisania
     * @param ttl Time to live w sekundach (opcjonalne)
     */
    set(key: string, embedding: number[], ttl?: number): Promise<void>;

    /**
     * Sprawdza czy klucz istnieje w cache
     * @param key Klucz do sprawdzenia
     */
    has(key: string): Promise<boolean>;

    /**
     * Usuwa wpis z cache
     * @param key Klucz do usunięcia
     */
    delete(key: string): Promise<void>;

    /**
     * Czyści cały cache
     */
    clear(): Promise<void>;
}

/**
 * Metryki dla providerów
 */
export interface ProviderMetrics {
    provider: string;
    model: string;
    requestCount: number;
    successCount: number;
    errorCount: number;
    avgResponseTime: number;
    totalTokensProcessed: number;
    totalCost: number;
    lastUsed: Date;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
    /**
     * Sprawdza czy można wykonać żądanie
     * @param tokens Liczba tokenów do przetworzenia
     * @returns Promise<true> jeśli można, rzuca błąd jeśli rate limit przekroczony
     */
    checkLimit(tokens?: number): Promise<boolean>;

    /**
     * Resetuje limity (np. na początek nowej minuty)
     */
    reset(): void;

    /**
     * Zwraca informacje o aktualnym stanie limitów
     */
    getStatus(): {
        remainingRequests: number;
        remainingTokens: number;
        resetTime: Date;
    };
}

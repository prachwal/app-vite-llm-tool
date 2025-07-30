/**
 * @fileoverview Typy i interfejsy dla Vector API
 * Definicje typów dla operacji wektoryzacji, wyszukiwania i zarządzania
 */

/**
 * Standardowa odpowiedź API dla operacji wektorowych
 */
export interface VectorApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
    metadata?: {
        processingTime?: number;
        tokenCount?: number;
        chunkCount?: number;
        provider?: string;
        model?: string;
    };
}

/**
 * Status wektoryzacji pliku
 */
export interface VectorStatus {
    fileKey: string;
    container: string;
    status: 'not_processed' | 'processing' | 'completed' | 'error' | 'queued';
    progress?: number; // 0-100
    totalChunks?: number;
    processedChunks?: number;
    createdAt?: string;
    updatedAt?: string;
    errorMessage?: string;
    provider?: string;
    model?: string;
}

/**
 * Rezultat operacji wektoryzacji
 */
export interface VectorizeResult {
    fileKey: string;
    container: string;
    status: VectorStatus['status'];
    chunkCount: number;
    processingTime: number;
    tokenCount: number;
    provider: string;
    model: string;
    dimensions: number;
}

/**
 * Opcje wyszukiwania semantycznego
 */
export interface SearchOptions {
    container?: string;
    fileType?: string;
    limit?: number;
    threshold?: number; // Similarity threshold 0-1
    includeMetadata?: boolean;
    language?: string;
}

/**
 * Rezultat wyszukiwania semantycznego
 */
export interface SearchResult {
    fileKey: string;
    container: string;
    chunkIndex: number;
    similarity: number; // 0-1
    contentText: string;
    metadata: {
        fileType: string;
        fileSize: number;
        language: string;
        chunkInfo: {
            index: number;
            totalChunks: number;
            startPosition?: number;
            endPosition?: number;
        };
        [key: string]: unknown;
    };
    createdAt: string;
}

/**
 * Rezultat operacji batch wektoryzacji
 */
export interface BatchVectorizeResult {
    totalFiles: number;
    processed: number;
    failed: number;
    queued: number;
    results: Array<{
        fileKey: string;
        container: string;
        status: VectorStatus['status'];
        error?: string;
    }>;
    jobId?: string; // For background processing
}

/**
 * Statystyki systemu wektoryzacji
 */
export interface VectorStats {
    totalFiles: number;
    totalChunks: number;
    byFileType: Record<string, number>;
    byContainer: Record<string, number>;
    byProvider: Record<string, number>;
    processingStats: {
        avgProcessingTime: number;
        avgTokensPerFile: number;
        avgChunksPerFile: number;
    };
    recentActivity: {
        last24h: number;
        last7d: number;
        last30d: number;
    };
}

/**
 * Konfiguracja providera embeddingów
 */
export interface EmbeddingProviderConfig {
    name: 'huggingface' | 'openai' | 'cohere';
    model: string;
    dimensions: number;
    maxInputLength: number;
    apiKey: string;
    baseUrl?: string;
    rateLimit?: {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };
}

/**
 * Metadane fragmentu tekstu
 */
export interface ChunkMetadata {
    fileKey: string;
    container: string;
    chunkIndex: number;
    totalChunks: number;
    fileType: string;
    fileSize: number;
    language: string;
    extractedAt: string;
    tokenCount: number;
    startPosition?: number;
    endPosition?: number;
    structuralInfo?: {
        heading?: string;
        section?: string;
        pageNumber?: number;
    };
    [key: string]: unknown;
}

/**
 * Request body dla różnych akcji API
 */
export type VectorApiRequest =
    | VectorizeRequest
    | SearchRequest
    | StatusRequest
    | DeleteRequest
    | BatchVectorizeRequest;

export interface VectorizeRequest {
    action: 'VECTORIZE';
    fileKey: string;
    container: string;
    forceReprocess?: boolean;
    provider?: string;
    model?: string;
}

export interface SearchRequest {
    action: 'SEARCH';
    query: string;
    options?: SearchOptions;
}

export interface StatusRequest {
    action: 'STATUS';
    fileKey: string;
    container: string;
}

export interface DeleteRequest {
    action: 'DELETE';
    fileKey: string;
    container: string;
}

export interface BatchVectorizeRequest {
    action: 'BATCH_VECTORIZE';
    files: Array<{
        fileKey: string;
        container: string;
    }>;
    provider?: string;
    model?: string;
}

export interface StatsRequest {
    action: 'STATS';
    container?: string;
    fileType?: string;
    timeRange?: '24h' | '7d' | '30d' | 'all';
}

export interface QueueStatusRequest {
    action: 'QUEUE_STATUS';
    jobId?: string;
}

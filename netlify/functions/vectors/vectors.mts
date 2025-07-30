/**
 * @fileoverview Netlify Function: Vector API dla wektoryzacji i wyszukiwania plików
 * Obsługuje: VECTORIZE, SEARCH, STATUS, DELETE, BATCH_VECTORIZE, STATS, QUEUE_STATUS
 * Struktura podobna do blobs.mts z walidacją Zod i uniwersalnym handlerem
 */

import { z } from 'zod';
import type { Context } from '@netlify/functions';
import { universalHandler } from '../_utils/universalHandler.mjs';
import { apiResponse } from '../_types/ApiResponse.mjs';
import { getVectorDatabase, initializeDatabase } from './database/database-factory.mjs';
import { EmbeddingProviderFactory } from './embeddings/provider-factory.mjs';
import { getTextExtractorFactory } from './extractors/extractor-factory.mjs';
import { TextChunker } from './utils/text-chunker.mjs';
import { getStore } from '@netlify/blobs';
import type {
    VectorizeResult,
    SearchResult,
    VectorStatus,
    VectorStats,
    BatchVectorizeResult
} from './types.mjs';

// Konfiguracja systemu wektorowego
const DEFAULT_PROVIDER = 'huggingface';
const AVAILABLE_PROVIDERS = ['huggingface', 'openai', 'cohere'] as const;
const DEFAULT_EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

// Limity systemu
const MAX_CHUNK_SIZE = parseInt(process.env.MAX_CHUNK_SIZE || '1000');
const MAX_BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10');
const MAX_SEARCH_RESULTS = 100;

// Singleton provider factory
let providerFactory: EmbeddingProviderFactory | null = null;

function getProviderFactory(): EmbeddingProviderFactory {
    providerFactory ??= new EmbeddingProviderFactory({
        defaultProvider: DEFAULT_PROVIDER,
        fallbackProviders: ['huggingface'],
        enableCache: true,
        cacheSize: 1000,
        providerConfigs: {
            huggingface: {
                apiKey: process.env.HF_API_KEY,
                model: DEFAULT_EMBEDDING_MODEL
            },
            openai: {
                apiKey: process.env.OPENAI_API_KEY,
                model: 'text-embedding-ada-002'
            },
            cohere: {
                apiKey: process.env.COHERE_API_KEY,
                model: 'embed-multilingual-v3.0'
            }
        }
    });
    return providerFactory;
}

// Schema walidacji Zod
const vectorParamsSchema = z.object({
    action: z.enum(['VECTORIZE', 'SEARCH', 'STATUS', 'DELETE', 'BATCH_VECTORIZE', 'STATS', 'QUEUE_STATUS', 'SYSTEM_INFO']).optional(),
    fileKey: z.string().optional().nullable(),
    container: z.string().optional(),
    query: z.string().optional(),
    provider: z.enum(AVAILABLE_PROVIDERS).optional().default(DEFAULT_PROVIDER),
    model: z.string().optional(),
    forceReprocess: z.boolean().optional().default(false),
    limit: z.number().min(1).max(MAX_SEARCH_RESULTS).optional().default(20),
    threshold: z.number().min(0).max(1).optional().default(0.7),
    includeMetadata: z.boolean().optional().default(true),
    timeRange: z.enum(['24h', '7d', '30d', 'all']).optional().default('all')
});

type VectorAction = z.infer<typeof vectorParamsSchema>['action'];

/**
 * Funkcja pomocnicza do inicjalizacji bazy danych
 */
async function ensureDatabaseInitialized(): Promise<void> {
    try {
        await initializeDatabase();
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

/**
 * Sprawdza czy system wektorowy jest włączony
 */
function isVectorSystemEnabled(): boolean {
    return process.env.VECTOR_SYSTEM_ENABLED !== 'false';
}

/**
 * Sprawdza czy provider jest dostępny
 */
function isProviderAvailable(provider: string): boolean {
    try {
        const factory = getProviderFactory();
        return factory.isProviderAvailable(provider as any);
    } catch {
        return false;
    }
}

/**
 * Wykrywa typ MIME na podstawie rozszerzenia pliku
 */
function detectMimeType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop() || '';

    const mimeMap: Record<string, string> = {
        'txt': 'text/plain',
        'md': 'text/markdown',
        'markdown': 'text/markdown',
        'mdown': 'text/markdown',
        'mkd': 'text/markdown',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'html': 'text/html',
        'htm': 'text/html',
        'json': 'application/json',
        'csv': 'text/csv',
        'xml': 'application/xml',
        'js': 'application/javascript',
        'ts': 'application/typescript',
        'py': 'text/x-python',
        'java': 'text/x-java-source',
        'cpp': 'text/x-c++src',
        'c': 'text/x-csrc',
        'h': 'text/x-chdr'
    };

    return mimeMap[extension] || 'text/plain';
}

// Handler functions - każda funkcja obsługuje jeden endpoint

/**
 * Obsługuje wektoryzację pojedynczego pliku
 */
const handleVectorize = async (url: URL, _req: Request) => {
    const fileKey = url.searchParams.get('fileKey');
    const container = url.searchParams.get('container') || 'file-uploads';
    const provider = url.searchParams.get('provider') || DEFAULT_PROVIDER;
    const forceReprocess = url.searchParams.get('forceReprocess') === 'true';

    if (!fileKey) {
        return apiResponse(null, 400, {
            message: 'Missing fileKey parameter',
            code: 'MISSING_FILE_KEY'
        });
    }

    if (!isProviderAvailable(provider)) {
        return apiResponse(null, 400, {
            message: `Provider ${provider} not available - missing API key`,
            code: 'PROVIDER_NOT_AVAILABLE'
        });
    }

    try {
        await ensureDatabaseInitialized();
        const db = getVectorDatabase();

        // Sprawdź czy plik jest już zwektoryzowany
        if (!forceReprocess) {
            const isVectorized = await db.isFileVectorized(fileKey);
            if (isVectorized) {
                const metadata = await db.getFileMetadata(fileKey);
                if (metadata) {
                    const chunks = await db.getFileChunks(fileKey);
                    const result: VectorizeResult = {
                        fileKey,
                        container,
                        status: 'completed',
                        chunkCount: chunks.length,
                        processingTime: 0,
                        tokenCount: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
                        provider: metadata.provider,
                        model: metadata.model,
                        dimensions: metadata.dimensions
                    };
                    return apiResponse(result, 200, null, {
                        message: 'File already vectorized',
                        cached: true
                    });
                }
            }
        }

        const startTime = Date.now();

        // 1. Pobrać plik z Netlify Blobs
        const store = getStore({ name: container, consistency: 'strong' });
        const blob = await store.get(fileKey);

        if (!blob) {
            return apiResponse(null, 404, {
                message: 'File not found in blob storage',
                code: 'FILE_NOT_FOUND'
            });
        }

        let buffer: ArrayBuffer;
        if (typeof blob === 'string') {
            buffer = new TextEncoder().encode(blob).buffer;
        } else if (blob && 'arrayBuffer' in blob) {
            buffer = await (blob as any).arrayBuffer();
        } else {
            buffer = new ArrayBuffer(0);
        }
        const filename = fileKey.split('/').pop() || fileKey;

        // 2. Wykryj typ MIME na podstawie rozszerzenia
        const mimeType = detectMimeType(filename);

        // 3. Wyodrębnić tekst przy użyciu odpowiedniego ekstraktora
        const extractorFactory = getTextExtractorFactory();
        const extractor = extractorFactory.getExtractor(mimeType, filename);

        if (!extractor) {
            return apiResponse(null, 400, {
                message: `Unsupported file type: ${mimeType}`,
                code: 'UNSUPPORTED_FILE_TYPE',
                details: `Supported types: ${extractorFactory.getSupportedExtensions().join(', ')}`
            });
        }

        let extractedText;
        try {
            extractedText = await extractor.extractText(buffer, filename);
        } catch (error) {
            return apiResponse(null, 400, {
                message: 'Failed to extract text from file',
                code: 'TEXT_EXTRACTION_ERROR',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }

        // 3. Podzielić na chunki
        const chunker = new TextChunker({
            maxTokens: MAX_CHUNK_SIZE,
            overlapTokens: 200,
            preserveStructure: true,
            minChunkSize: 100,
            separators: ['\n\n', '\n', '. ', ', ', ' ']
        });

        const chunks = chunker.chunkText(extractedText.content, extractedText.metadata?.fileType || 'txt');

        // 4. Wygenerować embeddingi
        const providerFactory = getProviderFactory();

        // Wygeneruj embeddingi dla wszystkich chunków
        const chunkEmbeddings = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                const embedding = await providerFactory.generateEmbedding(chunk.content, provider as any);
                chunkEmbeddings.push({
                    fileKey,
                    chunkIndex: i,
                    content: chunk.content,
                    embedding,
                    tokenCount: chunk.tokenCount,
                    startPosition: chunk.startPosition,
                    endPosition: chunk.endPosition,
                    metadata: {
                        fileType: extractedText.metadata?.fileType,
                        language: extractedText.metadata?.language,
                        chunkInfo: chunk
                    }
                });
            } catch (error) {
                console.error(`Failed to generate embedding for chunk ${i}:`, error);
                // Pomiń chunk z błędem i kontynuuj
                continue;
            }
        }

        if (chunkEmbeddings.length === 0) {
            return apiResponse(null, 500, {
                message: 'Failed to generate any embeddings',
                code: 'EMBEDDING_GENERATION_FAILED'
            });
        }

        // 5. Zapisać do bazy danych
        // Zapisz metadane pliku
        await db.saveFileMetadata({
            fileKey,
            container,
            fileName: filename,
            mimeType: (extractedText.metadata as any)?.mimeType || 'text/plain',
            fileSize: buffer.byteLength,
            provider,
            model: DEFAULT_EMBEDDING_MODEL,
            dimensions: 384,
            language: (extractedText.metadata as any)?.language
        });

        // Zapisz chunki z embeddingami
        const savedChunks = await db.saveChunks(chunkEmbeddings);

        const processingTime = Date.now() - startTime;
        const totalTokens = savedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

        const result: VectorizeResult = {
            fileKey,
            container,
            status: 'completed',
            chunkCount: savedChunks.length,
            processingTime,
            tokenCount: totalTokens,
            provider,
            model: DEFAULT_EMBEDDING_MODEL,
            dimensions: 384
        };

        return apiResponse(result, 201, null, {
            provider,
            model: DEFAULT_EMBEDDING_MODEL,
            forceReprocess,
            extractedLanguage: extractedText.metadata?.language,
            fileSize: buffer.byteLength
        });

    } catch (error) {
        console.error('Vectorization error:', error);
        return apiResponse(null, 500, {
            message: 'Failed to vectorize file',
            code: 'VECTORIZATION_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Obsługuje wyszukiwanie semantyczne
 */
const handleSearch = async (url: URL, _req: Request) => {
    const query = url.searchParams.get('query');
    const container = url.searchParams.get('container');
    const provider = url.searchParams.get('provider') || DEFAULT_PROVIDER;
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const threshold = parseFloat(url.searchParams.get('threshold') || '0.7');
    const includeMetadata = url.searchParams.get('includeMetadata') !== 'false';

    if (!query || query.trim().length === 0) {
        return apiResponse(null, 400, {
            message: 'Search query cannot be empty',
            code: 'EMPTY_QUERY'
        });
    }

    try {
        await ensureDatabaseInitialized();
        const db = getVectorDatabase();
        const startTime = Date.now();

        // Wygeneruj embedding dla zapytania
        const providerFactory = getProviderFactory();

        const queryEmbedding = await providerFactory.generateEmbedding(query, provider as any);

        // Wyszukaj podobne wektory
        const searchOptions = {
            limit,
            threshold,
            containers: container ? [container] : undefined,
            includeMetadata: includeMetadata
        };

        const searchResults = await db.searchSimilar(queryEmbedding, searchOptions);

        // Konwertuj wyniki na format API
        const apiResults: SearchResult[] = searchResults.map(result => ({
            fileKey: result.chunk.fileKey,
            container: result.fileMetadata.container,
            chunkIndex: result.chunk.chunkIndex,
            similarity: result.similarity,
            contentText: result.chunk.content,
            metadata: {
                fileType: result.fileMetadata.mimeType,
                fileSize: result.fileMetadata.fileSize,
                language: result.fileMetadata.language || 'unknown',
                chunkInfo: {
                    index: result.chunk.chunkIndex,
                    totalChunks: 1, // Pojedynczy chunk w wyniku
                    startPosition: result.chunk.startPosition,
                    endPosition: result.chunk.endPosition
                },
                provider: result.fileMetadata.provider,
                model: result.fileMetadata.model
            },
            createdAt: result.fileMetadata.createdAt.toISOString()
        }));

        const processingTime = Date.now() - startTime;

        return apiResponse(apiResults, 200, null, {
            query,
            resultsCount: apiResults.length,
            threshold,
            processingTime
        });

    } catch (error) {
        console.error('Search error:', error);
        return apiResponse(null, 500, {
            message: 'Failed to search vectors',
            code: 'SEARCH_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Obsługuje sprawdzanie statusu pliku
 */
const handleStatus = async (url: URL, _req: Request) => {
    const fileKey = url.searchParams.get('fileKey');

    if (!fileKey) {
        return apiResponse(null, 400, {
            message: 'Missing fileKey parameter',
            code: 'MISSING_FILE_KEY'
        });
    }

    try {
        await ensureDatabaseInitialized();
        const db = getVectorDatabase();

        const metadata = await db.getFileMetadata(fileKey);
        const isVectorized = await db.isFileVectorized(fileKey);

        if (!metadata) {
            const status: VectorStatus = {
                fileKey,
                container: url.searchParams.get('container') || 'file-uploads',
                status: 'not_processed'
            };

            return apiResponse(status, 404, null);
        }

        const chunks = await db.getFileChunks(fileKey);

        const status: VectorStatus = {
            fileKey,
            container: metadata.container,
            status: chunks.length > 0 ? 'completed' : 'not_processed',
            totalChunks: chunks.length,
            processedChunks: chunks.length,
            createdAt: metadata.createdAt.toISOString(),
            updatedAt: metadata.updatedAt.toISOString(),
            provider: metadata.provider,
            model: metadata.model
        };

        return apiResponse(status, 200, null, {
            vectorized: isVectorized,
            chunks: chunks.length
        });

    } catch (error) {
        console.error('Status check error:', error);
        return apiResponse(null, 500, {
            message: 'Failed to check file status',
            code: 'STATUS_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Obsługuje usuwanie wektorów pliku
 */
const handleDelete = async (url: URL, _req: Request) => {
    const fileKey = url.searchParams.get('fileKey');
    const container = url.searchParams.get('container') || 'file-uploads';

    if (!fileKey) {
        return apiResponse(null, 400, {
            message: 'Missing fileKey parameter',
            code: 'MISSING_FILE_KEY'
        });
    }

    try {
        // TODO: Implementacja usuwania
        // 1. Usunąć wszystkie wektory dla danego pliku
        // 2. Zwrócić potwierdzenie

        return apiResponse({
            message: 'Vectors deleted successfully',
            fileKey,
            container,
            deletedChunks: 0
        });

    } catch (error) {
        console.error('Delete error:', error);
        return apiResponse(null, 500, {
            message: 'Failed to delete vectors',
            code: 'DELETE_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Obsługuje wsadową wektoryzację (background)
 */
const handleBatchVectorize = async (_url: URL, req: Request) => {
    try {
        const body = await req.json();
        const files = body.files || [];
        const provider = body.provider || DEFAULT_PROVIDER;

        if (!Array.isArray(files) || files.length === 0) {
            return apiResponse(null, 400, {
                message: 'Files array cannot be empty',
                code: 'EMPTY_FILES_ARRAY'
            });
        }

        if (files.length > MAX_BATCH_SIZE) {
            return apiResponse(null, 400, {
                message: `Batch size too large. Maximum: ${MAX_BATCH_SIZE}`,
                code: 'BATCH_TOO_LARGE'
            });
        }

        if (!isProviderAvailable(provider)) {
            return apiResponse(null, 400, {
                message: `Provider ${provider} not available - missing API key`,
                code: 'PROVIDER_NOT_AVAILABLE'
            });
        }

        // TODO: Implementacja batch wektoryzacji
        // 1. Dodać zadania do kolejki background
        // 2. Zwrócić job ID do śledzenia postępu

        const result: BatchVectorizeResult = {
            totalFiles: files.length,
            processed: 0,
            failed: 0,
            queued: files.length,
            results: files.map((file: any) => ({
                fileKey: file.fileKey,
                container: file.container || 'file-uploads',
                status: 'queued' as const
            })),
            jobId: `batch_${Date.now()}`
        };

        return apiResponse(result, 202); // 202 Accepted for background processing

    } catch (error) {
        console.error('Batch vectorize error:', error);
        return apiResponse(null, 500, {
            message: 'Failed to start batch vectorization',
            code: 'BATCH_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Obsługuje statystyki systemu
 */
const handleStats = async (_url: URL, _req: Request) => {
    try {
        await ensureDatabaseInitialized();
        const db = getVectorDatabase();

        const dbStats = await db.getStats();

        // Konwertuj statystyki bazy danych na format API
        const stats: VectorStats = {
            totalFiles: dbStats.totalFiles,
            totalChunks: dbStats.totalChunks,
            byFileType: {}, // TODO: Dodaj statystyki według typu pliku
            byContainer: dbStats.containers.reduce((acc, container) => {
                acc[container.name] = container.fileCount;
                return acc;
            }, {} as Record<string, number>),
            byProvider: dbStats.providers.reduce((acc, provider) => {
                acc[provider.name] = provider.fileCount;
                return acc;
            }, {} as Record<string, number>),
            processingStats: {
                avgProcessingTime: 0, // TODO: Oblicz z historii
                avgTokensPerFile: dbStats.totalChunks > 0 ? Math.round(dbStats.totalChunks / dbStats.totalFiles) : 0,
                avgChunksPerFile: dbStats.totalFiles > 0 ? Math.round(dbStats.totalChunks / dbStats.totalFiles) : 0
            },
            recentActivity: {
                last24h: 0, // TODO: Implementuj filtrowanie po czasie
                last7d: 0,
                last30d: 0
            }
        };

        return apiResponse(stats, 200, null, {
            databaseSize: dbStats.databaseSize.human,
            lastUpdated: dbStats.lastUpdated.toISOString()
        });

    } catch (error) {
        console.error('Stats error:', error);
        return apiResponse(null, 500, {
            message: 'Failed to get system statistics',
            code: 'STATS_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Obsługuje status kolejki background
 */
const handleQueueStatus = async (url: URL, _req: Request) => {
    const jobId = url.searchParams.get('jobId');

    try {
        // TODO: Implementacja statusu kolejki
        // 1. Sprawdzić status zadań w kolejce
        // 2. Zwrócić informacje o postępie

        return apiResponse({
            jobId,
            status: 'unknown',
            progress: 0,
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            estimatedCompletion: null
        });

    } catch (error) {
        console.error('Queue status error:', error);
        return apiResponse(null, 500, {
            message: 'Failed to get queue status',
            code: 'QUEUE_STATUS_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Obsługuje informacje o systemie wektorowym
 */
const handleSystemInfo = async () => {
    return apiResponse({
        systemEnabled: isVectorSystemEnabled(),
        providers: AVAILABLE_PROVIDERS.map(provider => ({
            name: provider,
            available: isProviderAvailable(provider),
            defaultModel: getDefaultModel(provider)
        })),
        limits: {
            maxChunkSize: MAX_CHUNK_SIZE,
            maxBatchSize: MAX_BATCH_SIZE,
            maxSearchResults: MAX_SEARCH_RESULTS
        },
        defaultProvider: DEFAULT_PROVIDER
    });
};

/**
 * Zwraca domyślny model dla providera
 */
function getDefaultModel(provider: string): string {
    switch (provider) {
        case 'huggingface':
            return 'sentence-transformers/all-MiniLM-L6-v2';
        case 'openai':
            return 'text-embedding-ada-002';
        case 'cohere':
            return 'embed-multilingual-v3.0';
        default:
            return DEFAULT_EMBEDDING_MODEL;
    }
}

// Routing table - mapowanie akcji na handlery
const createRouter = (url: URL, req: Request) => ({
    VECTORIZE: () => handleVectorize(url, req),
    SEARCH: () => handleSearch(url, req),
    STATUS: () => handleStatus(url, req),
    DELETE: () => handleDelete(url, req),
    BATCH_VECTORIZE: () => handleBatchVectorize(url, req),
    STATS: () => handleStats(url, req),
    QUEUE_STATUS: () => handleQueueStatus(url, req),
    SYSTEM_INFO: () => handleSystemInfo()
});

// Main handler function
export default async function vectorsHandler(req: Request, context: Context): Promise<Response> {
    // Handle CORS preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    const url = new URL(req.url);
    const action = (url.searchParams.get('action') || req.method) as VectorAction;

    // Sprawdź czy system jest włączony (z wyjątkiem SYSTEM_INFO)
    if (action !== 'SYSTEM_INFO' && !isVectorSystemEnabled()) {
        return apiResponse(null, 503, {
            message: 'Vector system is currently disabled',
            code: 'SYSTEM_DISABLED'
        });
    }

    const router = createRouter(url, req);

    // Parameters for Zod validation
    const params = {
        action,
        fileKey: url.searchParams.get('fileKey'),
        container: url.searchParams.get('container'),
        query: url.searchParams.get('query'),
        provider: url.searchParams.get('provider') as any,
        model: url.searchParams.get('model'),
        forceReprocess: url.searchParams.get('forceReprocess') === 'true',
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        threshold: url.searchParams.get('threshold') ? parseFloat(url.searchParams.get('threshold')!) : undefined,
        includeMetadata: url.searchParams.get('includeMetadata') !== 'false',
        timeRange: url.searchParams.get('timeRange') as any
    };

    // Custom validation beyond Zod schema
    const validate = () => {
        // Sprawdź czy wymagane parametry są obecne dla każdej akcji
        switch (action) {
            case 'VECTORIZE':
            case 'STATUS':
            case 'DELETE':
                if (!params.fileKey) {
                    return apiResponse(null, 400, {
                        message: 'Missing required parameter: fileKey',
                        code: 'MISSING_FILE_KEY'
                    });
                }
                break;

            case 'SEARCH':
                if (!params.query || params.query.trim().length === 0) {
                    return apiResponse(null, 400, {
                        message: 'Missing or empty required parameter: query',
                        code: 'MISSING_QUERY'
                    });
                }
                break;
        }

        // Sprawdź dostępność providera
        if (params.provider && !isProviderAvailable(params.provider)) {
            return apiResponse(null, 400, {
                message: `Provider ${params.provider} not available - missing API key`,
                code: 'PROVIDER_NOT_AVAILABLE'
            });
        }

        return null;
    };

    return universalHandler({
        req,
        context,
        router,
        action: action || 'SYSTEM_INFO',
        validate,
        zodSchema: vectorParamsSchema,
        params
    });
}

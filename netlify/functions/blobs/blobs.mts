/**
 * Netlify Function: Full CRUD API for Netlify Blobs
 * Zoptymalizowana wersja dla większych plików blob z base64 
 * Obsługuje: GET, POST, PUT, DELETE, LIST, METADATA, GET_META, GET_STORES
 * Dokumentacja: docs/blobs.md
 */
import { getStore } from '@netlify/blobs'
import { nanoid } from 'nanoid'
import type { Context } from '@netlify/functions'
import { apiResponse } from '../_types/ApiResponse.mts'
import { universalHandler } from '../_utils/universalHandler.mts'
import { z } from 'zod'

// Konfiguracja store
const DEFAULT_STORE = 'file-uploads'
const AVAILABLE_STORES = ['file-uploads', 'user-data', 'images', 'logs'] as const

// Limity dla optymalizacji
const MAX_MEMORY_SIZE = 50 * 1024 * 1024 // 50MB - maksymalny rozmiar w pamięci
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB maksymalny rozmiar pliku

const blobsParamsSchema = z.object({
    action: z.enum(['GET', 'METADATA', 'LIST', 'POST', 'PUT', 'DELETE', 'GET_META', 'GET_STORES']).optional(),
    store: z.string().optional().default(DEFAULT_STORE),
    key: z.string().optional().nullable(),
    metadata: z.string().optional(),
})
type BlobAction = 'GET' | 'METADATA' | 'LIST' | 'POST' | 'PUT' | 'DELETE' | 'GET_META' | 'GET_STORES'
type Store = ReturnType<typeof getStore>

/**
 * Bezpieczna konwersja ArrayBuffer do base64 dla dużych plików
 * Używa Buffer.from który w Node.js jest zoptymalizowany dla dużych plików
 */
function arrayBufferToBase64Safe(buffer: ArrayBuffer): string {
    try {
        // Use Buffer.from directly for all sizes - Node.js handles large arrays efficiently
        return Buffer.from(buffer).toString('base64')
    } catch (error) {
        throw new Error(`Base64 encode failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

/**
 * Bezpieczna konwersja base64 do ArrayBuffer dla dużych plików
 */
function base64ToArrayBufferSafe(base64: string): ArrayBuffer {
    try {
        // Use Buffer.from directly for all sizes - Node.js handles large base64 efficiently
        const buffer = Buffer.from(base64, 'base64')
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    } catch (error) {
        throw new Error(`Base64 decode failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

/**
 * Sprawdza czy plik jest binarny na podstawie content-type i rozszerzenia
 */
function isBinaryContent(contentType: string, key?: string | null): boolean {
    // Content-type check - rozszerzona lista
    if (
        contentType.startsWith('image/') ||
        contentType.startsWith('audio/') ||
        contentType.startsWith('video/') ||
        contentType.includes('octet-stream') ||
        contentType.includes('application/pdf') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/x-') ||
        contentType.includes('application/vnd.')
    ) {
        return true
    }

    // Extension check - split into smaller groups to reduce complexity
    if (!key) return false

    const extension = key.toLowerCase()
    const imageExts = /\.(png|jpg|jpeg|gif|bmp|webp|svg|ico)$/i
    const audioExts = /\.(mp3|ogg|wav|m4a|aac|flac)$/i
    const videoExts = /\.(mp4|avi|mov|wmv|flv|webm)$/i
    const archiveExts = /\.(pdf|zip|rar|7z|tar|gz|exe|dmg|pkg)$/i

    return imageExts.test(extension) ||
        audioExts.test(extension) ||
        videoExts.test(extension) ||
        archiveExts.test(extension)
}

// Handler functions - każda funkcja obsługuje jeden endpoint
const handleGet = async (store: Store, url: URL, key: string, req?: Request) => {
    const raw = url.searchParams.get('raw') === 'true'

    if (raw) {
        // For raw binary files, decode base64 and return direct Response
        const blob = await store.get(key, { type: 'text' })
        if (!blob) {
            return new Response('Not found', {
                status: 404,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Disposition'
                }
            })
        }

        // Get metadata to check if it's base64 and determine content type
        const metadataResult = await store.getMetadata(key)
        const metadata = metadataResult?.metadata || {}
        const originalName = (metadata?.originalName as string) || key

        // Determine proper MIME type from file extension
        const extension = originalName.toLowerCase().split('.').pop() || ''
        let contentType = (metadata?.type as string) || 'application/octet-stream'

        // Override content type based on file extension for better browser support
        switch (extension) {
            case 'mp3':
                contentType = 'audio/mpeg'
                break
            case 'wav':
                contentType = 'audio/wav'
                break
            case 'ogg':
                contentType = 'audio/ogg'
                break
            case 'mp4':
                contentType = 'video/mp4'
                break
            case 'webm':
                contentType = 'video/webm'
                break
            case 'jpg':
            case 'jpeg':
                contentType = 'image/jpeg'
                break
            case 'png':
                contentType = 'image/png'
                break
            case 'gif':
                contentType = 'image/gif'
                break
            case 'pdf':
                contentType = 'application/pdf'
                break
            case 'zip':
                contentType = 'application/zip'
                break
            // Keep existing type for other files or if no extension matches
        }

        if (metadata?.isBase64) {
            // Decode base64 to binary using optimized safe function
            try {
                const arrayBuffer = base64ToArrayBufferSafe(blob)
                const totalSize = arrayBuffer.byteLength

                // Handle Range requests for audio/video streaming
                const rangeHeader = req?.headers.get('range')
                if (rangeHeader) {
                    const range = rangeHeader.replace(/bytes=/, '').split('-')
                    const start = parseInt(range[0], 10)
                    const end = range[1] ? parseInt(range[1], 10) : totalSize - 1

                    if (start >= 0 && end < totalSize && start <= end) {
                        const partialBuffer = arrayBuffer.slice(start, end + 1)

                        return new Response(partialBuffer, {
                            status: 206,
                            headers: {
                                'Content-Type': contentType,
                                'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                                'Content-Length': (end - start + 1).toString(),
                                'Accept-Ranges': 'bytes',
                                'Cache-Control': 'public, max-age=3600',
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
                                'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges'
                            }
                        })
                    }
                }

                // Return full file if no range requested or invalid range
                return new Response(arrayBuffer, {
                    status: 200,
                    headers: {
                        'Content-Type': contentType,
                        'Content-Disposition': `inline; filename="${originalName}"`,
                        'Cache-Control': 'public, max-age=3600',
                        'Content-Length': arrayBuffer.byteLength.toString(),
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
                        'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Disposition, Content-Range, Accept-Ranges',
                        'Accept-Ranges': 'bytes'
                    }
                })
            } catch (error) {
                console.error('Base64 decode error:', error)
                return new Response('Invalid base64 data', {
                    status: 500,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Disposition'
                    }
                })
            }
        } else {
            // Return as text
            return new Response(blob, {
                status: 200,
                headers: {
                    'Content-Type': contentType,
                    'Content-Disposition': `inline; filename="${originalName}"`,
                    'Cache-Control': 'public, max-age=3600',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Disposition',
                    'Accept-Ranges': 'bytes'
                }
            })
        }
    }

    // Standard GET request without raw=true - return metadata with rawUrl
    const meta = await store.getMetadata(key)
    if (!meta) {
        return apiResponse(null, 404, { message: 'Blob not found', code: 'BLOB_NOT_FOUND' })
    }

    // Generate raw URL for binary data access
    const rawUrl = url.origin + url.pathname + `?action=GET&key=${encodeURIComponent(key)}&store=${url.searchParams.get('store') || DEFAULT_STORE}&raw=true`

    // Return metadata with rawUrl instead of blob content
    return apiResponse({
        metadata: meta.metadata,
        rawUrl
    })
}

const handleMetadata = async (store: Store, key: string, url: URL) => {
    const meta = await store.getMetadata(key)
    if (!meta) {
        return apiResponse(null, 404, { message: 'Blob not found', code: 'BLOB_NOT_FOUND' })
    }

    // Generate raw URL for binary data access
    const rawUrl = url.origin + url.pathname + `?action=GET&key=${encodeURIComponent(key)}&store=${url.searchParams.get('store') || DEFAULT_STORE}&raw=true`

    return apiResponse({
        metadata: meta.metadata,
        rawUrl
    })
}

const handleList = async (store: Store) => {
    const { blobs } = await store.list()
    return apiResponse(blobs)
}

/**
 * Pomocnicza funkcja do przetwarzania binary content
 */
async function processBinaryContent(arrayBuffer: ArrayBuffer, contentType: string): Promise<{ value: string, metadata: Record<string, unknown> }> {
    if (arrayBuffer.byteLength > MAX_MEMORY_SIZE) {
        throw new Error(`FILE_TOO_LARGE_FOR_MEMORY:${MAX_MEMORY_SIZE / 1024 / 1024}MB`)
    }

    console.log(`Processing binary file: ${arrayBuffer.byteLength} bytes`)

    const value = arrayBufferToBase64Safe(arrayBuffer)
    const metadata = {
        isBase64: true,
        originalSize: arrayBuffer.byteLength,
        type: contentType,
        encodedAt: new Date().toISOString()
    }

    console.log(`Base64 encoded: ${value.length} characters`)
    return { value, metadata }
}

/**
 * Pomocnicza funkcja do parsowania metadata z query params
 */
function parseMetadataFromQuery(metaParam: string, existingMetadata: Record<string, unknown>): Record<string, unknown> {
    try {
        const parsedMeta = JSON.parse(metaParam)
        return { ...existingMetadata, ...parsedMeta }
    } catch {
        const decoded = decodeURIComponent(metaParam)
        const parsedMeta = JSON.parse(decoded)
        return { ...existingMetadata, ...parsedMeta }
    }
}

// Helper functions for handlePostPut
const validateFileSize = (contentLength: string | null): Response | null => {
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
        return apiResponse(null, 413, {
            message: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            code: 'FILE_TOO_LARGE'
        })
    }
    return null
}

const processRequestBody = async (req: Request, contentType: string, key: string | null): Promise<{ value: string, metadata: Record<string, unknown> }> => {
    if (contentType.includes('application/json')) {
        const json = await req.json()
        return { value: JSON.stringify(json), metadata: {} }
    } else if (isBinaryContent(contentType, key)) {
        const arrayBuffer = await req.arrayBuffer()
        const result = await processBinaryContent(arrayBuffer, contentType)
        return { value: result.value, metadata: result.metadata }
    } else {
        const value = await req.text()
        return { value, metadata: {} }
    }
}

const handleRequestError = (error: unknown): Response => {
    console.error('Error processing request body:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.startsWith('FILE_TOO_LARGE_FOR_MEMORY:')) {
        const maxSize = errorMessage.split(':')[1]
        return apiResponse(null, 413, {
            message: `File too large for processing. Maximum size: ${maxSize}`,
            code: 'FILE_TOO_LARGE_FOR_MEMORY'
        })
    }

    return apiResponse(null, 500, {
        message: 'Failed to process request body',
        code: 'PROCESSING_ERROR',
        details: errorMessage
    })
}

const handlePostPut = async (store: Store, req: Request, url: URL, key: string | null) => {
    const contentType = req.headers.get('content-type') || ''
    const contentLength = req.headers.get('content-length')

    // Sprawdzanie rozmiaru pliku przed przetwarzaniem
    const sizeError = validateFileSize(contentLength)
    if (sizeError) return sizeError

    let value: string
    let metadata: Record<string, unknown> = {}

    try {
        // Obsługa multipart/form-data (upload pliku przez FormData)
        if (contentType.startsWith('multipart/form-data')) {
            const form = await req.formData();
            const file = form.get('file');
            if (file && file instanceof File) {
                const arrayBuffer = await file.arrayBuffer();
                // Rozpoznaj typ MIME
                const mimeType = file.type || 'application/octet-stream';
                // Rozpoznaj binarność po typie MIME i rozszerzeniu
                if (isBinaryContent(mimeType, file.name)) {
                    const result = await processBinaryContent(arrayBuffer, mimeType);
                    value = result.value;
                    metadata = {
                        ...result.metadata,
                        originalName: file.name,
                        size: arrayBuffer.byteLength,
                        type: mimeType,
                        uploadedAt: new Date().toISOString()
                    };
                } else {
                    // Jeśli nie binarny, zapisz jako tekst
                    value = await file.text();
                    metadata = {
                        originalName: file.name,
                        size: value.length,
                        type: mimeType,
                        uploadedAt: new Date().toISOString()
                    };
                }
            } else {
                return apiResponse(null, 400, { message: 'No file provided in form-data', code: 'NO_FILE' });
            }
        } else {
            // Standardowa obsługa (JSON, binary, text)
            const result = await processRequestBody(req, contentType, key);
            value = result.value;
            metadata = result.metadata;
        }
    } catch (error) {
        return handleRequestError(error);
    }

    // Parse metadata from query params
    const metaParam = url.searchParams.get('metadata');
    if (metaParam) {
        try {
            metadata = parseMetadataFromQuery(metaParam, metadata);
        } catch (error) {
            return apiResponse(null, 400, {
                message: 'Invalid metadata JSON',
                code: 'INVALID_METADATA',
                details: `Error: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    const blobKey = key || nanoid();

    try {
        const result = await store.set(blobKey, value, { metadata });

        return apiResponse({
            key: blobKey,
            ...result,
            size: value.length,
            isBase64: metadata.isBase64 || false,
            originalSize: metadata.originalSize || value.length
        }, 201, null, metadata);
    } catch (error) {
        console.error('Error storing blob:', error);
        return apiResponse(null, 500, {
            message: 'Failed to store blob',
            code: 'STORAGE_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

const handleDelete = async (store: Store, key: string) => {
    try {
        await store.delete(key)
        return apiResponse({ message: 'Blob deleted successfully', key })
    } catch (error) {
        console.error('Error deleting blob:', error)
        return apiResponse(null, 500, {
            message: 'Failed to delete blob',
            code: 'DELETE_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error'
        })
    }
}

const handleGetMeta = async (store: Store, key: string) => {
    const entry = await store.getWithMetadata(key)
    return entry
        ? apiResponse(entry)
        : apiResponse(null, 404, { message: 'Blob not found', code: 'BLOB_NOT_FOUND' })
}

const handleGetStores = async () => {
    return apiResponse({
        stores: AVAILABLE_STORES,
        default: DEFAULT_STORE,
        limits: {
            maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
            maxMemorySize: `${MAX_MEMORY_SIZE / 1024 / 1024}MB`
        }
    })
}


// Routing table - mapowanie akcji na handlery
const createRouter = (store: Store, url: URL, req: Request, key: string | null) => ({
    GET_STORES: () => handleGetStores(),
    GET: () => key ? handleGet(store, url, key, req) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
    METADATA: () => key ? handleMetadata(store, key, url) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
    LIST: () => handleList(store),
    POST: () => handlePostPut(store, req, url, key),
    PUT: () => handlePostPut(store, req, url, key),
    DELETE: () => key ? handleDelete(store, key) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
    GET_META: () => key ? handleGetMeta(store, key) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
})

// Main handler function
export default async function blobsHandler(req: Request, context: Context): Promise<Response> {
    // Handle CORS preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
                'Access-Control-Max-Age': '86400'
            }
        })
    }

    const url = new URL(req.url)
    const storeName = url.searchParams.get('store') || DEFAULT_STORE
    const store = getStore(storeName)
    const key = url.searchParams.get('key')
    const action = (url.searchParams.get('action') || req.method) as BlobAction
    const raw = url.searchParams.get('raw') === 'true'

    // Handle raw binary GET requests directly (bypass universal handler)
    if (action === 'GET' && key && raw) {
        return handleGet(store, url, key, req)
    }

    const router = createRouter(store, url, req, key)

    // Parameters for Zod validation
    const params = {
        action,
        store: storeName,
        key,
        metadata: url.searchParams.get('metadata') || undefined
    }

    // Custom validation for store name (beyond Zod schema)
    const validate = () => {
        if (!AVAILABLE_STORES.includes(storeName as any)) {
            return apiResponse(null, 400, {
                message: `Invalid store name: ${storeName}`,
                code: 'INVALID_STORE',
                details: `Available stores: ${AVAILABLE_STORES.join(', ')}`
            })
        }
        return null
    }

    return universalHandler({
        req,
        context,
        router,
        action,
        validate,
        zodSchema: blobsParamsSchema,
        params
    })
}
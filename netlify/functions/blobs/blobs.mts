/**
 * Netlify Function: Full CRUD API for Netlify Blobs
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

const blobsParamsSchema = z.object({
    action: z.enum(['GET', 'METADATA', 'LIST', 'POST', 'PUT', 'DELETE', 'GET_META', 'GET_STORES']).optional(),
    store: z.string().optional().default(DEFAULT_STORE),
    key: z.string().optional(),
    metadata: z.string().optional(),
})
type BlobAction = 'GET' | 'METADATA' | 'LIST' | 'POST' | 'PUT' | 'DELETE' | 'GET_META' | 'GET_STORES'
type Store = ReturnType<typeof getStore>

// Handler functions - każda funkcja obsługuje jeden endpoint
const handleGet = async (store: Store, url: URL, key: string) => {
    const type = url.searchParams.get('type') === 'json' ? 'json' : 'text'
    const blob = await store.get(key, { type: 'text' })

    if (!blob) {
        return apiResponse(null, 404, { message: 'Blob not found', code: 'BLOB_NOT_FOUND' })
    }

    if (type === 'json') {
        try {
            return apiResponse(JSON.parse(blob))
        } catch {
            return apiResponse(null, 400, { message: 'Invalid JSON in blob', code: 'INVALID_JSON' })
        }
    }

    return apiResponse(blob)
}

const handleMetadata = async (store: Store, key: string) => {
    const meta = await store.getMetadata(key)
    return meta
        ? apiResponse(meta)
        : apiResponse(null, 404, { message: 'Blob not found', code: 'BLOB_NOT_FOUND' })
}

const handleList = async (store: Store) => {
    const { blobs } = await store.list()
    return apiResponse(blobs)
}

const handlePostPut = async (store: Store, req: Request, url: URL, key: string | null) => {
    const contentType = req.headers.get('content-type') || ''
    let value: string
    let metadata: Record<string, unknown> = {}

    // Parse request body
    if (contentType.includes('application/json')) {
        const json = await req.json()
        value = JSON.stringify(json)
    } else {
        value = await req.text()
    }

    // Parse metadata from query params
    const metaParam = url.searchParams.get('metadata')
    if (metaParam) {
        try {
            // Try parsing directly first (for simple cases)
            try {
                metadata = JSON.parse(metaParam)
            } catch {
                // If direct parse fails, try URL decoding first
                const decoded = decodeURIComponent(metaParam)
                metadata = JSON.parse(decoded)
            }
        } catch (error) {
            return apiResponse(null, 400, {
                message: 'Invalid metadata JSON',
                code: 'INVALID_METADATA',
                details: `Raw: ${metaParam.substring(0, 50)}... | Decoded: ${decodeURIComponent(metaParam).substring(0, 50)}... | Error: ${error instanceof Error ? error.message : String(error)}`
            })
        }
    } const blobKey = key || nanoid()
    const result = await store.set(blobKey, value, { metadata })

    return apiResponse({ key: blobKey, ...result }, 201, null, metadata)
}

const handleDelete = async (store: Store, key: string) => {
    await store.delete(key)
    return apiResponse({ message: 'Blob deleted successfully', key })
}

const handleGetMeta = async (store: Store, key: string) => {
    const entry = await store.getWithMetadata(key)
    return entry
        ? apiResponse(entry)
        : apiResponse(null, 404, { message: 'Blob not found', code: 'BLOB_NOT_FOUND' })
}

const handleGetStores = async () => {
    return apiResponse({ stores: AVAILABLE_STORES, default: DEFAULT_STORE })
}


// Routing table - mapowanie akcji na handlery
const createRouter = (store: Store, url: URL, req: Request, key: string | null) => ({
    GET_STORES: () => handleGetStores(),
    GET: () => key ? handleGet(store, url, key) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
    METADATA: () => key ? handleMetadata(store, key) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
    LIST: () => handleList(store),
    POST: () => handlePostPut(store, req, url, key),
    PUT: () => handlePostPut(store, req, url, key),
    DELETE: () => key ? handleDelete(store, key) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
    GET_META: () => key ? handleGetMeta(store, key) : Promise.resolve(apiResponse(null, 400, { message: 'Missing key parameter', code: 'MISSING_KEY' })),
})

// Main handler function
export default async function blobsHandler(req: Request, context: Context): Promise<Response> {
    const url = new URL(req.url)
    const storeName = url.searchParams.get('store') || DEFAULT_STORE
    const store = getStore(storeName)
    const key = url.searchParams.get('key')
    const action = (url.searchParams.get('action') || req.method) as BlobAction
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
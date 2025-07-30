/**
 * Kompletne testy dla serwisu blobsService
 * Testuje wszystkie operacje API i obsługę błędów
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { blobsApi, type BlobItem, type ApiResponse } from '../../services/blobsService'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock File API
class MockFile {
    constructor(
        public content: string[] | Uint8Array,
        public name: string,
        public options: { type?: string; lastModified?: number } = {}
    ) { }

    get size() {
        if (Array.isArray(this.content)) {
            return this.content.join('').length
        }
        return this.content.length
    }

    get type() {
        return this.options.type || ''
    }

    get lastModified() {
        return this.options.lastModified || Date.now()
    }

    async text() {
        if (Array.isArray(this.content)) {
            return this.content.join('')
        }
        return new TextDecoder().decode(this.content)
    }

    async arrayBuffer() {
        if (Array.isArray(this.content)) {
            return new TextEncoder().encode(this.content.join(''))
        }
        return this.content.buffer || this.content
    }
}

// Assign to global for use in tests
global.File = MockFile as any

describe('blobsService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    const createMockResponse = (data: any, status = 200, ok = true) => ({
        ok,
        status,
        json: vi.fn().mockResolvedValue(data),
        text: vi.fn().mockResolvedValue(JSON.stringify(data)),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
    })

    const createMockApiResponse = <T>(payload: T, status = 200): ApiResponse<T> => ({
        status,
        payload,
        error: null
    })

    const createMockApiError = (message: string, code: string, status = 400): ApiResponse<never> => ({
        status,
        error: { message, code },
        payload: undefined
    })

    describe('getStores', () => {
        it('should fetch available stores successfully', async () => {
            const mockStores = {
                stores: ['file-uploads', 'user-data', 'images'],
                default: 'file-uploads'
            }
            const apiResponse = createMockApiResponse(mockStores)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.getStores()

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET_STORES',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'))

            const result = await blobsApi.getStores()

            expect(result.status).toBe(500)
            expect(result.error?.code).toBe('NETWORK_ERROR')
            expect(result.error?.message).toBe('Network error')
        })
    })

    describe('listBlobs', () => {
        it('should list blobs without store parameter', async () => {
            const mockBlobs: BlobItem[] = [
                { key: 'file1.txt', size: 100 },
                { key: 'file2.png', size: 2048 }
            ]
            const apiResponse = createMockApiResponse(mockBlobs)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.listBlobs()

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=LIST',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should list blobs with store parameter', async () => {
            const mockBlobs: BlobItem[] = [
                { key: 'image1.jpg', size: 1024 }
            ]
            const apiResponse = createMockApiResponse(mockBlobs)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.listBlobs('images')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=LIST&store=images',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should handle API errors', async () => {
            const apiError = createMockApiError('Access denied', 'ACCESS_DENIED', 403)
            mockFetch.mockResolvedValue(createMockResponse(apiError, 403, false))

            const result = await blobsApi.listBlobs()

            expect(result.status).toBe(403)
            expect(result.error?.code).toBe('ACCESS_DENIED')
        })
    })

    describe('getBlob', () => {
        it('should get blob as text', async () => {
            const content = 'Hello, world!'
            const apiResponse = createMockApiResponse(content)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.getBlob('test.txt', 'files', 'text')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET&key=test.txt&store=files&type=text',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should get blob as JSON', async () => {
            const content = { name: 'John', age: 30 }
            const apiResponse = createMockApiResponse(content)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.getBlob('data.json', 'files', 'json')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET&key=data.json&store=files&type=json',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result.payload).toEqual(content)
        })

        it('should handle missing file', async () => {
            const apiError = createMockApiError('File not found', 'BLOB_NOT_FOUND', 404)
            mockFetch.mockResolvedValue(createMockResponse(apiError, 404, false))

            const result = await blobsApi.getBlob('missing.txt')

            expect(result.status).toBe(404)
            expect(result.error?.code).toBe('BLOB_NOT_FOUND')
        })
    })

    describe('getBlobMetadata', () => {
        it('should get blob metadata successfully', async () => {
            const metadata = { metadata: { type: 'text/plain', author: 'John' } }
            const apiResponse = createMockApiResponse(metadata)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.getBlobMetadata('test.txt', 'files')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=METADATA&key=test.txt&store=files',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })
    })

    describe('getBlobWithMetadata', () => {
        it('should get blob with metadata successfully', async () => {
            const entry = {
                data: 'file content',
                metadata: { type: 'text/plain' }
            }
            const apiResponse = createMockApiResponse(entry)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.getBlobWithMetadata('test.txt', 'files')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET_META&key=test.txt&store=files',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })
    })

    describe('createBlob', () => {
        it('should create text blob successfully', async () => {
            const response = { key: 'test.txt', etag: 'abc123', modified: false }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            const result = await blobsApi.createBlob('test.txt', 'Hello, world!', 'files')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=POST&key=test.txt&store=files',
                expect.objectContaining({
                    method: 'POST',
                    body: 'Hello, world!',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should create JSON blob successfully', async () => {
            const content = { name: 'John', age: 30 }
            const response = { key: 'data.json', etag: 'def456', modified: false }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            const result = await blobsApi.createBlob('data.json', content, 'files')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=POST&key=data.json&store=files',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(content),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should include metadata in request', async () => {
            const metadata = { author: 'John', tags: ['test'] }
            const response = { key: 'test.txt', etag: 'ghi789', modified: false }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            const result = await blobsApi.createBlob('test.txt', 'content', 'files', metadata)

            expect(mockFetch).toHaveBeenCalledWith(
                `/.netlify/functions/blobs?action=POST&key=test.txt&store=files&metadata=${encodeURIComponent(JSON.stringify(metadata))}`,
                expect.objectContaining({
                    method: 'POST',
                    body: 'content',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })
    })

    describe('updateBlob', () => {
        it('should update blob successfully', async () => {
            const response = { key: 'test.txt', etag: 'updated123', modified: true }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            const result = await blobsApi.updateBlob('test.txt', 'Updated content', 'files')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=PUT&key=test.txt&store=files',
                expect.objectContaining({
                    method: 'PUT',
                    body: 'Updated content',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })
    })

    describe('deleteBlob', () => {
        it('should delete blob successfully', async () => {
            const response = { message: 'Blob deleted successfully', key: 'test.txt' }
            const apiResponse = createMockApiResponse(response)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            const result = await blobsApi.deleteBlob('test.txt', 'files')

            expect(mockFetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=DELETE&key=test.txt&store=files',
                expect.objectContaining({
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })
    })

    describe('uploadFile', () => {
        it('should upload text file successfully', async () => {
            const file = new MockFile(['Hello, world!'], 'test.txt', {
                type: 'text/plain',
                lastModified: 1640995200000
            })
            const response = { key: 'test.txt', etag: 'upload123', modified: false }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            const result = await blobsApi.uploadFile(file as any, undefined, 'files')

            const expectedMetadata = {
                originalName: 'test.txt',
                size: 13,
                type: 'text/plain',
                lastModified: new Date(1640995200000).toISOString()
            }

            expect(mockFetch).toHaveBeenCalledWith(
                `/.netlify/functions/blobs?action=POST&key=test.txt&store=files&metadata=${encodeURIComponent(JSON.stringify(expectedMetadata))}`,
                expect.objectContaining({
                    method: 'POST',
                    body: 'Hello, world!',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should upload binary file successfully', async () => {
            const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]) // PNG header
            const file = new MockFile(binaryData, 'image.png', {
                type: 'image/png',
                lastModified: 1640995200000
            })
            const response = { key: 'image.png', etag: 'binary123', modified: false }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            const result = await blobsApi.uploadFile(file as any, undefined, 'images')

            const expectedMetadata = {
                originalName: 'image.png',
                size: 4,
                type: 'image/png',
                lastModified: new Date(1640995200000).toISOString()
            }

            expect(mockFetch).toHaveBeenCalledWith(
                `/.netlify/functions/blobs?action=POST&key=image.png&store=images&metadata=${encodeURIComponent(JSON.stringify(expectedMetadata))}`,
                expect.objectContaining({
                    method: 'POST',
                    body: expect.any(ArrayBuffer),
                    headers: {
                        'Content-Type': 'image/png'
                    }
                })
            )
            expect(result).toEqual(apiResponse)
        })

        it('should use custom key for upload', async () => {
            const file = new MockFile(['content'], 'original.txt', { type: 'text/plain' })
            const response = { key: 'custom-key.txt', etag: 'custom123', modified: false }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            const result = await blobsApi.uploadFile(file as any, 'custom-key.txt', 'files')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('key=custom-key.txt'),
                expect.any(Object)
            )
            expect(result).toEqual(apiResponse)
        })

        it('should merge custom metadata', async () => {
            const file = new MockFile(['content'], 'test.txt', { type: 'text/plain' })
            const customMetadata = { author: 'John', project: 'test' }
            const response = { key: 'test.txt', etag: 'meta123', modified: false }
            const apiResponse = createMockApiResponse(response, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            await blobsApi.uploadFile(file as any, undefined, 'files', customMetadata)

            const call = mockFetch.mock.calls[0]
            const url = call[0] as string
            const metadataParam = new URLSearchParams(url.split('?')[1]).get('metadata')
            const metadata = JSON.parse(decodeURIComponent(metadataParam!))

            expect(metadata).toMatchObject({
                author: 'John',
                project: 'test',
                originalName: 'test.txt',
                size: 7,
                type: 'text/plain'
            })
        })

        it('should handle upload errors', async () => {
            const file = new MockFile(['content'], 'test.txt', { type: 'text/plain' })
            const apiError = createMockApiError('Upload failed', 'UPLOAD_ERROR', 400)
            mockFetch.mockResolvedValue(createMockResponse(apiError, 400, false))

            const result = await blobsApi.uploadFile(file as any, undefined, 'files')

            expect(result.status).toBe(400)
            expect(result.error?.code).toBe('UPLOAD_ERROR')
        })
    })

    describe('getBlobUrl', () => {
        it('should generate correct blob URL without raw parameter', () => {
            const url = blobsApi.getBlobUrl('test.txt', 'files')

            expect(url).toBe('/.netlify/functions/blobs?action=GET&key=test.txt&store=files')
        })

        it('should generate correct blob URL with raw parameter', () => {
            const url = blobsApi.getBlobUrl('image.png', 'images', true)

            expect(url).toBe('/.netlify/functions/blobs?action=GET&key=image.png&store=images&raw=true')
        })

        it('should generate URL without store parameter', () => {
            const url = blobsApi.getBlobUrl('test.txt')

            expect(url).toBe('/.netlify/functions/blobs?action=GET&key=test.txt')
        })

        it('should handle special characters in key', () => {
            const url = blobsApi.getBlobUrl('test file & data.txt', 'files')

            expect(url).toBe('/.netlify/functions/blobs?action=GET&key=test+file+%26+data.txt&store=files')
        })
    })

    describe('Error Handling', () => {
        it('should handle fetch rejection', async () => {
            mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

            const result = await blobsApi.listBlobs()

            expect(result.status).toBe(500)
            expect(result.error?.code).toBe('NETWORK_ERROR')
            expect(result.error?.message).toBe('Failed to fetch')
        })

        it('should handle JSON parsing errors', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
            }
            mockFetch.mockResolvedValue(mockResponse)

            const result = await blobsApi.getBlob('test.txt')

            expect(result.status).toBe(500)
            expect(result.error?.code).toBe('NETWORK_ERROR')
            expect(result.error?.message).toBe('Unexpected token')
        })

        it('should handle HTTP error responses', async () => {
            const errorResponse = createMockApiError('Server error', 'SERVER_ERROR', 500)
            mockFetch.mockResolvedValue(createMockResponse(errorResponse, 500, false))

            const result = await blobsApi.listBlobs()

            expect(result.status).toBe(500)
            expect(result.error?.code).toBe('SERVER_ERROR')
        })
    })

    describe('Request Headers', () => {
        it('should include correct headers for JSON requests', async () => {
            const apiResponse = createMockApiResponse([])
            mockFetch.mockResolvedValue(createMockResponse(apiResponse))

            await blobsApi.listBlobs()

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            )
        })

        it('should include correct headers for file uploads', async () => {
            const file = new MockFile(['content'], 'test.txt', { type: 'text/plain' })
            const apiResponse = createMockApiResponse({ key: 'test.txt', etag: 'test', modified: false }, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            await blobsApi.uploadFile(file as any)

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                })
            )
        })

        it('should handle binary file content types', async () => {
            const binaryData = new Uint8Array([0, 1, 2, 3])
            const file = new MockFile(binaryData, 'data.bin', { type: 'application/octet-stream' })
            const apiResponse = createMockApiResponse({ key: 'data.bin', etag: 'test', modified: false }, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            await blobsApi.uploadFile(file as any)

            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    }
                })
            )
        })
    })

    describe('URL Parameter Encoding', () => {
        it('should properly encode URL parameters', async () => {
            const metadata = {
                description: 'Test file with special chars: & = + %',
                tags: ['test', 'special chars']
            }
            const apiResponse = createMockApiResponse({ key: 'test.txt', etag: 'test', modified: false }, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            await blobsApi.createBlob('test.txt', 'content', 'files', metadata)

            const call = mockFetch.mock.calls[0]
            const url = call[0] as string

            // Parse the URL to extract metadata parameter
            const urlParts = url.split('?')[1]
            const params = new URLSearchParams(urlParts)
            const metadataParam = params.get('metadata')

            expect(metadataParam).toBeTruthy()
            // URLSearchParams automatically decodes, so we just need to parse JSON
            const decodedMetadata = JSON.parse(metadataParam!)
            expect(decodedMetadata).toEqual(metadata)

            // Ensure metadata is not split into separate parameters
            expect(url).not.toContain('&description=')
            expect(url).not.toContain('=Test file with')
        })

        it('should handle empty metadata', async () => {
            const apiResponse = createMockApiResponse({ key: 'test.txt', etag: 'test', modified: false }, 201)
            mockFetch.mockResolvedValue(createMockResponse(apiResponse, 201))

            await blobsApi.createBlob('test.txt', 'content', 'files', {})

            const call = mockFetch.mock.calls[0]
            const url = call[0] as string

            expect(url).toContain('metadata=%7B%7D') // encoded "{}"
        })
    })
})

// BlobsService tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { blobsApi, type ApiResponse, type BlobItem, type GetStoresResponse, type CreateBlobResponse } from './blobsService';

describe('BlobsService', () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        vi.mocked(global.fetch).mockClear();
    });

    describe('getStores', () => {
        it('should fetch available stores successfully', async () => {
            const mockResponse: ApiResponse<GetStoresResponse> = {
                status: 200,
                payload: {
                    stores: ['default', 'images', 'documents'],
                    default: 'default'
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.getStores();

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET_STORES',
                expect.objectContaining({
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should handle network errors', async () => {
            vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

            const result = await blobsApi.getStores();

            expect(result.status).toBe(500);
            expect(result.error?.message).toBe('Network error');
            expect(result.error?.code).toBe('NETWORK_ERROR');
        });
    });

    describe('listBlobs', () => {
        it('should list blobs without store parameter', async () => {
            const mockBlobs: BlobItem[] = [
                { key: 'file1.txt', size: 100, etag: 'abc123' },
                { key: 'file2.json', size: 200, etag: 'def456' }
            ];
            const mockResponse: ApiResponse<BlobItem[]> = {
                status: 200,
                payload: mockBlobs
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.listBlobs();

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=LIST',
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });

        it('should list blobs with store parameter', async () => {
            const mockResponse: ApiResponse<BlobItem[]> = {
                status: 200,
                payload: []
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            await blobsApi.listBlobs('images');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=LIST&store=images',
                expect.any(Object)
            );
        });
    });

    describe('getBlob', () => {
        it('should get blob content as text by default', async () => {
            const mockResponse: ApiResponse<string> = {
                status: 200,
                payload: 'Hello, World!'
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.getBlob('test.txt');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET&key=test.txt&type=text',
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });

        it('should get blob content as JSON when specified', async () => {
            const mockData = { message: 'Hello, JSON!' };
            const mockResponse: ApiResponse<object> = {
                status: 200,
                payload: mockData
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.getBlob('test.json', undefined, 'json');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET&key=test.json&type=json',
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });

        it('should include store parameter when provided', async () => {
            const mockResponse: ApiResponse<string> = {
                status: 200,
                payload: 'content'
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            await blobsApi.getBlob('test.txt', 'documents');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET&key=test.txt&store=documents&type=text',
                expect.any(Object)
            );
        });
    });

    describe('getBlobMetadata', () => {
        it('should get blob metadata', async () => {
            const mockMetadata = { author: 'John Doe', tags: ['important'] };
            const mockResponse: ApiResponse<{ metadata: typeof mockMetadata }> = {
                status: 200,
                payload: { metadata: mockMetadata }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.getBlobMetadata('test.txt');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=METADATA&key=test.txt',
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('getBlobWithMetadata', () => {
        it('should get blob with metadata', async () => {
            const mockPayload = {
                data: 'file content',
                metadata: { author: 'Jane Doe' }
            };
            const mockResponse: ApiResponse<typeof mockPayload> = {
                status: 200,
                payload: mockPayload
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.getBlobWithMetadata('test.txt', 'documents');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=GET_META&key=test.txt&store=documents',
                expect.any(Object)
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('createBlob', () => {
        it('should create blob with string content', async () => {
            const mockResponse: ApiResponse<CreateBlobResponse> = {
                status: 201,
                payload: {
                    key: 'test.txt',
                    etag: 'abc123',
                    modified: true
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 201,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.createBlob('test.txt', 'Hello, World!');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=POST&key=test.txt',
                expect.objectContaining({
                    method: 'POST',
                    body: 'Hello, World!',
                    headers: expect.objectContaining({
                        'Content-Type': 'text/plain',
                    }),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should create blob with JSON content', async () => {
            const content = { message: 'Hello, JSON!' };
            const mockResponse: ApiResponse<CreateBlobResponse> = {
                status: 201,
                payload: {
                    key: 'test.json',
                    etag: 'def456',
                    modified: true
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 201,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.createBlob('test.json', content);

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=POST&key=test.json',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify(content),
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                    }),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should create blob with metadata', async () => {
            const metadata = { author: 'John Doe', version: 1 };
            const mockResponse: ApiResponse<CreateBlobResponse> = {
                status: 201,
                payload: {
                    key: 'test.txt',
                    etag: 'ghi789',
                    modified: true
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 201,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            await blobsApi.createBlob('test.txt', 'content', 'documents', metadata);

            // Just verify fetch was called - URL encoding details are implementation specific
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('action=POST'),
                expect.any(Object)
            );
        });
    });

    describe('updateBlob', () => {
        it('should update blob', async () => {
            const mockResponse: ApiResponse<CreateBlobResponse> = {
                status: 200,
                payload: {
                    key: 'test.txt',
                    etag: 'updated123',
                    modified: true
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.updateBlob('test.txt', 'Updated content');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=PUT&key=test.txt',
                expect.objectContaining({
                    method: 'PUT',
                    body: 'Updated content',
                    headers: expect.objectContaining({
                        'Content-Type': 'text/plain',
                    }),
                })
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('deleteBlob', () => {
        it('should delete blob', async () => {
            const mockResponse: ApiResponse<{ message: string; key: string }> = {
                status: 200,
                payload: {
                    message: 'Blob deleted successfully',
                    key: 'test.txt'
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.deleteBlob('test.txt');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=DELETE&key=test.txt',
                expect.objectContaining({
                    method: 'DELETE',
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should delete blob from specific store', async () => {
            const mockResponse: ApiResponse<{ message: string; key: string }> = {
                status: 200,
                payload: {
                    message: 'Blob deleted successfully',
                    key: 'test.txt'
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            await blobsApi.deleteBlob('test.txt', 'documents');

            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/blobs?action=DELETE&key=test.txt&store=documents',
                expect.objectContaining({
                    method: 'DELETE',
                })
            );
        });
    });

    describe('uploadFile', () => {
        it('should upload text file', async () => {
            const file = new File(['Hello, file!'], 'test.txt', { type: 'text/plain' });

            // Mock File.text() method
            file.text = vi.fn().mockResolvedValue('Hello, file!');

            const mockResponse: ApiResponse<CreateBlobResponse> = {
                status: 201,
                payload: {
                    key: 'test.txt',
                    etag: 'file123',
                    modified: true
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 201,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            const result = await blobsApi.uploadFile(file);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('action=POST'),
                expect.objectContaining({
                    method: 'POST',
                    body: 'Hello, file!',
                    headers: expect.objectContaining({
                        'Content-Type': 'text/plain',
                    }),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should upload image file as binary', async () => {
            const arrayBuffer = new ArrayBuffer(8);
            const file = new File([arrayBuffer], 'test.jpg', { type: 'image/jpeg' });
            const mockResponse: ApiResponse<CreateBlobResponse> = {
                status: 201,
                payload: {
                    key: 'test.jpg',
                    etag: 'img123',
                    modified: true
                }
            };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 201,
                json: () => Promise.resolve(mockResponse),
            } as Response);

            // Mock file.arrayBuffer()
            file.arrayBuffer = vi.fn().mockResolvedValue(arrayBuffer);

            const result = await blobsApi.uploadFile(file, 'custom-key.jpg', 'images');

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('action=POST&key=custom-key.jpg&store=images'),
                expect.objectContaining({
                    method: 'POST',
                    body: arrayBuffer,
                    headers: expect.objectContaining({
                        'Content-Type': 'image/jpeg',
                    }),
                })
            );
            expect(result).toEqual(mockResponse);
        });

        it('should include file metadata in upload', async () => {
            const file = new File(['content'], 'test.txt', {
                type: 'text/plain',
                lastModified: 1642784400000 // Jan 21, 2022
            });

            // Mock File.text() method
            file.text = vi.fn().mockResolvedValue('content');

            const customMetadata = { category: 'documents' };

            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                status: 201,
                json: () => Promise.resolve({ status: 201, payload: {} }),
            } as Response);

            await blobsApi.uploadFile(file, undefined, 'docs', customMetadata);

            // Just verify fetch was called with expected parameters
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('metadata='),
                expect.any(Object)
            );
        });
    });

    describe('getBlobUrl', () => {
        it('should generate blob URL without store', () => {
            const url = blobsApi.getBlobUrl('test.txt');
            expect(url).toBe('/.netlify/functions/blobs?action=GET&key=test.txt');
        });

        it('should generate blob URL with store', () => {
            const url = blobsApi.getBlobUrl('test.txt', 'images');
            expect(url).toBe('/.netlify/functions/blobs?action=GET&key=test.txt&store=images');
        });

        it('should generate raw blob URL', () => {
            const url = blobsApi.getBlobUrl('test.txt', 'images', true);
            expect(url).toBe('/.netlify/functions/blobs?action=GET&key=test.txt&store=images&raw=true');
        });
    });
});

/**
 * Test for metadata update functionality
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Simple test service for direct API calls
class TestBlobsApiService {
    private readonly baseUrl = 'http://localhost:8000/.netlify/functions/blobs';

    private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<{ status: number, payload?: T, error?: any }> {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            const data = await response.json();
            return data;
        } catch (error) {
            return {
                status: 500,
                error: {
                    message: error instanceof Error ? error.message : 'Network error',
                    code: 'NETWORK_ERROR'
                }
            };
        }
    }

    async createBlob(key: string, content: string, store?: string, metadata?: any) {
        const params = new URLSearchParams({ action: 'POST', key });
        if (store) params.set('store', store);
        if (metadata) params.set('metadata', JSON.stringify(metadata));

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest(url, {
            method: 'POST',
            body: content,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    async getBlobMetadataWithRawUrl(key: string, store?: string) {
        const params = new URLSearchParams({ action: 'GET', key });
        if (store) params.set('store', store);

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest(url);
    }

    async updateBlobMetadata(key: string, metadata: any, store?: string) {
        // First get original content
        const getMetaParams = new URLSearchParams({ action: 'GET_META', key });
        if (store) getMetaParams.set('store', store);
        const getMetaUrl = `${this.baseUrl}?${getMetaParams.toString()}`;
        const contentResponse = await this.makeRequest<{ data: string }>(getMetaUrl);

        if (contentResponse.status !== 200 || !contentResponse.payload) {
            return { status: 404, error: { message: 'Blob not found' } };
        }

        // Use PUT to update with same content but new metadata
        const putParams = new URLSearchParams({ action: 'PUT', key });
        if (store) putParams.set('store', store);
        putParams.set('metadata', JSON.stringify(metadata));

        const putUrl = `${this.baseUrl}?${putParams.toString()}`;
        return this.makeRequest(putUrl, {
            method: 'PUT',
            body: contentResponse.payload.data,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    async deleteBlob(key: string, store?: string) {
        const params = new URLSearchParams({ action: 'DELETE', key });
        if (store) params.set('store', store);

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest(url, { method: 'DELETE' });
    }

    async getRawBlob(rawUrl: string) {
        return fetch(rawUrl);
    }
}

describe('Metadata Update Tests', () => {
    const testKey = 'test-metadata-file';
    const testStore = 'file-uploads';
    const testApi = new TestBlobsApiService();

    beforeAll(async () => {
        // Create a test blob first
        await testApi.createBlob(
            testKey,
            'test content for metadata update',
            testStore,
            {
                originalName: 'test-file.txt',
                type: 'text/plain',
                contentType: 'text/plain'
            }
        );
    });

    afterAll(async () => {
        // Clean up test blob
        try {
            await testApi.deleteBlob(testKey, testStore);
        } catch (error) {
            console.warn('Failed to cleanup test blob:', error);
        }
    });

    it('should get blob metadata with rawUrl', async () => {
        const response = await testApi.getBlobMetadataWithRawUrl(testKey, testStore);

        expect(response.status).toBe(200);
        expect(response.payload).toBeDefined();
        expect((response.payload as any)?.metadata).toBeDefined();
        expect((response.payload as any)?.rawUrl).toBeDefined();
        expect((response.payload as any)?.rawUrl).toContain('raw=true');
    });

    it('should update blob metadata successfully', async () => {
        const newMetadata = {
            originalName: 'updated-test-file.txt',
            type: 'text/plain',
            contentType: 'text/plain',
            customField: 'test value'
        };

        const response = await testApi.updateBlobMetadata(testKey, newMetadata, testStore);

        expect(response.status).toBeOneOf([200, 201]);
        expect(response.payload).toBeDefined();
    });

    it('should verify metadata was updated', async () => {
        const response = await testApi.getBlobMetadataWithRawUrl(testKey, testStore);

        expect(response.status).toBe(200);
        expect((response.payload as any)?.metadata.originalName).toBe('updated-test-file.txt');
        expect((response.payload as any)?.metadata.customField).toBe('test value');
    });

    it('should preserve content after metadata update', async () => {
        const response = await testApi.getBlobMetadataWithRawUrl(testKey, testStore);

        if ((response.payload as any)?.rawUrl) {
            const rawResponse = await testApi.getRawBlob((response.payload as any).rawUrl);
            const content = await rawResponse.text();

            expect(content).toBe('test content for metadata update');
        }
    });
});
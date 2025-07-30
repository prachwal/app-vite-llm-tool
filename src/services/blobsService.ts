// Blobs API Service
// Connects to Netlify Blobs API functions

export interface BlobMetadata {
    [key: string]: unknown;
    originalName?: string;
    type?: string;
    contentType?: string;
    filename?: string;
    size?: number;
    lastModified?: string;
    isBase64?: boolean;
    uploadedAt?: string;
}

export interface BlobItem {
    key: string;
    metadata?: BlobMetadata;
    etag?: string;
    size?: number;
    modified?: string;
}

export interface ApiResponse<T = unknown> {
    status: number;
    payload?: T;
    error?: {
        message: string;
        code: string | number;
        details?: string;
    } | null;
    metadata?: Record<string, unknown>;
}

export interface GetStoresResponse {
    stores: string[];
    default: string;
}

export interface CreateBlobResponse {
    key: string;
    etag: string;
    modified: boolean;
}

class BlobsApiService {
    private readonly baseUrl = '/.netlify/functions/blobs';

    // Get full URL for development/production
    private getFullUrl(path: string): string {
        // In development, Netlify functions run on localhost:8000
        if (process.env.NODE_ENV === 'development' || location.hostname === 'localhost') {
            return `http://localhost:8000${path}`;
        }
        return path;
    }

    private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        try {
            const fullUrl = this.getFullUrl(url);

            // Don't set Content-Type for FormData - let browser set it with boundary
            const defaultHeaders: HeadersInit = {};
            if (!(options.body instanceof FormData)) {
                defaultHeaders['Content-Type'] = 'application/json';
            }

            const response = await fetch(fullUrl, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers,
                },
            });

            const data = await response.json() as ApiResponse<T>;
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

    // Get available stores
    async getStores(): Promise<ApiResponse<GetStoresResponse>> {
        const url = `${this.baseUrl}?action=GET_STORES`;
        return this.makeRequest<GetStoresResponse>(url);
    }

    // List blobs in a store
    async listBlobs(store?: string): Promise<ApiResponse<BlobItem[]>> {
        const params = new URLSearchParams({ action: 'LIST' });
        if (store) params.set('store', store);

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest<BlobItem[]>(url);
    }

    // Get blob content
    async getBlob(key: string, store?: string, type: 'text' | 'json' = 'text'): Promise<ApiResponse<string | object>> {
        const params = new URLSearchParams({ action: 'GET', key });
        if (store) params.set('store', store);
        if (type) params.set('type', type);

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest<string | object>(url);
    }

    // Get blob metadata with rawUrl (NEW APPROACH - metadata separated from content)
    async getBlobMetadataWithRawUrl(key: string, store?: string): Promise<ApiResponse<{ metadata: BlobMetadata; rawUrl: string }>> {
        const params = new URLSearchParams({ action: 'GET', key });
        if (store) params.set('store', store);
        // Don't add raw=true - this will return metadata + rawUrl

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest<{ metadata: BlobMetadata; rawUrl: string }>(url);
    }

    // Get raw blob content directly (binary data)
    async getRawBlob(rawUrl: string): Promise<Response> {
        return fetch(rawUrl);
    }

    // Get blob metadata
    async getBlobMetadata(key: string, store?: string): Promise<ApiResponse<{ metadata: BlobMetadata }>> {
        const params = new URLSearchParams({ action: 'METADATA', key });
        if (store) params.set('store', store);

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest<{ metadata: BlobMetadata }>(url);
    }

    // Get blob with metadata
    async getBlobWithMetadata(key: string, store?: string): Promise<ApiResponse<{ data: string; metadata: BlobMetadata }>> {
        const params = new URLSearchParams({ action: 'GET_META', key });
        if (store) params.set('store', store);

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest<{ data: string; metadata: BlobMetadata }>(url);
    }

    // Create or update blob
    async createBlob(
        key: string,
        content: string | object,
        store?: string,
        metadata?: BlobMetadata
    ): Promise<ApiResponse<CreateBlobResponse>> {
        const params = new URLSearchParams({ action: 'POST', key });
        if (store) params.set('store', store);
        if (metadata) params.set('metadata', JSON.stringify(metadata));

        const url = `${this.baseUrl}?${params.toString()}`;

        return this.makeRequest<CreateBlobResponse>(url, {
            method: 'POST',
            body: typeof content === 'string' ? content : JSON.stringify(content),
            headers: {
                'Content-Type': typeof content === 'string' ? 'text/plain' : 'application/json'
            }
        });
    }

    // Update blob
    async updateBlob(
        key: string,
        content: string | object,
        store?: string,
        metadata?: BlobMetadata
    ): Promise<ApiResponse<CreateBlobResponse>> {
        const params = new URLSearchParams({ action: 'PUT', key });
        if (store) params.set('store', store);
        if (metadata) params.set('metadata', JSON.stringify(metadata));

        const url = `${this.baseUrl}?${params.toString()}`;

        return this.makeRequest<CreateBlobResponse>(url, {
            method: 'PUT',
            body: typeof content === 'string' ? content : JSON.stringify(content),
            headers: {
                'Content-Type': typeof content === 'string' ? 'text/plain' : 'application/json'
            }
        });
    }

    // Update blob metadata only (without content change)
    async updateBlobMetadata(
        key: string,
        metadata: BlobMetadata,
        store?: string
    ): Promise<ApiResponse<CreateBlobResponse>> {
        try {
            // Get the blob content with existing metadata using GET_META
            const getMetaUrl = `${this.baseUrl}?action=GET_META&key=${encodeURIComponent(key)}${store ? '&store=' + store : ''}`;
            const getMetaResponse = await this.makeRequest<{ data: string; metadata: BlobMetadata; etag: string }>(getMetaUrl);

            if (getMetaResponse.status !== 200 || !getMetaResponse.payload) {
                return {
                    status: 404,
                    error: {
                        message: 'Blob not found',
                        code: 'BLOB_NOT_FOUND'
                    }
                };
            }

            const { data: content, metadata: existingMetadata } = getMetaResponse.payload;

            // Merge existing metadata with new metadata, preserving system fields
            const mergedMetadata = {
                ...existingMetadata,
                ...metadata,
                lastModified: new Date().toISOString(),
            };

            // Use PUT to update with same content but new metadata
            const params = new URLSearchParams({ key });
            if (store) params.set('store', store);
            params.set('metadata', JSON.stringify(mergedMetadata));

            const url = `${this.baseUrl}?${params.toString()}`;

            // Determine appropriate content type based on existing metadata
            const contentType = existingMetadata.type || 'text/plain';

            return this.makeRequest<CreateBlobResponse>(url, {
                method: 'PUT',
                body: content,
                headers: {
                    'Content-Type': contentType
                }
            });
        } catch (error) {
            return {
                status: 500,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error during metadata update',
                    code: 'UPDATE_ERROR'
                }
            };
        }
    }

    // Delete blob
    async deleteBlob(key: string, store?: string): Promise<ApiResponse<{ message: string; key: string }>> {
        const params = new URLSearchParams({ action: 'DELETE', key });
        if (store) params.set('store', store);

        const url = `${this.baseUrl}?${params.toString()}`;
        return this.makeRequest<{ message: string; key: string }>(url, {
            method: 'DELETE'
        });
    }

    // Upload file (convenience method)
    async uploadFile(
        file: File,
        key?: string,
        store?: string,
        metadata?: BlobMetadata
    ): Promise<ApiResponse<CreateBlobResponse>> {
        const blobKey = key || file.name;
        const blobMetadata = {
            ...metadata,
            originalName: file.name,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified).toISOString()
        };

        const params = new URLSearchParams({ action: 'POST' });
        if (blobKey) params.set('key', blobKey);
        if (store) params.set('store', store);
        if (blobMetadata) params.set('metadata', JSON.stringify(blobMetadata));

        const url = `${this.baseUrl}?${params.toString()}`;

        // Use FormData for all files to match backend expectation
        const formData = new FormData();
        formData.append('file', file);

        return this.makeRequest<CreateBlobResponse>(url, {
            method: 'POST',
            body: formData,
            headers: {} // Let browser set Content-Type with boundary for FormData
        });
    }

    // Get blob URL for direct access (useful for images)
    getBlobUrl(key: string, store?: string, raw: boolean = false): string {
        const params = new URLSearchParams({ action: 'GET', key });
        if (store) params.set('store', store);
        if (raw) params.set('raw', 'true');
        const url = `${this.baseUrl}?${params.toString()}`;
        return this.getFullUrl(url);
    }
}

// Export singleton instance
export const blobsApi = new BlobsApiService();

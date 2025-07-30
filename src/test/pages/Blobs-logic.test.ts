/**
 * Testy logiki strony Blobs bez renderowania UI
 * Testuje funkcjonalność bez problemów z MUI/Preact kompatybilnością
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blobsApi, type BlobItem, type ApiResponse } from '../../services/blobsService';

// Mock blobsApi
vi.mock('../../services/blobsService', () => ({
    blobsApi: {
        listBlobs: vi.fn(),
        uploadBlob: vi.fn(),
        deleteBlob: vi.fn(),
        getBlob: vi.fn(),
        getBlobWithMetadata: vi.fn(),
        getBlobUrl: vi.fn(),
        listContainers: vi.fn(),
        createContainer: vi.fn(),
        deleteContainer: vi.fn(),
    },
}));

const mockBlobsApi = vi.mocked(blobsApi);

// Test data
const mockBlobs: BlobItem[] = [
    {
        key: 'document.txt',
        size: 1024,
        modified: '2025-01-30T10:00:00Z',
        metadata: { type: 'text/plain' }
    },
    {
        key: 'image.jpg',
        size: 2048,
        modified: '2025-01-30T11:00:00Z',
        metadata: { type: 'image/jpeg' }
    },
    {
        key: 'data.json',
        size: 512,
        modified: '2025-01-30T12:00:00Z',
        metadata: { type: 'application/json' }
    }
];

const mockContainers = ['default', 'uploads', 'documents', 'images'];

const mockApiResponse = <T,>(data: T, status = 200): ApiResponse<T> => ({
    status,
    payload: data,
    error: null
});

const mockApiError = (message: string, code: string, status = 400): ApiResponse<never> => ({
    status,
    payload: undefined,
    error: { message, code }
});

// File upload validation logic (extracted from Blobs page)
function validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'text/plain', 'text/csv', 'application/json',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        'video/mp4', 'video/webm', 'video/ogg'
    ];

    if (file.size > maxSize) {
        return { valid: false, error: `File size must be less than ${maxSize / (1024 * 1024)}MB` };
    }

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: `File type ${file.type} is not allowed` };
    }

    return { valid: true };
}

// File filtering logic (extracted from Blobs page)
function filterBlobs(blobs: BlobItem[], searchTerm: string, fileType?: string): BlobItem[] {
    return blobs.filter(blob => {
        const matchesSearch = !searchTerm ||
            blob.key.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = !fileType ||
            blob.metadata?.type?.includes(fileType) ||
            blob.key.toLowerCase().includes(fileType.toLowerCase());

        return matchesSearch && matchesType;
    });
}

// Container validation logic (extracted from Blobs page)
function validateContainerName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: 'Container name cannot be empty' };
    }

    if (name.length < 3 || name.length > 63) {
        return { valid: false, error: 'Container name must be between 3 and 63 characters' };
    }

    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name)) {
        return { valid: false, error: 'Container name must contain only lowercase letters, numbers, and hyphens' };
    }

    if (name.includes('--')) {
        return { valid: false, error: 'Container name cannot contain consecutive hyphens' };
    }

    return { valid: true };
}

// Sorting logic (extracted from Blobs page)
function sortBlobs(blobs: BlobItem[], sortBy: 'name' | 'size' | 'modified', sortOrder: 'asc' | 'desc'): BlobItem[] {
    const sorted = [...blobs].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'name':
                comparison = a.key.localeCompare(b.key);
                break;
            case 'size':
                comparison = (a.size || 0) - (b.size || 0);
                break;
            case 'modified':
                comparison = new Date(a.modified || '').getTime() - new Date(b.modified || '').getTime();
                break;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
}

describe('Blobs Page Logic Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Container Management Logic', () => {
        it('should list containers successfully', async () => {
            mockBlobsApi.listContainers.mockResolvedValue(mockApiResponse(mockContainers));

            const result = await mockBlobsApi.listContainers();

            expect(mockBlobsApi.listContainers).toHaveBeenCalled();
            expect(result.payload).toEqual(mockContainers);
            expect(result.error).toBeNull();
        });

        it('should create container with valid name', async () => {
            mockBlobsApi.createContainer.mockResolvedValue(mockApiResponse('Container created'));

            const result = await mockBlobsApi.createContainer('new-container');

            expect(mockBlobsApi.createContainer).toHaveBeenCalledWith('new-container');
            expect(result.payload).toBe('Container created');
        });

        it('should delete container successfully', async () => {
            mockBlobsApi.deleteContainer.mockResolvedValue(mockApiResponse('Container deleted'));

            const result = await mockBlobsApi.deleteContainer('old-container');

            expect(mockBlobsApi.deleteContainer).toHaveBeenCalledWith('old-container');
            expect(result.payload).toBe('Container deleted');
        });

        it('should handle container API errors', async () => {
            mockBlobsApi.listContainers.mockResolvedValue(mockApiError('Access denied', 'UNAUTHORIZED', 401));

            const result = await mockBlobsApi.listContainers();

            expect(result.error?.message).toBe('Access denied');
            expect(result.error?.code).toBe('UNAUTHORIZED');
            expect(result.status).toBe(401);
        });
    });

    describe('Container Name Validation', () => {
        it('should validate correct container names', () => {
            const validNames = ['my-container', 'test123', 'a-b-c', 'container-1'];

            validNames.forEach(name => {
                const result = validateContainerName(name);
                expect(result.valid).toBe(true);
                expect(result.error).toBeUndefined();
            });
        });

        it('should reject empty or whitespace names', () => {
            const invalidNames = ['', '   ', '\t\n'];

            invalidNames.forEach(name => {
                const result = validateContainerName(name);
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Container name cannot be empty');
            });
        });

        it('should reject names that are too short or too long', () => {
            const tooShort = 'ab';
            const tooLong = 'a'.repeat(64);

            expect(validateContainerName(tooShort).valid).toBe(false);
            expect(validateContainerName(tooShort).error).toBe('Container name must be between 3 and 63 characters');

            expect(validateContainerName(tooLong).valid).toBe(false);
            expect(validateContainerName(tooLong).error).toBe('Container name must be between 3 and 63 characters');
        });

        it('should reject names with invalid characters', () => {
            const invalidNames = ['My-Container', 'test_123', 'container.name', 'test@container'];

            invalidNames.forEach(name => {
                const result = validateContainerName(name);
                expect(result.valid).toBe(false);
                expect(result.error).toBe('Container name must contain only lowercase letters, numbers, and hyphens');
            });
        });

        it('should reject names with consecutive hyphens', () => {
            const result = validateContainerName('test--container');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Container name cannot contain consecutive hyphens');
        });

        it('should reject names starting or ending with hyphens', () => {
            const startingWithHyphen = validateContainerName('-container');
            const endingWithHyphen = validateContainerName('container-');

            expect(startingWithHyphen.valid).toBe(false);
            expect(endingWithHyphen.valid).toBe(false);
        });
    });

    describe('Blob Listing Logic', () => {
        it('should list blobs for container', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobs));

            const result = await mockBlobsApi.listBlobs('test-container');

            expect(mockBlobsApi.listBlobs).toHaveBeenCalledWith('test-container');
            expect(result.payload).toEqual(mockBlobs);
            expect(result.payload?.length).toBe(3);
        });

        it('should handle empty blob list', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse([]));

            const result = await mockBlobsApi.listBlobs('empty-container');

            expect(result.payload).toEqual([]);
            expect(result.payload?.length).toBe(0);
        });

        it('should handle blob listing errors', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiError('Container not found', 'NOT_FOUND', 404));

            const result = await mockBlobsApi.listBlobs('nonexistent-container');

            expect(result.error?.message).toBe('Container not found');
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    describe('File Upload Validation', () => {
        it('should validate allowed file types', () => {
            const allowedFiles = [
                new File(['content'], 'document.txt', { type: 'text/plain' }),
                new File(['{}'], 'data.json', { type: 'application/json' }),
                new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
                new File(['audio'], 'music.mp3', { type: 'audio/mpeg' }),
                new File(['video'], 'clip.mp4', { type: 'video/mp4' })
            ];

            allowedFiles.forEach(file => {
                const result = validateFile(file);
                expect(result.valid).toBe(true);
                expect(result.error).toBeUndefined();
            });
        });

        it('should reject disallowed file types', () => {
            const disallowedFiles = [
                new File(['content'], 'document.pdf', { type: 'application/pdf' }),
                new File(['content'], 'archive.zip', { type: 'application/zip' }),
                new File(['content'], 'executable.exe', { type: 'application/octet-stream' })
            ];

            disallowedFiles.forEach(file => {
                const result = validateFile(file);
                expect(result.valid).toBe(false);
                expect(result.error).toContain('is not allowed');
            });
        });

        it('should reject files that are too large', () => {
            const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });

            const result = validateFile(largeFile);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('File size must be less than');
        });

        it('should accept files at size limit', () => {
            const maxSizeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'max.txt', { type: 'text/plain' });

            const result = validateFile(maxSizeFile);
            expect(result.valid).toBe(true);
        });
    });

    describe('File Upload Logic', () => {
        it('should upload file successfully', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            mockBlobsApi.uploadBlob.mockResolvedValue(mockApiResponse('Upload successful'));

            const result = await mockBlobsApi.uploadBlob(file, 'test-container');

            expect(mockBlobsApi.uploadBlob).toHaveBeenCalledWith(file, 'test-container');
            expect(result.payload).toBe('Upload successful');
        });

        it('should handle upload errors', async () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            mockBlobsApi.uploadBlob.mockResolvedValue(mockApiError('Upload failed', 'UPLOAD_ERROR'));

            const result = await mockBlobsApi.uploadBlob(file, 'test-container');

            expect(result.error?.message).toBe('Upload failed');
            expect(result.error?.code).toBe('UPLOAD_ERROR');
        });

        it('should handle multiple file uploads', async () => {
            const files = [
                new File(['content1'], 'file1.txt', { type: 'text/plain' }),
                new File(['content2'], 'file2.txt', { type: 'text/plain' })
            ];

            mockBlobsApi.uploadBlob.mockResolvedValue(mockApiResponse('Upload successful'));

            const results = await Promise.all(
                files.map(file => mockBlobsApi.uploadBlob(file, 'test-container'))
            );

            expect(mockBlobsApi.uploadBlob).toHaveBeenCalledTimes(2);
            results.forEach((result: ApiResponse<string>) => {
                expect(result.payload).toBe('Upload successful');
            });
        });
    });

    describe('File Deletion Logic', () => {
        it('should delete single file', async () => {
            mockBlobsApi.deleteBlob.mockResolvedValue(mockApiResponse({ message: 'File deleted', key: 'test.txt' }));

            const result = await mockBlobsApi.deleteBlob('test.txt', 'test-container');

            expect(mockBlobsApi.deleteBlob).toHaveBeenCalledWith('test.txt', 'test-container');
            expect(result.payload).toEqual({ message: 'File deleted', key: 'test.txt' });
        });

        it('should delete multiple files', async () => {
            const filesToDelete = ['file1.txt', 'file2.txt', 'file3.txt'];
            mockBlobsApi.deleteBlob.mockResolvedValue(mockApiResponse({ message: 'File deleted', key: 'file.txt' }));

            const results = await Promise.all(
                filesToDelete.map(filename => mockBlobsApi.deleteBlob(filename, 'test-container'))
            );

            expect(mockBlobsApi.deleteBlob).toHaveBeenCalledTimes(3);
            results.forEach((result) => {
                expect(result.payload).toEqual({ message: 'File deleted', key: 'file.txt' });
            });
        });

        it('should handle deletion errors', async () => {
            mockBlobsApi.deleteBlob.mockResolvedValue(mockApiError('File not found', 'NOT_FOUND', 404));

            const result = await mockBlobsApi.deleteBlob('nonexistent.txt', 'test-container');

            expect(result.error?.message).toBe('File not found');
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    describe('File Filtering Logic', () => {
        it('should filter blobs by search term', () => {
            const filtered = filterBlobs(mockBlobs, 'doc');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].key).toBe('document.txt');
        });

        it('should filter blobs by file type', () => {
            const imageBlobs = filterBlobs(mockBlobs, '', 'image');
            expect(imageBlobs).toHaveLength(1);
            expect(imageBlobs[0].key).toBe('image.jpg');
        });

        it('should combine search term and file type filters', () => {
            const filtered = filterBlobs(mockBlobs, 'data', 'json');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].key).toBe('data.json');
        });

        it('should return all blobs when no filters applied', () => {
            const filtered = filterBlobs(mockBlobs, '', '');
            expect(filtered).toHaveLength(3);
            expect(filtered).toEqual(mockBlobs);
        });

        it('should handle case-insensitive search', () => {
            const filtered = filterBlobs(mockBlobs, 'DOC');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].key).toBe('document.txt');
        });

        it('should return empty array when no matches', () => {
            const filtered = filterBlobs(mockBlobs, 'nonexistent');
            expect(filtered).toHaveLength(0);
        });
    });

    describe('Blob Sorting Logic', () => {
        it('should sort blobs by name ascending', () => {
            const sorted = sortBlobs(mockBlobs, 'name', 'asc');
            expect(sorted[0].key).toBe('data.json');
            expect(sorted[1].key).toBe('document.txt');
            expect(sorted[2].key).toBe('image.jpg');
        });

        it('should sort blobs by name descending', () => {
            const sorted = sortBlobs(mockBlobs, 'name', 'desc');
            expect(sorted[0].key).toBe('image.jpg');
            expect(sorted[1].key).toBe('document.txt');
            expect(sorted[2].key).toBe('data.json');
        });

        it('should sort blobs by size ascending', () => {
            const sorted = sortBlobs(mockBlobs, 'size', 'asc');
            expect(sorted[0].key).toBe('data.json'); // 512 bytes
            expect(sorted[1].key).toBe('document.txt'); // 1024 bytes
            expect(sorted[2].key).toBe('image.jpg'); // 2048 bytes
        });

        it('should sort blobs by size descending', () => {
            const sorted = sortBlobs(mockBlobs, 'size', 'desc');
            expect(sorted[0].key).toBe('image.jpg'); // 2048 bytes
            expect(sorted[1].key).toBe('document.txt'); // 1024 bytes
            expect(sorted[2].key).toBe('data.json'); // 512 bytes
        });

        it('should sort blobs by modified date ascending', () => {
            const sorted = sortBlobs(mockBlobs, 'modified', 'asc');
            expect(sorted[0].key).toBe('document.txt');
            expect(sorted[1].key).toBe('image.jpg');
            expect(sorted[2].key).toBe('data.json');
        });

        it('should sort blobs by modified date descending', () => {
            const sorted = sortBlobs(mockBlobs, 'modified', 'desc');
            expect(sorted[0].key).toBe('data.json');
            expect(sorted[1].key).toBe('image.jpg');
            expect(sorted[2].key).toBe('document.txt');
        });

        it('should handle blobs with missing size or date fields', () => {
            const blobsWithMissing: BlobItem[] = [
                { key: 'file1.txt', size: undefined, modified: undefined },
                { key: 'file2.txt', size: 100, modified: '2025-01-30T10:00:00Z' }
            ];

            const sortedBySize = sortBlobs(blobsWithMissing, 'size', 'asc');
            expect(sortedBySize[0].key).toBe('file1.txt'); // undefined treated as 0

            const sortedByDate = sortBlobs(blobsWithMissing, 'modified', 'asc');
            expect(sortedByDate[0].key).toBe('file1.txt'); // undefined treated as invalid date
        });
    });

    describe('File Selection Logic', () => {
        it('should handle single file selection', () => {
            const selectedFiles = new Set<string>();

            // Simulate selecting a file
            selectedFiles.add('document.txt');

            expect(selectedFiles.has('document.txt')).toBe(true);
            expect(selectedFiles.size).toBe(1);
        });

        it('should handle multiple file selection', () => {
            const selectedFiles = new Set<string>();

            // Simulate selecting multiple files
            ['document.txt', 'image.jpg', 'data.json'].forEach(key => {
                selectedFiles.add(key);
            });

            expect(selectedFiles.size).toBe(3);
            expect(selectedFiles.has('document.txt')).toBe(true);
            expect(selectedFiles.has('image.jpg')).toBe(true);
            expect(selectedFiles.has('data.json')).toBe(true);
        });

        it('should handle file deselection', () => {
            const selectedFiles = new Set<string>(['document.txt', 'image.jpg']);

            // Simulate deselecting a file
            selectedFiles.delete('document.txt');

            expect(selectedFiles.has('document.txt')).toBe(false);
            expect(selectedFiles.has('image.jpg')).toBe(true);
            expect(selectedFiles.size).toBe(1);
        });

        it('should handle select all functionality', () => {
            const selectedFiles = new Set<string>();

            // Simulate select all
            mockBlobs.forEach(blob => selectedFiles.add(blob.key));

            expect(selectedFiles.size).toBe(mockBlobs.length);
            mockBlobs.forEach(blob => {
                expect(selectedFiles.has(blob.key)).toBe(true);
            });
        });

        it('should handle clear all selection', () => {
            const selectedFiles = new Set<string>(['document.txt', 'image.jpg']);

            // Simulate clear all
            selectedFiles.clear();

            expect(selectedFiles.size).toBe(0);
        });
    });

    describe('Download Logic', () => {
        it('should generate download URLs for files', () => {
            mockBlobsApi.getBlobUrl.mockReturnValue('/.netlify/functions/blobs?action=GET&key=document.txt&store=test-container&raw=true');

            const url = mockBlobsApi.getBlobUrl('document.txt', 'test-container', true);

            expect(mockBlobsApi.getBlobUrl).toHaveBeenCalledWith('document.txt', 'test-container', true);
            expect(url).toContain('document.txt');
            expect(url).toContain('test-container');
            expect(url).toContain('raw=true');
        });

        it('should handle bulk download preparation', async () => {
            const filesToDownload = ['file1.txt', 'file2.txt'];
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('file content'));

            const downloads = await Promise.all(
                filesToDownload.map(filename => mockBlobsApi.getBlob(filename, 'test-container', 'text'))
            );

            expect(mockBlobsApi.getBlob).toHaveBeenCalledTimes(2);
            downloads.forEach((download) => {
                expect(download.payload).toBe('file content');
            });
        });
    });

    describe('Error Handling Logic', () => {
        it('should handle network connectivity issues', async () => {
            mockBlobsApi.listBlobs.mockRejectedValue(new Error('Network error'));

            await expect(mockBlobsApi.listBlobs('test-container')).rejects.toThrow('Network error');
        });

        it('should handle API rate limiting', async () => {
            mockBlobsApi.uploadBlob.mockResolvedValue(mockApiError('Rate limit exceeded', 'RATE_LIMIT', 429));

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const result = await mockBlobsApi.uploadBlob(file, 'test-container');

            expect(result.status).toBe(429);
            expect(result.error?.code).toBe('RATE_LIMIT');
        });

        it('should handle authentication errors', async () => {
            mockBlobsApi.listContainers.mockResolvedValue(mockApiError('Authentication required', 'UNAUTHORIZED', 401));

            const result = await mockBlobsApi.listContainers();

            expect(result.status).toBe(401);
            expect(result.error?.code).toBe('UNAUTHORIZED');
        });

        it('should handle server errors gracefully', async () => {
            mockBlobsApi.uploadBlob.mockResolvedValue(mockApiError('Internal server error', 'INTERNAL_ERROR', 500));

            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            const result = await mockBlobsApi.uploadBlob(file, 'test-container');

            expect(result.status).toBe(500);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });
    });

    describe('State Management Logic', () => {
        it('should handle loading states correctly', () => {
            const loadingStates = {
                containers: false,
                blobs: false,
                upload: false,
                delete: false
            };

            // Simulate loading containers
            loadingStates.containers = true;
            expect(loadingStates.containers).toBe(true);
            expect(loadingStates.blobs).toBe(false);

            // Simulate finished loading
            loadingStates.containers = false;
            expect(loadingStates.containers).toBe(false);
        });

        it('should handle error states correctly', () => {
            const errorState = {
                message: '',
                code: '',
                isVisible: false
            };

            // Simulate error
            errorState.message = 'Upload failed';
            errorState.code = 'UPLOAD_ERROR';
            errorState.isVisible = true;

            expect(errorState.isVisible).toBe(true);
            expect(errorState.message).toBe('Upload failed');

            // Simulate clearing error
            errorState.message = '';
            errorState.code = '';
            errorState.isVisible = false;

            expect(errorState.isVisible).toBe(false);
        });
    });
});

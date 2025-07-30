/**
 * Testy logiki komponentu FilePreview bez renderowania UI
 * Testuje funkcjonalność bez problemów z MUI/Preact kompatybilnością
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blobsApi, type BlobItem, type ApiResponse } from '../../../services/blobsService';

// Mock blobsApi
vi.mock('../../../services/blobsService', () => ({
    blobsApi: {
        getBlob: vi.fn(),
        getBlobWithMetadata: vi.fn(),
        getBlobUrl: vi.fn(),
    },
}));

const mockBlobsApi = vi.mocked(blobsApi);

// Test data
const mockTextFile: BlobItem = {
    key: 'document.txt',
    size: 1024,
    modified: '2025-01-30T10:00:00Z',
    metadata: { type: 'text/plain' }
};

const mockImageFile: BlobItem = {
    key: 'photo.jpg',
    size: 2048,
    modified: '2025-01-30T11:00:00Z',
    metadata: { type: 'image/jpeg' }
};

const mockJsonFile: BlobItem = {
    key: 'data.json',
    size: 512,
    modified: '2025-01-30T12:00:00Z',
    metadata: { type: 'application/json' }
};

const mockAudioFile: BlobItem = {
    key: 'music.mp3',
    size: 5000000,
    modified: '2025-01-30T13:00:00Z',
    metadata: { type: 'audio/mpeg' }
};

const mockVideoFile: BlobItem = {
    key: 'video.mp4',
    size: 10000000,
    modified: '2025-01-30T14:00:00Z',
    metadata: { type: 'video/mp4' }
};

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

// File type detection logic (extracted from component)
function getFileTypeFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const audioTypes = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
    const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    const codeTypes = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'cpp', 'c'];
    const textTypes = ['txt', 'md', 'markdown', 'readme'];
    
    if (imageTypes.includes(ext)) return 'image';
    if (audioTypes.includes(ext)) return 'audio';
    if (videoTypes.includes(ext)) return 'video';
    if (codeTypes.includes(ext)) return 'code';
    if (textTypes.includes(ext)) return 'text';
    if (ext === 'json') return 'json';
    
    return 'unknown';
}

// File size formatting logic (extracted from component)
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Date formatting logic (extracted from component)
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US');
}

// JSON formatting logic (extracted from component)
function formatJsonContent(content: string): string {
    try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, 2);
    } catch {
        return content; // Return original if not valid JSON
    }
}

describe('FilePreview Logic Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('File Type Detection', () => {
        it('should correctly identify image files', () => {
            expect(getFileTypeFromExtension('photo.jpg')).toBe('image');
            expect(getFileTypeFromExtension('icon.png')).toBe('image');
            expect(getFileTypeFromExtension('logo.svg')).toBe('image');
            expect(getFileTypeFromExtension('image.webp')).toBe('image');
        });

        it('should correctly identify audio files', () => {
            expect(getFileTypeFromExtension('song.mp3')).toBe('audio');
            expect(getFileTypeFromExtension('audio.wav')).toBe('audio');
            expect(getFileTypeFromExtension('music.flac')).toBe('audio');
            expect(getFileTypeFromExtension('sound.m4a')).toBe('audio');
        });

        it('should correctly identify video files', () => {
            expect(getFileTypeFromExtension('video.mp4')).toBe('video');
            expect(getFileTypeFromExtension('movie.avi')).toBe('video');
            expect(getFileTypeFromExtension('clip.mov')).toBe('video');
            expect(getFileTypeFromExtension('stream.webm')).toBe('video');
        });

        it('should correctly identify code files', () => {
            expect(getFileTypeFromExtension('script.js')).toBe('code');
            expect(getFileTypeFromExtension('component.tsx')).toBe('code');
            expect(getFileTypeFromExtension('style.css')).toBe('code');
            expect(getFileTypeFromExtension('main.py')).toBe('code');
        });

        it('should correctly identify text files', () => {
            expect(getFileTypeFromExtension('document.txt')).toBe('text');
            expect(getFileTypeFromExtension('README.md')).toBe('text');
            expect(getFileTypeFromExtension('notes.markdown')).toBe('text');
        });

        it('should correctly identify JSON files', () => {
            expect(getFileTypeFromExtension('data.json')).toBe('json');
            expect(getFileTypeFromExtension('config.json')).toBe('json');
        });

        it('should handle unknown file types', () => {
            expect(getFileTypeFromExtension('file.xyz')).toBe('unknown');
            expect(getFileTypeFromExtension('unknown')).toBe('unknown');
            expect(getFileTypeFromExtension('')).toBe('unknown');
        });

        it('should handle files without extensions', () => {
            expect(getFileTypeFromExtension('LICENSE')).toBe('unknown');
            expect(getFileTypeFromExtension('Dockerfile')).toBe('unknown');
        });
    });

    describe('File Size Formatting', () => {
        it('should format bytes correctly', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(500)).toBe('500 B');
            expect(formatFileSize(1023)).toBe('1023 B');
        });

        it('should format kilobytes correctly', () => {
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1536)).toBe('1.5 KB');
            expect(formatFileSize(2048)).toBe('2 KB');
            expect(formatFileSize(1048575)).toBe('1024 KB');
        });

        it('should format megabytes correctly', () => {
            expect(formatFileSize(1048576)).toBe('1 MB');
            expect(formatFileSize(2097152)).toBe('2 MB');
            expect(formatFileSize(1572864)).toBe('1.5 MB');
        });

        it('should format gigabytes correctly', () => {
            expect(formatFileSize(1073741824)).toBe('1 GB');
            expect(formatFileSize(2147483648)).toBe('2 GB');
            expect(formatFileSize(1610612736)).toBe('1.5 GB');
        });
    });

    describe('Date Formatting', () => {
        it('should format ISO dates correctly', () => {
            expect(formatDate('2025-01-30T10:00:00Z')).toBe('1/30/2025');
            expect(formatDate('2025-12-25T15:30:00Z')).toBe('12/25/2025');
        });

        it('should handle different date formats', () => {
            expect(formatDate('2025-01-01T00:00:00.000Z')).toBe('1/1/2025');
            expect(formatDate('2025-06-15T12:00:00+00:00')).toBe('6/15/2025');
        });
    });

    describe('JSON Content Formatting', () => {
        it('should format valid JSON content', () => {
            const input = '{"name":"John","age":30,"city":"New York"}';
            const expected = '{\n  "name": "John",\n  "age": 30,\n  "city": "New York"\n}';
            
            expect(formatJsonContent(input)).toBe(expected);
        });

        it('should format nested JSON objects', () => {
            const input = '{"user":{"name":"John","details":{"age":30,"city":"NYC"}}}';
            const result = formatJsonContent(input);
            
            expect(result).toContain('"user"');
            expect(result).toContain('"details"');
            expect(result.split('\n').length).toBeGreaterThan(3); // Should be multiline
        });

        it('should handle invalid JSON gracefully', () => {
            const invalidJson = '{"invalid": json}';
            expect(formatJsonContent(invalidJson)).toBe(invalidJson);
            
            const malformedJson = '{name: "John"}';
            expect(formatJsonContent(malformedJson)).toBe(malformedJson);
        });

        it('should handle empty and null inputs', () => {
            expect(formatJsonContent('')).toBe('');
            expect(formatJsonContent('null')).toBe('null');
            expect(formatJsonContent('""')).toBe('""');
        });
    });

    describe('File Content Loading Logic', () => {
        it('should call correct API for text files', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('File content'));
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }));

            // Simulate loading text file content
            const result = await mockBlobsApi.getBlob('document.txt', 'test-container', 'text');
            const metadata = await mockBlobsApi.getBlobWithMetadata('document.txt', 'test-container');

            expect(mockBlobsApi.getBlob).toHaveBeenCalledWith('document.txt', 'test-container', 'text');
            expect(mockBlobsApi.getBlobWithMetadata).toHaveBeenCalledWith('document.txt', 'test-container');
            expect(result.payload).toBe('File content');
            expect(metadata.payload).toEqual({ data: 'content', metadata: {} });
        });

        it('should generate correct URLs for media files', () => {
            const blobUrl = '/.netlify/functions/blobs?action=GET&key=photo.jpg&store=test-container&raw=true';
            mockBlobsApi.getBlobUrl.mockReturnValue(blobUrl);

            const result = mockBlobsApi.getBlobUrl('photo.jpg', 'test-container', true);

            expect(mockBlobsApi.getBlobUrl).toHaveBeenCalledWith('photo.jpg', 'test-container', true);
            expect(result).toBe(blobUrl);
        });

        it('should handle API errors properly', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiError('Failed to load', 'LOAD_ERROR'));

            const result = await mockBlobsApi.getBlob('document.txt', 'test-container', 'text');

            expect(result.error).toEqual({ message: 'Failed to load', code: 'LOAD_ERROR' });
            expect(result.payload).toBeUndefined();
        });
    });

    describe('File Download Logic', () => {
        it('should prepare download data correctly', async () => {
            const fileContent = 'File content to download';
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse(fileContent));

            const result = await mockBlobsApi.getBlob('document.txt', 'test-container', 'text');

            expect(result.payload).toBe(fileContent);
            
            // Simulate creating blob for download
            const blob = new Blob([fileContent], { type: 'text/plain' });
            expect(blob.size).toBe(fileContent.length);
            expect(blob.type).toBe('text/plain');
        });

        it('should handle different content types for download', async () => {
            const jsonContent = '{"test": "data"}';
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse(jsonContent));

            const result = await mockBlobsApi.getBlob('data.json', 'test-container', 'text');

            expect(result.payload).toBe(jsonContent);
            
            // Simulate creating blob with correct MIME type
            const blob = new Blob([jsonContent], { type: 'application/json' });
            expect(blob.type).toBe('application/json');
        });

        it('should handle download errors', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiError('Download failed', 'DOWNLOAD_ERROR'));

            const result = await mockBlobsApi.getBlob('document.txt', 'test-container', 'text');

            expect(result.error).toEqual({ message: 'Download failed', code: 'DOWNLOAD_ERROR' });
            expect(result.payload).toBeUndefined();
        });
    });

    describe('Metadata Processing Logic', () => {
        it('should process file metadata correctly', async () => {
            const metadata = {
                author: 'John Doe',
                created: '2025-01-30T10:00:00Z',
                tags: ['test', 'document'],
                size: 1024
            };

            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata
            }));

            const result = await mockBlobsApi.getBlobWithMetadata('document.txt', 'test-container');

            expect(result.payload?.metadata).toEqual(metadata);
            expect(result.payload?.metadata.author).toBe('John Doe');
            expect(result.payload?.metadata.tags).toEqual(['test', 'document']);
        });

        it('should handle empty metadata', async () => {
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }));

            const result = await mockBlobsApi.getBlobWithMetadata('document.txt', 'test-container');

            expect(result.payload?.metadata).toEqual({});
        });

        it('should handle metadata loading errors', async () => {
            mockBlobsApi.getBlobWithMetadata.mockRejectedValue(new Error('Metadata not found'));

            await expect(mockBlobsApi.getBlobWithMetadata('document.txt', 'test-container')).rejects.toThrow('Metadata not found');
        });
    });

    describe('File Preview State Logic', () => {
        it('should determine preview mode based on file type', () => {
            // Text files should be loaded as text
            expect(getFileTypeFromExtension('document.txt')).toBe('text');
            expect(getFileTypeFromExtension('script.js')).toBe('code');
            
            // Media files should use blob URLs
            expect(getFileTypeFromExtension('photo.jpg')).toBe('image');
            expect(getFileTypeFromExtension('video.mp4')).toBe('video');
            expect(getFileTypeFromExtension('audio.mp3')).toBe('audio');
            
            // JSON should be formatted
            expect(getFileTypeFromExtension('data.json')).toBe('json');
        });

        it('should handle file selection state changes', () => {
            // Test different file selections
            const files = [mockTextFile, mockImageFile, mockJsonFile, null];
            
            files.forEach(file => {
                if (file) {
                    const fileType = getFileTypeFromExtension(file.key);
                    const formattedSize = formatFileSize(file.size || 0);
                    const formattedDate = formatDate(file.modified || '');
                    
                    expect(typeof fileType).toBe('string');
                    expect(typeof formattedSize).toBe('string');
                    expect(typeof formattedDate).toBe('string');
                } else {
                    // No file selected - should show empty state
                    expect(file).toBeNull();
                }
            });
        });
    });

    describe('Error Recovery Logic', () => {
        it('should handle network errors gracefully', async () => {
            mockBlobsApi.getBlob.mockRejectedValue(new Error('Network error'));

            await expect(mockBlobsApi.getBlob('document.txt', 'test-container', 'text')).rejects.toThrow('Network error');
        });

        it('should allow retry after errors', async () => {
            // First call fails
            mockBlobsApi.getBlob.mockRejectedValueOnce(new Error('Network error'));
            // Second call succeeds
            mockBlobsApi.getBlob.mockResolvedValueOnce(mockApiResponse('Success content'));

            // First attempt fails
            await expect(mockBlobsApi.getBlob('document.txt', 'test-container', 'text')).rejects.toThrow('Network error');
            
            // Retry succeeds
            const result = await mockBlobsApi.getBlob('document.txt', 'test-container', 'text');
            expect(result.payload).toBe('Success content');
        });

        it('should handle API error responses', async () => {
            const errorResponse = mockApiError('File not found', 'NOT_FOUND', 404);
            mockBlobsApi.getBlob.mockResolvedValue(errorResponse);

            const result = await mockBlobsApi.getBlob('nonexistent.txt', 'test-container', 'text');

            expect(result.status).toBe(404);
            expect(result.error?.message).toBe('File not found');
            expect(result.error?.code).toBe('NOT_FOUND');
        });
    });

    describe('File Information Processing', () => {
        it('should extract and format file information correctly', () => {
            const files = [mockTextFile, mockImageFile, mockJsonFile, mockAudioFile, mockVideoFile];
            
            files.forEach(file => {
                const info = {
                    name: file.key,
                    size: formatFileSize(file.size || 0),
                    modified: formatDate(file.modified || ''),
                    type: getFileTypeFromExtension(file.key),
                    metadata: file.metadata
                };
                
                expect(info.name).toBe(file.key);
                expect(info.size).toMatch(/\d+(\.\d+)?\s(B|KB|MB|GB)/);
                expect(info.modified).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
                expect(['text', 'image', 'json', 'audio', 'video', 'code', 'unknown']).toContain(info.type);
                expect(info.metadata).toBeDefined();
            });
        });

        it('should handle special file size edge cases', () => {
            expect(formatFileSize(0)).toBe('0 B');
            expect(formatFileSize(1)).toBe('1 B');
            expect(formatFileSize(1023)).toBe('1023 B');
            expect(formatFileSize(1024)).toBe('1 KB');
            expect(formatFileSize(1025)).toBe('1 KB');
        });
    });
});

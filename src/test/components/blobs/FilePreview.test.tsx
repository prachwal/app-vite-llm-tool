/**
 * Kompletne testy dla komponentu FilePreview
 * Testuje podgląd różnych typów plików, obsługę błędów i UI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { FilePreview, fileContent, fileMetadata, isLoadingContent } from '../../../components/blobs/FilePreview'
import { blobsApi, type BlobItem, type ApiResponse } from '../../../services/blobsService'
import '@testing-library/jest-dom'

// Mock blobsApi
vi.mock('../../../services/blobsService', () => ({
    blobsApi: {
        getBlob: vi.fn(),
        getBlobWithMetadata: vi.fn(),
        getBlobUrl: vi.fn(),
    },
}))

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
Object.defineProperty(window, 'URL', {
    value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
    },
})

// Mock document methods
Object.defineProperty(document, 'createElement', {
    value: vi.fn().mockImplementation((tagName: string) => {
        const element = {
            tagName: tagName.toUpperCase(),
            href: '',
            download: '',
            click: vi.fn(),
            style: {},
        }
        return element
    }),
})

Object.defineProperty(document.body, 'appendChild', {
    value: vi.fn(),
})

Object.defineProperty(document.body, 'removeChild', {
    value: vi.fn(),
})

const mockBlobsApi = vi.mocked(blobsApi)

// Test data
const mockTextFile: BlobItem = {
    key: 'document.txt',
    size: 1024,
    modified: '2025-01-30T10:00:00Z',
    metadata: { type: 'text/plain' }
}

const mockImageFile: BlobItem = {
    key: 'photo.jpg',
    size: 2048,
    modified: '2025-01-30T11:00:00Z',
    metadata: { type: 'image/jpeg' }
}

const mockJsonFile: BlobItem = {
    key: 'data.json',
    size: 512,
    modified: '2025-01-30T12:00:00Z',
    metadata: { type: 'application/json' }
}

const mockAudioFile: BlobItem = {
    key: 'music.mp3',
    size: 5000000,
    modified: '2025-01-30T13:00:00Z',
    metadata: { type: 'audio/mpeg' }
}

const mockVideoFile: BlobItem = {
    key: 'video.mp4',
    size: 10000000,
    modified: '2025-01-30T14:00:00Z',
    metadata: { type: 'video/mp4' }
}

const mockApiResponse = <T,>(data: T, status = 200): ApiResponse<T> => ({
    status,
    payload: data,
    error: null
})

const mockApiError = (message: string, code: string, status = 400): ApiResponse<never> => ({
    status,
    payload: undefined,
    error: { message, code }
})

describe('FilePreview Component', () => {
    const defaultProps = {
        file: null,
        container: 'test-container'
    }

    beforeEach(() => {
        vi.clearAllMocks()
        fileContent.value = null
        fileMetadata.value = null
        isLoadingContent.value = false
        mockCreateObjectURL.mockReturnValue('blob:mock-url')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Rendering', () => {
        it('should render empty state when no file selected', () => {
            render(<FilePreview {...defaultProps} />)

            expect(screen.getByText(/No file selected/i)).toBeInTheDocument()
        })

        it('should show loading state', () => {
            isLoadingContent.value = true

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should display file information header', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('File content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: { author: 'Test User' }
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                expect(screen.getByText('document.txt')).toBeInTheDocument()
                expect(screen.getByText('1.0 KB')).toBeInTheDocument()
                expect(screen.getByText('1/30/2025')).toBeInTheDocument()
            })
        })

        it('should show error message', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiError('Failed to load', 'LOAD_ERROR'))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                expect(screen.getByText('Failed to load')).toBeInTheDocument()
            })
        })
    })

    describe('Text File Preview', () => {
        it('should load and display text content', async () => {
            const textContent = 'Hello, world!\nThis is a test file.'
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse(textContent))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: textContent,
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                expect(mockBlobsApi.getBlob).toHaveBeenCalledWith('document.txt', 'test-container', 'text')
                expect(screen.getByText(textContent)).toBeInTheDocument()
            })
        })

        it('should format JSON content properly', async () => {
            const jsonContent = '{"name":"John","age":30}'
            const formattedJson = '{\n  "name": "John",\n  "age": 30\n}'

            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse(jsonContent))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: jsonContent,
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockJsonFile} />)

            await waitFor(() => {
                expect(screen.getByText(formattedJson)).toBeInTheDocument()
            })
        })

        it('should handle invalid JSON gracefully', async () => {
            const invalidJson = '{"invalid": json}'
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse(invalidJson))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: invalidJson,
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockJsonFile} />)

            await waitFor(() => {
                // Should display as raw text instead of trying to format
                expect(screen.getByText(invalidJson)).toBeInTheDocument()
            })
        })

        it('should toggle raw content view', async () => {
            const textContent = 'Line 1\nLine 2\nLine 3'
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse(textContent))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: textContent,
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                const rawToggle = screen.getByLabelText(/show raw content/i)
                fireEvent.click(rawToggle)

                // Should show content in pre tag with monospace font
                const preElement = screen.getByText(textContent).closest('pre')
                expect(preElement).toBeInTheDocument()
            })
        })
    })

    describe('Image File Preview', () => {
        it('should display image with blob URL', async () => {
            const blobUrl = '/.netlify/functions/blobs?action=GET&key=photo.jpg&store=test-container&raw=true'
            mockBlobsApi.getBlobUrl.mockReturnValue(blobUrl)
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'base64data',
                metadata: { isBase64: true }
            }))

            render(<FilePreview {...defaultProps} file={mockImageFile} />)

            await waitFor(() => {
                expect(mockBlobsApi.getBlobUrl).toHaveBeenCalledWith('photo.jpg', 'test-container', true)

                const img = screen.getByAltText('photo.jpg')
                expect(img).toBeInTheDocument()
                expect(img).toHaveAttribute('src', blobUrl)
            })
        })

        it('should handle image loading errors', async () => {
            const blobUrl = '/.netlify/functions/blobs?action=GET&key=photo.jpg&store=test-container&raw=true'
            mockBlobsApi.getBlobUrl.mockReturnValue(blobUrl)
            mockBlobsApi.getBlobWithMetadata.mockRejectedValue(new Error('Failed to load'))

            render(<FilePreview {...defaultProps} file={mockImageFile} />)

            await waitFor(() => {
                const img = screen.getByAltText('photo.jpg')

                // Simulate image load error
                fireEvent.error(img)

                // Should still show the image element, browser will handle error display
                expect(img).toBeInTheDocument()
            })
        })
    })

    describe('Audio File Preview', () => {
        it('should display audio player with controls', async () => {
            const blobUrl = '/.netlify/functions/blobs?action=GET&key=music.mp3&store=test-container&raw=true'
            mockBlobsApi.getBlobUrl.mockReturnValue(blobUrl)
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'base64data',
                metadata: { isBase64: true }
            }))

            render(<FilePreview {...defaultProps} file={mockAudioFile} />)

            await waitFor(() => {
                const audio = screen.getByTestId('audio-player') || document.querySelector('audio')
                expect(audio).toBeInTheDocument()
                expect(audio).toHaveAttribute('controls')
                expect(audio).toHaveAttribute('preload', 'metadata')

                const source = audio?.querySelector('source')
                expect(source).toHaveAttribute('src', blobUrl)
            })
        })
    })

    describe('Video File Preview', () => {
        it('should display video player with controls', async () => {
            const blobUrl = '/.netlify/functions/blobs?action=GET&key=video.mp4&store=test-container&raw=true'
            mockBlobsApi.getBlobUrl.mockReturnValue(blobUrl)
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'base64data',
                metadata: { isBase64: true }
            }))

            render(<FilePreview {...defaultProps} file={mockVideoFile} />)

            await waitFor(() => {
                const video = screen.getByTestId('video-player') || document.querySelector('video')
                expect(video).toBeInTheDocument()
                expect(video).toHaveAttribute('controls')
                expect(video).toHaveAttribute('preload', 'metadata')

                const source = video?.querySelector('source')
                expect(source).toHaveAttribute('src', blobUrl)
            })
        })
    })

    describe('File Download', () => {
        it('should download file successfully', async () => {
            const textContent = 'File content to download'
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse(textContent))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: textContent,
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                const downloadButton = screen.getByLabelText(/download/i)
                fireEvent.click(downloadButton)
            })

            await waitFor(() => {
                expect(mockBlobsApi.getBlob).toHaveBeenCalledWith('document.txt', 'test-container', 'text')
                expect(mockCreateObjectURL).toHaveBeenCalled()
                expect(mockRevokeObjectURL).toHaveBeenCalled()
            })
        })

        it('should handle download errors', async () => {
            mockBlobsApi.getBlob.mockResolvedValueOnce(mockApiResponse('initial content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                mockBlobsApi.getBlob.mockResolvedValueOnce(mockApiError('Download failed', 'DOWNLOAD_ERROR'))

                const downloadButton = screen.getByLabelText(/download/i)
                fireEvent.click(downloadButton)
            })

            await waitFor(() => {
                expect(screen.getByText('Download failed')).toBeInTheDocument()
            })
        })
    })

    describe('Metadata Display', () => {
        it('should toggle metadata display', async () => {
            const metadata = {
                author: 'John Doe',
                created: '2025-01-30T10:00:00Z',
                tags: ['test', 'document']
            }

            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('File content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                const metadataToggle = screen.getByLabelText(/show metadata/i)
                fireEvent.click(metadataToggle)

                expect(screen.getByText('John Doe')).toBeInTheDocument()
                expect(screen.getByText('test, document')).toBeInTheDocument()
            })
        })

        it('should handle missing metadata gracefully', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('File content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                const metadataToggle = screen.getByLabelText(/show metadata/i)
                fireEvent.click(metadataToggle)

                expect(screen.getByText(/No metadata available/i)).toBeInTheDocument()
            })
        })
    })

    describe('File Type Detection', () => {
        it('should correctly identify file types by extension', () => {
            const testCases = [
                { filename: 'photo.jpg', expectedIcon: 'ImageIcon' },
                { filename: 'script.js', expectedIcon: 'CodeIcon' },
                { filename: 'data.json', expectedIcon: 'DataObjectIcon' },
                { filename: 'readme.txt', expectedIcon: 'DescriptionIcon' },
                { filename: 'unknown.xyz', expectedIcon: 'InsertDriveFileIcon' }
            ]

            testCases.forEach(({ filename, expectedIcon }) => {
                const file = { ...mockTextFile, key: filename }
                mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('content'))

                const { rerender } = render(<FilePreview {...defaultProps} file={file} />)

                expect(screen.getByTestId(expectedIcon)).toBeInTheDocument()

                rerender(<FilePreview {...defaultProps} file={null} />)
            })
        })

        it('should handle files without extensions', async () => {
            const fileWithoutExt = { ...mockTextFile, key: 'README' }
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={fileWithoutExt} />)

            await waitFor(() => {
                expect(screen.getByTestId('InsertDriveFileIcon')).toBeInTheDocument()
            })
        })
    })

    describe('Refresh Functionality', () => {
        it('should refresh file content', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('Original content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                expect(screen.getByText('Original content')).toBeInTheDocument()
            })

            // Update mock to return new content
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('Updated content'))

            const refreshButton = screen.getByLabelText(/refresh/i)
            fireEvent.click(refreshButton)

            await waitFor(() => {
                expect(mockBlobsApi.getBlob).toHaveBeenCalledTimes(2)
                expect(screen.getByText('Updated content')).toBeInTheDocument()
            })
        })
    })

    describe('Content Size Formatting', () => {
        it('should format file sizes correctly', () => {
            const testCases = [
                { size: 500, expected: '500 B' },
                { size: 1024, expected: '1.0 KB' },
                { size: 1536, expected: '1.5 KB' },
                { size: 1048576, expected: '1.0 MB' },
                { size: 2097152, expected: '2.0 MB' }
            ]

            testCases.forEach(({ size, expected }) => {
                const file = { ...mockTextFile, size }
                mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('content'))

                const { rerender } = render(<FilePreview {...defaultProps} file={file} />)

                expect(screen.getByText(expected)).toBeInTheDocument()

                rerender(<FilePreview {...defaultProps} file={null} />)
            })
        })
    })

    describe('Error Recovery', () => {
        it('should allow error clearing and retry', async () => {
            // First load with error
            mockBlobsApi.getBlob.mockResolvedValueOnce(mockApiError('Network error', 'NETWORK_ERROR'))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument()
            })

            // Close error and retry
            const closeButton = screen.getByLabelText(/close/i)
            fireEvent.click(closeButton)

            mockBlobsApi.getBlob.mockResolvedValueOnce(mockApiResponse('Success content'))

            const refreshButton = screen.getByLabelText(/refresh/i)
            fireEvent.click(refreshButton)

            await waitFor(() => {
                expect(screen.queryByText('Network error')).not.toBeInTheDocument()
                expect(screen.getByText('Success content')).toBeInTheDocument()
            })
        })
    })

    describe('Accessibility', () => {
        it('should have proper ARIA labels and roles', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument()
                expect(screen.getByLabelText(/download/i)).toBeInTheDocument()
                expect(screen.getByLabelText(/show metadata/i)).toBeInTheDocument()
                expect(screen.getByLabelText(/show raw content/i)).toBeInTheDocument()
            })
        })

        it('should support keyboard navigation', async () => {
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('content'))
            mockBlobsApi.getBlobWithMetadata.mockResolvedValue(mockApiResponse({
                data: 'content',
                metadata: {}
            }))

            render(<FilePreview {...defaultProps} file={mockTextFile} />)

            await waitFor(() => {
                const buttons = screen.getAllByRole('button')
                expect(buttons.length).toBeGreaterThan(0)

                // Check that all buttons have tabIndex
                for (const button of buttons) {
                    expect(button).toHaveAttribute('tabIndex')
                }
            })
        })
    })
})

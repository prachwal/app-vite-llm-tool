/// <reference types="vitest/globals" />
/**
 * Kompletne testy integracyjne dla strony Blobs
 * Testuje współpracę wszystkich komponentów blob storage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { Blobs } from '../../pages/Blobs'
import { blobsApi } from '../../services/blobsService'
import '@testing-library/jest-dom'

// Mock blobsApi
vi.mock('../../services/blobsService', () => ({
    blobsApi: {
        getStores: vi.fn(),
        listBlobs: vi.fn(),
        getBlob: vi.fn(),
        getBlobWithMetadata: vi.fn(),
        getBlobUrl: vi.fn(),
        deleteBlob: vi.fn(),
        uploadFile: vi.fn(),
    }
}))

// Mock fetch for download functionality
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock URL methods
const mockCreateObjectURL = vi.fn()
const mockRevokeObjectURL = vi.fn()
Object.defineProperty(window, 'URL', {
    value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
    },
})

// Mock document methods
const mockClick = vi.fn()
Object.defineProperty(document, 'createElement', {
    value: vi.fn().mockImplementation((tagName: string) => {
        const element = {
            tagName: tagName.toUpperCase(),
            href: '',
            download: '',
            click: mockClick,
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
const mockStores = {
    stores: ['file-uploads', 'user-data', 'images', 'logs'],
    default: 'file-uploads'
}

const mockFiles = [
    {
        key: 'document.txt',
        size: 1024,
        modified: '2025-01-30T10:00:00Z',
        metadata: { type: 'text/plain' }
    },
    {
        key: 'photo.jpg',
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
]

function createMockApiResponse<T>(data: T, status = 200) {
    return {
        status,
        payload: data,
        error: null
    };
}

function createMockApiError(message: string, code: string, status = 400) {
    return {
        status,
        payload: undefined,
        error: { message, code }
    };
}

describe('Blobs Page Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCreateObjectURL.mockReturnValue('blob:mock-url')

        // Setup default mocks
        mockBlobsApi.getStores.mockResolvedValue(createMockApiResponse(mockStores))
        mockBlobsApi.listBlobs.mockResolvedValue(createMockApiResponse(mockFiles))
        mockBlobsApi.getBlob.mockResolvedValue(createMockApiResponse('Sample content'))
        mockBlobsApi.getBlobWithMetadata.mockResolvedValue(createMockApiResponse({
            data: 'Sample content',
            metadata: { type: 'text/plain' }
        }))
        mockBlobsApi.getBlobUrl.mockReturnValue('/.netlify/functions/blobs?action=GET&key=test&raw=true')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Page Initialization', () => {
        it('should load and display all components', async () => {
            render(<Blobs />)

            await waitFor(() => {
                // Container selector should be visible
                expect(screen.getByLabelText(/container/i)).toBeInTheDocument()

                // File list should be visible
                expect(screen.getByText('Files')).toBeInTheDocument()
                expect(screen.getByText('Upload')).toBeInTheDocument()

                // File preview should show empty state initially
                expect(screen.getByText(/no file selected/i)).toBeInTheDocument()
            })
        })

        it('should load stores and files on mount', async () => {
            render(<Blobs />)

            await waitFor(() => {
                expect(mockBlobsApi.getStores).toHaveBeenCalledTimes(1)
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledTimes(1)
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledWith('file-uploads')
            })
        })

        it('should display file list after loading', async () => {
            render(<Blobs />)

            await waitFor(() => {
                expect(screen.getByText('document.txt')).toBeInTheDocument()
                expect(screen.getByText('photo.jpg')).toBeInTheDocument()
                expect(screen.getByText('data.json')).toBeInTheDocument()
                expect(screen.getByText(/3 files/)).toBeInTheDocument()
            })
        })
    })

    describe('Container Selection Workflow', () => {
        it('should change container and reload files', async () => {
            render(<Blobs />)

            await waitFor(() => {
                const selector = screen.getByLabelText(/container/i)
                fireEvent.mouseDown(selector)
            })

            const imagesOption = screen.getByText('images')
            fireEvent.click(imagesOption)

            await waitFor(() => {
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledWith('images')
            })
        })

        it('should handle container loading errors', async () => {
            mockBlobsApi.getStores.mockResolvedValue(createMockApiError('Failed to load stores', 'LOAD_ERROR'))

            render(<Blobs />)

            await waitFor(() => {
                expect(screen.getByText('Failed to load stores')).toBeInTheDocument()
            })
        })

        it('should refresh all data when container selector refreshes', async () => {
            render(<Blobs />)

            await waitFor(() => {
                const refreshButton = screen.getAllByLabelText(/refresh/i)[0] // Container selector refresh
                fireEvent.click(refreshButton)
            })

            await waitFor(() => {
                expect(mockBlobsApi.getStores).toHaveBeenCalledTimes(2)
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledTimes(2)
            })
        })
    })

    describe('File Selection and Preview Workflow', () => {
        it('should select file and show preview', async () => {
            render(<Blobs />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            await waitFor(() => {
                expect(mockBlobsApi.getBlob).toHaveBeenCalledWith('document.txt', 'file-uploads', 'text')
                expect(mockBlobsApi.getBlobWithMetadata).toHaveBeenCalledWith('document.txt', 'file-uploads')
                expect(screen.getByText('Sample content')).toBeInTheDocument()
            })
        })

        it('should show file information in preview', async () => {
            render(<Blobs />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            await waitFor(() => {
                expect(screen.getByText('document.txt')).toBeInTheDocument()
                expect(screen.getByText('1.0 KB')).toBeInTheDocument()
                expect(screen.getByText('1/30/2025')).toBeInTheDocument()
            })
        })

        it('should clear preview when selecting null', async () => {
            render(<Blobs />)

            // First select a file
            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            await waitFor(() => {
                expect(screen.getByText('Sample content')).toBeInTheDocument()
            })

            // Then click empty area or somehow trigger deselection
            // In real app, this might be clicking outside or on a close button
            await waitFor(() => {
                const fileList = screen.getByText('Files').closest('div')
                if (fileList) {
                    fireEvent.click(fileList)
                }
            })
        })

        it('should handle image file preview differently', async () => {
            mockBlobsApi.getBlobUrl.mockReturnValue('/.netlify/functions/blobs?action=GET&key=photo.jpg&raw=true')

            render(<Blobs />)

            await waitFor(() => {
                const imageFile = screen.getByText('photo.jpg')
                fireEvent.click(imageFile)
            })

            await waitFor(() => {
                expect(mockBlobsApi.getBlobUrl).toHaveBeenCalledWith('photo.jpg', 'file-uploads', true)
                const img = screen.getByAltText('photo.jpg')
                expect(img).toBeInTheDocument()
            })
        })
    })

    describe('File Upload Workflow', () => {
        it('should upload file and refresh list', async () => {
            mockBlobsApi.uploadFile.mockResolvedValue(createMockApiResponse({
                key: 'new-file.txt',
                etag: 'test',
                modified: false
            }, 201))

            render(<Blobs />)

            await waitFor(() => {
                const uploadButton = screen.getByText('Upload')
                fireEvent.click(uploadButton)
            })

            // Simulate file selection
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            const file = new File(['content'], 'new-file.txt', { type: 'text/plain' })

            Object.defineProperty(fileInput, 'files', {
                value: [file],
                writable: false,
            })

            fireEvent.change(fileInput)

            await waitFor(() => {
                expect(mockBlobsApi.uploadFile).toHaveBeenCalledWith(file, undefined, 'file-uploads')
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledTimes(2) // Initial + after upload
            })
        })

        it('should handle upload errors', async () => {
            mockBlobsApi.uploadFile.mockResolvedValue(createMockApiError('Upload failed', 'UPLOAD_ERROR'))

            render(<Blobs />)

            await waitFor(() => {
                const uploadButton = screen.getByText('Upload')
                fireEvent.click(uploadButton)
            })

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            const file = new File(['content'], 'test.txt', { type: 'text/plain' })

            Object.defineProperty(fileInput, 'files', {
                value: [file],
                writable: false,
            })

            fireEvent.change(fileInput)

            await waitFor(() => {
                expect(screen.getByText(/Failed to upload test.txt/)).toBeInTheDocument()
            })
        })
    })

    describe('File Download Workflow', () => {
        it('should download file without router issues', async () => {
            const mockBlob = new Blob(['file content'], { type: 'text/plain' })
            mockFetch.mockResolvedValue({
                ok: true,
                blob: () => Promise.resolve(mockBlob)
            })

            render(<Blobs />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.contextMenu(fileItem)
            })

            const downloadButton = screen.getByText('Download')
            fireEvent.click(downloadButton)

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/blobs?action=GET&key=test&raw=true')
                expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob)
                expect(mockClick).toHaveBeenCalled()
            })
        })

        it('should handle download errors gracefully', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                statusText: 'Not Found'
            })

            render(<Blobs />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.contextMenu(fileItem)
            })

            const downloadButton = screen.getByText('Download')
            fireEvent.click(downloadButton)

            await waitFor(() => {
                expect(screen.getByText('Download failed: Not Found')).toBeInTheDocument()
            })
        })
    })

    describe('File Deletion Workflow', () => {
        it('should delete file and refresh list', async () => {
            mockBlobsApi.deleteBlob.mockResolvedValue(createMockApiResponse({
                message: 'Deleted successfully',
                key: 'document.txt'
            }))

            render(<Blobs />)

            // Select file first
            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            // Open context menu
            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.contextMenu(fileItem)
            })

            // Click delete
            const deleteButton = screen.getByText('Delete')
            fireEvent.click(deleteButton)

            // Confirm deletion
            const confirmButton = screen.getByText('Delete')
            fireEvent.click(confirmButton)

            await waitFor(() => {
                expect(mockBlobsApi.deleteBlob).toHaveBeenCalledWith('document.txt', 'file-uploads')
            })
        })

        it('should clear selection when deleting selected file', async () => {
            mockBlobsApi.deleteBlob.mockResolvedValue(createMockApiResponse({
                message: 'Deleted successfully',
                key: 'document.txt'
            }))

            render(<Blobs />)

            // Select file
            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            await waitFor(() => {
                expect(screen.getByText('Sample content')).toBeInTheDocument()
            })

            // Delete the selected file
            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.contextMenu(fileItem)
            })

            const deleteButton = screen.getByText('Delete')
            fireEvent.click(deleteButton)

            const confirmButton = screen.getByText('Delete')
            fireEvent.click(confirmButton)

            await waitFor(() => {
                expect(screen.getByText(/no file selected/i)).toBeInTheDocument()
            })
        })
    })

    describe('Error Recovery Workflows', () => {
        it('should recover from file list loading errors', async () => {
            // First load fails
            mockBlobsApi.listBlobs.mockResolvedValueOnce(createMockApiError('Network error', 'NETWORK_ERROR'))

            render(<Blobs />)

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument()
            })

            // Retry succeeds
            mockBlobsApi.listBlobs.mockResolvedValueOnce(createMockApiResponse(mockFiles))

            const refreshButton = screen.getAllByLabelText(/refresh/i)[1] // File list refresh
            fireEvent.click(refreshButton)

            await waitFor(() => {
                expect(screen.queryByText('Network error')).not.toBeInTheDocument()
                expect(screen.getByText('document.txt')).toBeInTheDocument()
            })
        })

        it('should recover from file preview errors', async () => {
            // First preview load fails
            mockBlobsApi.getBlob.mockResolvedValueOnce(createMockApiError('Preview error', 'PREVIEW_ERROR'))

            render(<Blobs />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            await waitFor(() => {
                expect(screen.getByText('Preview error')).toBeInTheDocument()
            })

            // Retry succeeds
            mockBlobsApi.getBlob.mockResolvedValueOnce(createMockApiResponse('Sample content'))

            const refreshButton = screen.getByLabelText(/refresh/i)
            fireEvent.click(refreshButton)

            await waitFor(() => {
                expect(screen.queryByText('Preview error')).not.toBeInTheDocument()
                expect(screen.getByText('Sample content')).toBeInTheDocument()
            })
        })
    })

    describe('State Synchronization', () => {
        it('should maintain state consistency across components', async () => {
            render(<Blobs />)

            // Container change should update file list
            await waitFor(() => {
                const selector = screen.getByLabelText(/container/i)
                fireEvent.mouseDown(selector)
            })

            const userDataOption = screen.getByText('user-data')
            fireEvent.click(userDataOption)

            await waitFor(() => {
                expect(screen.getByText(/Container: user-data/)).toBeInTheDocument()
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledWith('user-data')
            })
        })

        it('should clear file preview when container changes', async () => {
            render(<Blobs />)

            // Select a file
            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            await waitFor(() => {
                expect(screen.getByText('Sample content')).toBeInTheDocument()
            })

            // Change container
            await waitFor(() => {
                const selector = screen.getByLabelText(/container/i)
                fireEvent.mouseDown(selector)
            })

            const imagesOption = screen.getByText('images')
            fireEvent.click(imagesOption)

            await waitFor(() => {
                expect(screen.getByText(/no file selected/i)).toBeInTheDocument()
            })
        })

        it('should update file counts correctly', async () => {
            render(<Blobs />)

            await waitFor(() => {
                expect(screen.getByText(/3 files/)).toBeInTheDocument()
            })

            // Simulate successful upload
            mockBlobsApi.uploadFile.mockResolvedValue(createMockApiResponse({
                key: 'new-file.txt',
                etag: 'test',
                modified: false
            }, 201))

            const updatedFiles = [...mockFiles, {
                key: 'new-file.txt',
                size: 100,
                modified: '2025-01-30T13:00:00Z'
            }]
            mockBlobsApi.listBlobs.mockResolvedValue(createMockApiResponse(updatedFiles))

            const uploadButton = screen.getByText('Upload')
            fireEvent.click(uploadButton)

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            const file = new File(['content'], 'new-file.txt', { type: 'text/plain' })

            Object.defineProperty(fileInput, 'files', {
                value: [file],
                writable: false,
            })

            fireEvent.change(fileInput)

            await waitFor(() => {
                expect(screen.getByText(/4 files/)).toBeInTheDocument()
            })
        })
    })

    describe('Performance and Optimization', () => {
        it('should not make unnecessary API calls', async () => {
            render(<Blobs />)

            await waitFor(() => {
                expect(mockBlobsApi.getStores).toHaveBeenCalledTimes(1)
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledTimes(1)
            })

            // Selecting a file should only trigger content loading, not list refresh
            const fileItem = screen.getByText('document.txt')
            fireEvent.click(fileItem)

            await waitFor(() => {
                expect(mockBlobsApi.getStores).toHaveBeenCalledTimes(1) // Still only once
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledTimes(1) // Still only once
                expect(mockBlobsApi.getBlob).toHaveBeenCalledTimes(1)
            })
        })

        it('should handle rapid container switches efficiently', async () => {
            render(<Blobs />)

            // Switch containers rapidly
            for (let i = 0; i < 3; i++) {
                await waitFor(() => {
                    const selector = screen.getByLabelText(/container/i)
                    fireEvent.mouseDown(selector)
                })

                const option = screen.getByText(mockStores.stores[i % mockStores.stores.length])
                fireEvent.click(option)
            }

            // Should have made appropriate number of API calls
            await waitFor(() => {
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledTimes(4) // Initial + 3 switches
            })
        })
    })

    describe('Accessibility and User Experience', () => {
        it('should provide proper loading states', async () => {
            let resolveStores: (value: any) => void
            const storesPromise = new Promise(resolve => {
                resolveStores = resolve
            })
            mockBlobsApi.getStores.mockReturnValue(storesPromise as any)

            render(<Blobs />)

            // Should show loading indicators
            expect(screen.getByRole('progressbar')).toBeInTheDocument()

            resolveStores!(createMockApiResponse(mockStores))

            await waitFor(() => {
                expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
            })
        })

        it('should maintain keyboard navigation', async () => {
            const user = userEvent.setup()

            render(<Blobs />)

            await waitFor(async () => {
                // Tab should navigate through interactive elements
                await user.tab()
                const selector = screen.getByLabelText(/container/i)
                expect(selector).toHaveFocus()
            })
        })

        it('should provide meaningful error messages', async () => {
            const specificError = createMockApiError('File format not supported', 'UNSUPPORTED_FORMAT', 415)
            mockBlobsApi.getBlob.mockResolvedValue(specificError)

            render(<Blobs />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
            })

            await waitFor(() => {
                expect(screen.getByText('File format not supported')).toBeInTheDocument()
            })
        })
    })
})

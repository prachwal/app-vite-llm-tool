/**
 * Kompletne testy dla komponentu FileList
 * Testuje wszystkie aspekty zarządzania plikami w blob storage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { FileList, fileList, isLoadingFiles } from '../../../components/blobs/FileList'
import { blobsApi, type BlobItem, type ApiResponse } from '../../../services/blobsService'
import '@testing-library/jest-dom'

// Mock blobsApi
vi.mock('../../../services/blobsService', () => ({
    blobsApi: {
        listBlobs: vi.fn(),
        getBlob: vi.fn(),
        deleteBlob: vi.fn(),
        uploadFile: vi.fn(),
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
const mockBlobItems: BlobItem[] = [
    {
        key: 'document.txt',
        size: 1024,
        modified: '2025-01-30T10:00:00Z',
        metadata: { type: 'text/plain' }
    },
    {
        key: 'image.png',
        size: 2048,
        modified: '2025-01-30T11:00:00Z',
        metadata: { type: 'image/png' }
    },
    {
        key: 'data.json',
        size: 512,
        modified: '2025-01-30T12:00:00Z',
        metadata: { type: 'application/json' }
    }
]

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

describe('FileList Component', () => {
    const defaultProps = {
        container: 'test-container',
        selectedFile: null,
        onFileSelect: vi.fn(),
        onRefresh: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
        fileList.value = []
        isLoadingFiles.value = false
        mockCreateObjectURL.mockReturnValue('blob:mock-url')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Rendering', () => {
        it('should render FileList component with header', () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            expect(screen.getByText('Files')).toBeInTheDocument()
            expect(screen.getByText(/Container: test-container/)).toBeInTheDocument()
            expect(screen.getByText('Upload')).toBeInTheDocument()
            expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument()
        })

        it('should show loading state', () => {
            isLoadingFiles.value = true
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
            expect(screen.getByText('Upload')).toBeDisabled()
        })

        it('should show empty state when no files', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse([]))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('No files in this container')).toBeInTheDocument()
            })
        })

        it('should display error message', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiError('Failed to load', 'LOAD_ERROR'))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Failed to load')).toBeInTheDocument()
            })
        })
    })

    describe('File Loading', () => {
        it('should load files on container change', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledWith('test-container')
                expect(screen.getByText('document.txt')).toBeInTheDocument()
                expect(screen.getByText('image.png')).toBeInTheDocument()
                expect(screen.getByText('data.json')).toBeInTheDocument()
            })
        })

        it('should update file count display', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText(/3 files/)).toBeInTheDocument()
            })
        })

        it('should handle network errors gracefully', async () => {
            mockBlobsApi.listBlobs.mockRejectedValue(new Error('Network error'))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument()
            })
        })
    })

    describe('File Selection', () => {
        it('should call onFileSelect when file is clicked', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            const onFileSelect = vi.fn()

            render(<FileList {...defaultProps} onFileSelect={onFileSelect} />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt')
                fireEvent.click(fileItem)
                expect(onFileSelect).toHaveBeenCalledWith(mockBlobItems[0])
            })
        })

        it('should highlight selected file', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} selectedFile="document.txt" />)

            await waitFor(() => {
                const selectedItem = screen.getByText('document.txt').closest('[class*="Mui-selected"]')
                expect(selectedItem).toBeInTheDocument()
            })
        })
    })

    describe('File Icons', () => {
        it('should display correct icons for different file types', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                // Images should show image icon
                const imageFile = screen.getByText('image.png').closest('li')
                expect(imageFile?.querySelector('[data-testid="ImageIcon"]')).toBeInTheDocument()

                // JSON should show data object icon
                const jsonFile = screen.getByText('data.json').closest('li')
                expect(jsonFile?.querySelector('[data-testid="DataObjectIcon"]')).toBeInTheDocument()

                // Text should show description icon
                const textFile = screen.getByText('document.txt').closest('li')
                expect(textFile?.querySelector('[data-testid="DescriptionIcon"]')).toBeInTheDocument()
            })
        })
    })

    describe('File Information Display', () => {
        it('should format and display file sizes correctly', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('1.0 KB')).toBeInTheDocument() // 1024 bytes
                expect(screen.getByText('2.0 KB')).toBeInTheDocument() // 2048 bytes
                expect(screen.getByText('512 B')).toBeInTheDocument() // 512 bytes
            })
        })

        it('should format and display modification dates', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('1/30/2025')).toBeInTheDocument()
            })
        })
    })

    describe('Context Menu', () => {
        it('should show context menu on right click', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt').closest('li')
                if (fileItem) {
                    fireEvent.contextMenu(fileItem)
                    expect(screen.getByText('Download')).toBeInTheDocument()
                    expect(screen.getByText('Rename')).toBeInTheDocument()
                    expect(screen.getByText('Delete')).toBeInTheDocument()
                }
            })
        })

        it('should show context menu on more options click', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                const moreButton = screen.getAllByLabelText(/more/i)[0]
                fireEvent.click(moreButton)
                expect(screen.getByText('Download')).toBeInTheDocument()
            })
        })
    })

    describe('File Download', () => {
        it('should download file successfully', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            mockBlobsApi.getBlob.mockResolvedValue(mockApiResponse('file content'))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt').closest('li')
                if (fileItem) {
                    fireEvent.contextMenu(fileItem)
                }
            })

            const downloadButton = screen.getByText('Download')
            fireEvent.click(downloadButton)

            await waitFor(() => {
                expect(mockBlobsApi.getBlob).toHaveBeenCalledWith('document.txt', 'test-container', 'text')
                expect(mockCreateObjectURL).toHaveBeenCalled()
                expect(mockRevokeObjectURL).toHaveBeenCalled()
            })
        })

        it('should handle download errors', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            mockBlobsApi.getBlob.mockResolvedValue(mockApiError('Download failed', 'DOWNLOAD_ERROR'))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt').closest('li')
                if (fileItem) {
                    fireEvent.contextMenu(fileItem)
                }
            })

            const downloadButton = screen.getByText('Download')
            fireEvent.click(downloadButton)

            await waitFor(() => {
                expect(screen.getByText('Download failed')).toBeInTheDocument()
            })
        })
    })

    describe('File Deletion', () => {
        it('should show delete confirmation dialog', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt').closest('li')
                if (fileItem) {
                    fireEvent.contextMenu(fileItem)
                }
            })

            const deleteButton = screen.getByText('Delete')
            fireEvent.click(deleteButton)

            expect(screen.getByText('Delete File')).toBeInTheDocument()
            expect(screen.getByText(/Are you sure you want to delete "document.txt"/)).toBeInTheDocument()
        })

        it('should delete file successfully', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            mockBlobsApi.deleteBlob.mockResolvedValue(mockApiResponse({ message: 'Deleted', key: 'document.txt' }))
            const onFileSelect = vi.fn()

            render(<FileList {...defaultProps} selectedFile="document.txt" onFileSelect={onFileSelect} />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt').closest('li')
                if (fileItem) {
                    fireEvent.contextMenu(fileItem)
                }
            })

            const deleteButton = screen.getByText('Delete')
            fireEvent.click(deleteButton)

            const confirmButton = screen.getByText('Delete')
            fireEvent.click(confirmButton)

            await waitFor(() => {
                expect(mockBlobsApi.deleteBlob).toHaveBeenCalledWith('document.txt', 'test-container')
                expect(onFileSelect).toHaveBeenCalledWith(null) // Clear selection
            })
        })

        it('should handle delete errors', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            mockBlobsApi.deleteBlob.mockResolvedValue(mockApiError('Delete failed', 'DELETE_ERROR'))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                const fileItem = screen.getByText('document.txt').closest('li')
                if (fileItem) {
                    fireEvent.contextMenu(fileItem)
                }
            })

            const deleteButton = screen.getByText('Delete')
            fireEvent.click(deleteButton)

            const confirmButton = screen.getByText('Delete')
            fireEvent.click(confirmButton)

            await waitFor(() => {
                expect(screen.getByText('Delete failed')).toBeInTheDocument()
            })
        })
    })

    describe('File Upload', () => {
        it('should upload single file successfully', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            mockBlobsApi.uploadFile.mockResolvedValue(mockApiResponse({ key: 'new-file.txt', etag: 'etag', modified: false }))

            render(<FileList {...defaultProps} />)

            const uploadButton = screen.getByText('Upload')
            fireEvent.click(uploadButton)

            // Simulate file input change
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            const file = new File(['content'], 'new-file.txt', { type: 'text/plain' })

            Object.defineProperty(fileInput, 'files', {
                value: [file],
                writable: false,
            })

            fireEvent.change(fileInput)

            await waitFor(() => {
                expect(mockBlobsApi.uploadFile).toHaveBeenCalledWith(file, undefined, 'test-container')
            })
        })

        it('should upload multiple files', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            mockBlobsApi.uploadFile.mockResolvedValue(mockApiResponse({ key: 'file', etag: 'etag', modified: false }))

            render(<FileList {...defaultProps} />)

            const uploadButton = screen.getByText('Upload')
            fireEvent.click(uploadButton)

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            const files = [
                new File(['content1'], 'file1.txt', { type: 'text/plain' }),
                new File(['content2'], 'file2.txt', { type: 'text/plain' })
            ]

            Object.defineProperty(fileInput, 'files', {
                value: files,
                writable: false,
            })

            fireEvent.change(fileInput)

            await waitFor(() => {
                expect(mockBlobsApi.uploadFile).toHaveBeenCalledTimes(2)
            })
        })

        it('should handle upload errors', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            mockBlobsApi.uploadFile.mockResolvedValue(mockApiError('Upload failed', 'UPLOAD_ERROR'))

            render(<FileList {...defaultProps} />)

            const uploadButton = screen.getByText('Upload')
            fireEvent.click(uploadButton)

            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
            const file = new File(['content'], 'file.txt', { type: 'text/plain' })

            Object.defineProperty(fileInput, 'files', {
                value: [file],
                writable: false,
            })

            fireEvent.change(fileInput)

            await waitFor(() => {
                expect(screen.getByText(/Failed to upload file.txt/)).toBeInTheDocument()
            })
        })
    })

    describe('Refresh Functionality', () => {
        it('should refresh file list when refresh button clicked', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            const onRefresh = vi.fn()

            render(<FileList {...defaultProps} onRefresh={onRefresh} />)

            const refreshButton = screen.getByLabelText(/refresh/i)
            fireEvent.click(refreshButton)

            await waitFor(() => {
                expect(mockBlobsApi.listBlobs).toHaveBeenCalledTimes(2) // Initial load + manual refresh
                expect(onRefresh).toHaveBeenCalled()
            })
        })

        it('should disable refresh during loading', () => {
            isLoadingFiles.value = true
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            const refreshButton = screen.getByLabelText(/refresh/i)
            expect(refreshButton).toBeDisabled()
        })
    })

    describe('Error Handling', () => {
        it('should allow closing error alerts', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiError('Test error', 'TEST_ERROR'))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Test error')).toBeInTheDocument()
            })

            const closeButton = screen.getByLabelText(/close/i)
            fireEvent.click(closeButton)

            expect(screen.queryByText('Test error')).not.toBeInTheDocument()
        })

        it('should clear errors on successful operations', async () => {
            // First load with error
            mockBlobsApi.listBlobs.mockResolvedValueOnce(mockApiError('Initial error', 'ERROR'))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Initial error')).toBeInTheDocument()
            })

            // Then successful refresh
            mockBlobsApi.listBlobs.mockResolvedValueOnce(mockApiResponse(mockBlobItems))

            const refreshButton = screen.getByLabelText(/refresh/i)
            fireEvent.click(refreshButton)

            await waitFor(() => {
                expect(screen.queryByText('Initial error')).not.toBeInTheDocument()
                expect(screen.getByText('document.txt')).toBeInTheDocument()
            })
        })
    })

    describe('Accessibility', () => {
        it('should have proper ARIA labels', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))

            render(<FileList {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument()
                expect(screen.getByRole('list')).toBeInTheDocument()
                expect(screen.getAllByRole('listitem')).toHaveLength(3)
            })
        })

        it('should support keyboard navigation', async () => {
            mockBlobsApi.listBlobs.mockResolvedValue(mockApiResponse(mockBlobItems))
            const user = userEvent.setup()

            render(<FileList {...defaultProps} />)

            await waitFor(async () => {
                const firstFile = screen.getByText('document.txt').closest('button')
                if (firstFile) {
                    await user.tab()
                    expect(firstFile).toHaveFocus()
                }
            })
        })
    })
})

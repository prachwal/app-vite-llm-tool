/**
 * Kompletne testy dla komponentu ContainerSelector
 * Testuje zarządzanie kontenerami blob storage
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { ContainerSelector, availableContainers, defaultContainer, isLoading } from '../../../components/blobs/ContainerSelector'
import { blobsApi, type ApiResponse } from '../../../services/blobsService'
import '@testing-library/jest-dom'

// Mock blobsApi
vi.mock('../../../services/blobsService', () => ({
    blobsApi: {
        getStores: vi.fn(),
    },
}))

const mockBlobsApi = vi.mocked(blobsApi)

// Test data
const mockStores = {
    stores: ['file-uploads', 'user-data', 'images', 'logs'],
    default: 'file-uploads'
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

describe('ContainerSelector Component', () => {
    const defaultProps = {
        selectedContainer: 'file-uploads',
        onContainerChange: vi.fn(),
        onRefresh: vi.fn()
    }

    beforeEach(() => {
        vi.clearAllMocks()
        availableContainers.value = []
        defaultContainer.value = ''
        isLoading.value = false
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Component Rendering', () => {
        it('should render container selector with dropdown', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByLabelText(/container/i)).toBeInTheDocument()
                expect(screen.getByDisplayValue('file-uploads')).toBeInTheDocument()
            })
        })

        it('should show loading state', () => {
            isLoading.value = true
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            expect(screen.getByRole('progressbar')).toBeInTheDocument()
        })

        it('should display error message', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiError('Failed to load stores', 'LOAD_ERROR'))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Failed to load stores')).toBeInTheDocument()
            })
        })

        it('should show refresh button', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument()
        })
    })

    describe('Container Loading', () => {
        it('should load containers on mount', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(mockBlobsApi.getStores).toHaveBeenCalledTimes(1)
                expect(availableContainers.value).toEqual(mockStores.stores)
                expect(defaultContainer.value).toBe(mockStores.default)
            })
        })

        it('should handle loading errors', async () => {
            mockBlobsApi.getStores.mockRejectedValue(new Error('Network error'))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument()
                expect(availableContainers.value).toEqual([])
            })
        })

        it('should handle API errors', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiError('API Error', 'API_ERROR'))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('API Error')).toBeInTheDocument()
                expect(availableContainers.value).toEqual([])
            })
        })
    })

    describe('Container Selection', () => {
        it('should call onContainerChange when selection changes', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const onContainerChange = vi.fn()

            render(<ContainerSelector {...defaultProps} onContainerChange={onContainerChange} />)

            await waitFor(() => {
                const selector = screen.getByLabelText(/container/i)
                fireEvent.mouseDown(selector)
            })

            const option = screen.getByText('images')
            fireEvent.click(option)

            expect(onContainerChange).toHaveBeenCalledWith('images')
        })

        it('should display all available containers in dropdown', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                const selector = screen.getByLabelText(/container/i)
                fireEvent.mouseDown(selector)
            })

            mockStores.stores.forEach(store => {
                expect(screen.getByText(store)).toBeInTheDocument()
            })
        })

        it('should highlight default container', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} selectedContainer="file-uploads" />)

            await waitFor(() => {
                expect(screen.getByDisplayValue('file-uploads')).toBeInTheDocument()
            })
        })
    })

    describe('Container Management', () => {
        it('should show add container dialog', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                const addButton = screen.getByLabelText(/add container/i)
                fireEvent.click(addButton)
            })

            expect(screen.getByText('Add New Container')).toBeInTheDocument()
            expect(screen.getByLabelText(/container name/i)).toBeInTheDocument()
        })

        it('should validate container name input', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const user = userEvent.setup()

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                const addButton = screen.getByLabelText(/add container/i)
                fireEvent.click(addButton)
            })

            const input = screen.getByLabelText(/container name/i)
            const createButton = screen.getByText('Create')

            // Test empty name
            expect(createButton).toBeDisabled()

            // Test valid name
            await user.type(input, 'new-container')
            expect(createButton).toBeEnabled()

            // Test invalid characters
            await user.clear(input)
            await user.type(input, 'invalid name!')
            expect(createButton).toBeDisabled()
        })

        it('should create new container', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const onContainerChange = vi.fn()
            const user = userEvent.setup()

            render(<ContainerSelector {...defaultProps} onContainerChange={onContainerChange} />)

            await waitFor(() => {
                const addButton = screen.getByLabelText(/add container/i)
                fireEvent.click(addButton)
            })

            const input = screen.getByLabelText(/container name/i)
            await user.type(input, 'new-container')

            const createButton = screen.getByText('Create')
            fireEvent.click(createButton)

            await waitFor(() => {
                expect(availableContainers.value).toContain('new-container')
                expect(onContainerChange).toHaveBeenCalledWith('new-container')
            })
        })

        it('should handle duplicate container names', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const user = userEvent.setup()

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                const addButton = screen.getByLabelText(/add container/i)
                fireEvent.click(addButton)
            })

            const input = screen.getByLabelText(/container name/i)
            await user.type(input, 'file-uploads') // Existing container

            const createButton = screen.getByText('Create')
            expect(createButton).toBeDisabled()

            expect(screen.getByText(/container already exists/i)).toBeInTheDocument()
        })
    })

    describe('Container Deletion', () => {
        it('should show delete confirmation dialog', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} selectedContainer="user-data" />)

            await waitFor(() => {
                const deleteButton = screen.getByLabelText(/delete container/i)
                fireEvent.click(deleteButton)
            })

            expect(screen.getByText('Delete Container')).toBeInTheDocument()
            expect(screen.getByText(/Are you sure you want to delete "user-data"/)).toBeInTheDocument()
        })

        it('should prevent deletion of default container', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} selectedContainer="file-uploads" />)

            await waitFor(() => {
                const deleteButton = screen.getByLabelText(/delete container/i)
                expect(deleteButton).toBeDisabled()
            })
        })

        it('should delete container successfully', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const onContainerChange = vi.fn()

            render(<ContainerSelector {...defaultProps} selectedContainer="user-data" onContainerChange={onContainerChange} />)

            await waitFor(() => {
                const deleteButton = screen.getByLabelText(/delete container/i)
                fireEvent.click(deleteButton)
            })

            const confirmButton = screen.getByText('Delete')
            fireEvent.click(confirmButton)

            await waitFor(() => {
                expect(availableContainers.value).not.toContain('user-data')
                expect(onContainerChange).toHaveBeenCalledWith('file-uploads') // Default
            })
        })

        it('should handle deletion errors', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} selectedContainer="user-data" />)

            // Simulate deletion error
            await waitFor(() => {
                const deleteButton = screen.getByLabelText(/delete container/i)
                fireEvent.click(deleteButton)
            })

            const confirmButton = screen.getByText('Delete')
            fireEvent.click(confirmButton)

            // Mock error during deletion
            await waitFor(() => {
                expect(screen.getByText(/Failed to delete container/i)).toBeInTheDocument()
            })
        })
    })

    describe('Refresh Functionality', () => {
        it('should refresh containers list', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const onRefresh = vi.fn()

            render(<ContainerSelector {...defaultProps} onRefresh={onRefresh} />)

            await waitFor(() => {
                const refreshButton = screen.getByLabelText(/refresh/i)
                fireEvent.click(refreshButton)
            })

            expect(mockBlobsApi.getStores).toHaveBeenCalledTimes(2) // Initial + manual refresh
            expect(onRefresh).toHaveBeenCalled()
        })

        it('should disable refresh during loading', () => {
            isLoading.value = true
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            const refreshButton = screen.getByLabelText(/refresh/i)
            expect(refreshButton).toBeDisabled()
        })
    })

    describe('Container Name Validation', () => {
        const testValidation = async (name: string, shouldBeValid: boolean) => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const user = userEvent.setup()

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                const addButton = screen.getByLabelText(/add container/i)
                fireEvent.click(addButton)
            })

            const input = screen.getByLabelText(/container name/i)
            await user.clear(input)
            await user.type(input, name)

            const createButton = screen.getByText('Create')

            if (shouldBeValid) {
                expect(createButton).toBeEnabled()
            } else {
                expect(createButton).toBeDisabled()
            }
        }

        it('should accept valid container names', async () => {
            const validNames = [
                'valid-name',
                'container123',
                'my_container',
                'test-data-store'
            ]

            for (const name of validNames) {
                await testValidation(name, true)
            }
        })

        it('should reject invalid container names', async () => {
            const invalidNames = [
                '', // empty
                'invalid name', // spaces
                'invalid@name', // special chars
                'UPPERCASE', // uppercase
                'a', // too short
                'a'.repeat(64) // too long
            ]

            for (const name of invalidNames) {
                await testValidation(name, false)
            }
        })
    })

    describe('Error Handling', () => {
        it('should allow closing error messages', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiError('Test error', 'TEST_ERROR'))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Test error')).toBeInTheDocument()
            })

            const closeButton = screen.getByLabelText(/close/i)
            fireEvent.click(closeButton)

            expect(screen.queryByText('Test error')).not.toBeInTheDocument()
        })

        it('should recover from errors on retry', async () => {
            // First call fails
            mockBlobsApi.getStores.mockResolvedValueOnce(mockApiError('Network error', 'NETWORK_ERROR'))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument()
            })

            // Second call succeeds
            mockBlobsApi.getStores.mockResolvedValueOnce(mockApiResponse(mockStores))

            const refreshButton = screen.getByLabelText(/refresh/i)
            fireEvent.click(refreshButton)

            await waitFor(() => {
                expect(screen.queryByText('Network error')).not.toBeInTheDocument()
                expect(screen.getByDisplayValue('file-uploads')).toBeInTheDocument()
            })
        })
    })

    describe('Accessibility', () => {
        it('should have proper ARIA labels', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(screen.getByLabelText(/container/i)).toBeInTheDocument()
                expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument()
                expect(screen.getByLabelText(/add container/i)).toBeInTheDocument()
            })
        })

        it('should support keyboard navigation', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))
            const user = userEvent.setup()

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(async () => {
                const selector = screen.getByLabelText(/container/i)

                await user.tab()
                expect(selector).toHaveFocus()

                await user.keyboard('{ArrowDown}')
                // Should open dropdown
            })
        })

        it('should have proper form labels and descriptions', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                const addButton = screen.getByLabelText(/add container/i)
                fireEvent.click(addButton)
            })

            expect(screen.getByLabelText(/container name/i)).toBeInTheDocument()
            expect(screen.getByText(/container names must be lowercase/i)).toBeInTheDocument()
        })
    })

    describe('State Management', () => {
        it('should maintain global state correctly', async () => {
            mockBlobsApi.getStores.mockResolvedValue(mockApiResponse(mockStores))

            render(<ContainerSelector {...defaultProps} />)

            await waitFor(() => {
                expect(availableContainers.value).toEqual(mockStores.stores)
                expect(defaultContainer.value).toBe(mockStores.default)
                expect(isLoading.value).toBe(false)
            })
        })

        it('should update loading state during operations', async () => {
            let resolvePromise: (value: any) => void
            const promise = new Promise(resolve => {
                resolvePromise = resolve
            })

            mockBlobsApi.getStores.mockReturnValue(promise as any)

            render(<ContainerSelector {...defaultProps} />)

            expect(isLoading.value).toBe(true)

            resolvePromise!(mockApiResponse(mockStores))

            await waitFor(() => {
                expect(isLoading.value).toBe(false)
            })
        })
    })
})

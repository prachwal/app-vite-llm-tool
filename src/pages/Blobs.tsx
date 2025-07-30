import { Box, Typography, Alert } from '@mui/material';
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import type { FC } from 'preact/compat';
import { ContainerSelector } from '../components/blobs/ContainerSelector';
import { FileList } from '../components/blobs/FileList';
import { FilePreview } from '../components/blobs/FilePreview';
import type { BlobItem } from '../services/blobsService';

// Global state for the blobs page
export const selectedContainer = signal<string>('');
export const selectedFile = signal<BlobItem | null>(null);

export const Blobs: FC = () => {
    const [error, setError] = useState<string | null>(null);

    const handleContainerChange = (container: string) => {
        selectedContainer.value = container;
        selectedFile.value = null; // Clear file selection when container changes
        setError(null);
    };

    const handleFileSelect = (file: BlobItem | null) => {
        selectedFile.value = file;
    };

    const handleRefresh = () => {
        // This will trigger refresh in FileList component
        setError(null);
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', p: 2 }}>
            {/* Page Header */}
            <Box sx={{ mb: 2 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Blobs Management
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Manage files in Netlify Blobs storage containers. Upload, preview, and organize your files.
                </Typography>
            </Box>

            {/* Container Selector */}
            <Box sx={{ mb: 2 }}>
                <ContainerSelector
                    selectedContainer={selectedContainer.value}
                    onContainerChange={handleContainerChange}
                />
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Main Content */}
            {selectedContainer.value ? (
                <Box sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    gap: 2,
                    flexDirection: { xs: 'column', md: 'row' }
                }}>
                    {/* File List - Left Panel */}
                    <Box sx={{
                        flex: 1,
                        height: '100%',
                        minHeight: { xs: '300px', md: '0' }
                    }}>
                        <FileList
                            container={selectedContainer.value}
                            selectedFile={selectedFile.value?.key || null}
                            onFileSelect={handleFileSelect}
                            onRefresh={handleRefresh}
                        />
                    </Box>

                    {/* File Preview - Right Panel */}
                    <Box sx={{
                        flex: 1,
                        height: '100%',
                        minHeight: { xs: '300px', md: '0' }
                    }}>
                        <FilePreview
                            file={selectedFile.value}
                            container={selectedContainer.value}
                        />
                    </Box>
                </Box>
            ) : (
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.50',
                        borderRadius: 1,
                        border: '2px dashed',
                        borderColor: 'grey.300'
                    }}
                >
                    <Typography variant="h6" color="text.secondary">
                        Select a container to start managing files
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

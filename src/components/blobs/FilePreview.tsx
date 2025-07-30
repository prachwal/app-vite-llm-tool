import {
    Box,
    Typography,
    Paper,
    Alert,
    CircularProgress,
    Chip,
    Card,
    CardContent,
    Button,
    IconButton
} from '@mui/material';
import {
    Download,
    Refresh,
    InsertDriveFile,
    Image,
    Code,
    DataObject,
    Description,
    Visibility,
    VisibilityOff,
    Info
} from '@mui/icons-material';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { FC } from 'preact/compat';
import { blobsApi, type BlobItem } from '../../services/blobsService';
import { MetadataEditor } from './MetadataEditor';

export interface FilePreviewProps {
    file: BlobItem | null;
    container: string;
}

// Global state for file preview
export const fileContent = signal<string | null>(null);
export const fileMetadata = signal<any>(null);
export const isLoadingContent = signal<boolean>(false);

export const FilePreview: FC<FilePreviewProps> = ({ file, container }) => {
    const [error, setError] = useState<string | null>(null);
    const [showRawContent, setShowRawContent] = useState<boolean>(false);
    const [showMetadata, setShowMetadata] = useState<boolean>(false);

    // Handle metadata update
    const handleMetadataUpdated = (newMetadata: Record<string, any>) => {
        fileMetadata.value = newMetadata;
        // Optionally reload file list to refresh display
        if (file) {
            loadFileContent();
        }
    };

    // Load file content when file changes
    useEffect(() => {
        if (file) {
            loadFileContent();
        } else {
            fileContent.value = null;
            fileMetadata.value = null;
        }
    }, [file?.key, container]);

    const loadFileContent = async () => {
        if (!file) return;

        isLoadingContent.value = true;
        setError(null);

        try {
            // Get metadata with rawUrl using new separated API
            const response = await blobsApi.getBlobMetadataWithRawUrl(file.key, container);

            if (response.status === 200 && response.payload) {
                const { metadata, rawUrl } = response.payload;
                fileMetadata.value = metadata;

                // For binary files (images, audio, video), use rawUrl directly
                if (isBinaryFile(file.key)) {
                    fileContent.value = rawUrl; // Direct URL to binary file
                } else {
                    // For text files, fetch content using rawUrl
                    const contentResponse = await blobsApi.getRawBlob(rawUrl);
                    if (contentResponse.ok) {
                        const textContent = await contentResponse.text();
                        fileContent.value = textContent;
                    } else {
                        setError('Failed to load file content');
                        fileContent.value = null;
                    }
                }
            } else {
                setError(response.error?.message || 'Failed to load file');
                fileContent.value = null;
                fileMetadata.value = null;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
            fileContent.value = null;
            fileMetadata.value = null;
        } finally {
            isLoadingContent.value = false;
        }
    };

    const handleRefresh = () => {
        loadFileContent();
    };

    const handleDownload = async () => {
        if (!file) return;

        try {
            // Use direct fetch to avoid blob URL issues with router
            const url = blobsApi.getBlobUrl(file.key, container, true);
            const response = await fetch(url);

            if (response.ok) {
                const blob = await response.blob();
                const downloadUrl = URL.createObjectURL(blob);

                // Create download link without affecting router history
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = file.key;
                a.style.display = 'none';

                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Clean up blob URL
                setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
            } else {
                setError('Download failed: ' + response.statusText);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Download failed');
        }
    };

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
                return <Image />;
            case 'js':
            case 'ts':
            case 'jsx':
            case 'tsx':
            case 'css':
            case 'html':
                return <Code />;
            case 'json':
                return <DataObject />;
            case 'txt':
            case 'md':
                return <Description />;
            default:
                return <InsertDriveFile />;
        }
    };

    function getFileType(file: BlobItem): 'text' | 'image' | 'audio' | 'video' {
        const mimeType = (file.metadata?.type as string) || '';
        const fileName = (file.metadata?.originalName as string) || file.key;

        // Check by file extension first (more reliable for existing files without proper metadata)
        const extension = fileName.toLowerCase().split('.').pop() || '';

        // Image extensions
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'].includes(extension)) {
            return 'image';
        }

        // Audio extensions
        if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(extension)) {
            return 'audio';
        }

        // Video extensions
        if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(extension)) {
            return 'video';
        }

        // Fallback to MIME type check
        if (mimeType.startsWith('image/')) return 'image';
        if (mimeType.startsWith('audio/')) return 'audio';
        if (mimeType.startsWith('video/')) return 'video';

        return 'text';
    } const isImageFile = (fileName: string) => {
        const extension = fileName.toLowerCase().split('.').pop() || '';
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'].includes(extension);
    };

    const isAudioFile = (fileName: string) => {
        const extension = fileName.toLowerCase().split('.').pop() || '';
        return ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(extension);
    };

    const isVideoFile = (fileName: string) => {
        const extension = fileName.toLowerCase().split('.').pop() || '';
        return ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(extension);
    };

    const isBinaryFile = (fileName: string) => {
        return isImageFile(fileName) || isAudioFile(fileName) || isVideoFile(fileName);
    };

    const formatFileSize = (size?: number) => {
        if (!size) return '';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString();
    };

    const renderFileContent = () => {
        if (!file || !fileContent.value) return null;

        const content = fileContent.value;

        // Handle images
        if (isImageFile(file.key)) {
            // For images, content is a blob URL
            return (
                <Box sx={{ textAlign: 'center', p: 2 }}>
                    <img
                        src={content}
                        alt={file.key}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            objectFit: 'contain',
                            border: '1px solid var(--mui-palette-divider)',
                            borderRadius: '4px'
                        }}
                    />
                </Box>
            );
        }

        // Handle audio files
        if (isAudioFile(file.key)) {
            return (
                <Box sx={{ textAlign: 'center', p: 2 }}>
                    <audio
                        controls
                        style={{ width: '100%', maxWidth: '500px' }}
                        preload="metadata"
                        aria-label={`Audio player for ${file.key}`}
                    >
                        <source src={content} />
                        <track kind="captions" src="" label="No captions available" />
                        Your browser does not support the audio element.
                    </audio>
                </Box>
            );
        }

        // Handle video files
        if (isVideoFile(file.key)) {
            return (
                <Box sx={{ textAlign: 'center', p: 2 }}>
                    <video
                        controls
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            maxHeight: '400px'
                        }}
                        preload="metadata"
                        aria-label={`Video player for ${file.key}`}
                    >
                        <source src={content} />
                        <track kind="captions" src="" label="No captions available" />
                        Your browser does not support the video element.
                    </video>
                </Box>
            );
        }

        // Show raw content if requested
        if (showRawContent) {
            return (
                <Box
                    component="pre"
                    sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '400px',
                        overflow: 'auto',
                        p: 2,
                        bgcolor: 'background.default',
                        color: 'text.primary',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1
                    }}
                >
                    {content}
                </Box>
            );
        }

        // Format content based on file extension
        const extension = file.key.toLowerCase().split('.').pop() || '';

        // JSON formatting
        if (extension === 'json') {
            try {
                const formatted = JSON.stringify(JSON.parse(content), null, 2);
                return (
                    <Box
                        component="pre"
                        sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '400px',
                            overflow: 'auto',
                            p: 2,
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1
                        }}
                    >
                        {formatted}
                    </Box>
                );
            } catch {
                // If JSON parsing fails, fall through to default
            }
        }

        // Code formatting for JS, CSS, HTML
        if (['js', 'ts', 'jsx', 'tsx', 'css', 'html'].includes(extension)) {
            return (
                <Box
                    component="pre"
                    sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '400px',
                        overflow: 'auto',
                        p: 2,
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1
                    }}
                >
                    {content}
                </Box>
            );
        }

        // Default text rendering
        return (
            <Typography
                component="pre"
                sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '400px',
                    overflow: 'auto',
                    p: 2,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                }}
            >
                {content}
            </Typography>
        );
    };

    if (!file) {
        return (
            <Paper sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                    Select a file to preview
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getFileIcon(file.key)}
                        <Typography variant="h6" noWrap>
                            {file.key}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                            onClick={() => setShowRawContent(!showRawContent)}
                            size="small"
                            title={showRawContent ? 'Show formatted' : 'Show raw'}
                        >
                            {showRawContent ? <Visibility /> : <VisibilityOff />}
                        </IconButton>
                        <IconButton
                            onClick={() => setShowMetadata(!showMetadata)}
                            size="small"
                            title={showMetadata ? 'Hide metadata' : 'Show metadata'}
                            color={showMetadata ? 'primary' : 'default'}
                        >
                            <Info />
                        </IconButton>
                        <Button
                            startIcon={<Download />}
                            variant="outlined"
                            size="small"
                            onClick={handleDownload}
                        >
                            Download
                        </Button>
                        <IconButton
                            onClick={handleRefresh}
                            disabled={isLoadingContent.value}
                            size="small"
                        >
                            <Refresh />
                        </IconButton>
                    </Box>
                </Box>

                {/* File metadata */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip
                        label={getFileType(file).toUpperCase()}
                        size="small"
                        variant="outlined"
                    />
                    {file.size && (
                        <Chip label={formatFileSize(file.size)} size="small" />
                    )}
                    {file.modified && (
                        <Typography variant="caption" color="text.secondary">
                            Modified: {formatDate(file.modified)}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Metadata Section */}
            {showMetadata && fileMetadata.value && (
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle2">
                            File Metadata
                        </Typography>
                        {file && (
                            <MetadataEditor
                                fileKey={file.key}
                                container={container}
                                metadata={fileMetadata.value}
                                onMetadataUpdated={handleMetadataUpdated}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, fontSize: '0.875rem' }}>
                        {fileMetadata.value.type && (
                            <>
                                <Typography variant="body2" fontWeight="medium">Content Type:</Typography>
                                <Typography variant="body2" color="text.secondary">{fileMetadata.value.type}</Typography>
                            </>
                        )}
                        {fileMetadata.value.originalName && (
                            <>
                                <Typography variant="body2" fontWeight="medium">Original Name:</Typography>
                                <Typography variant="body2" color="text.secondary">{fileMetadata.value.originalName}</Typography>
                            </>
                        )}
                        {fileMetadata.value.size && (
                            <>
                                <Typography variant="body2" fontWeight="medium">File Size:</Typography>
                                <Typography variant="body2" color="text.secondary">{formatFileSize(fileMetadata.value.size)}</Typography>
                            </>
                        )}
                        {fileMetadata.value.lastModified && (
                            <>
                                <Typography variant="body2" fontWeight="medium">Last Modified:</Typography>
                                <Typography variant="body2" color="text.secondary">{formatDate(fileMetadata.value.lastModified)}</Typography>
                            </>
                        )}
                        {Object.keys(fileMetadata.value).filter(key =>
                            !['type', 'originalName', 'size', 'lastModified'].includes(key)
                        ).map(key => (
                            <Box key={key} sx={{ display: 'contents' }}>
                                <Typography variant="body2" fontWeight="medium">{key}:</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {typeof fileMetadata.value[key] === 'object'
                                        ? JSON.stringify(fileMetadata.value[key])
                                        : String(fileMetadata.value[key])
                                    }
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {(() => {
                    if (isLoadingContent.value) {
                        return (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                                <CircularProgress />
                            </Box>
                        );
                    }

                    if (fileContent.value) {
                        return (
                            <Card variant="outlined">
                                <CardContent>
                                    {renderFileContent()}
                                </CardContent>
                            </Card>
                        );
                    }

                    return (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <Typography variant="body2" color="text.secondary">
                                No content available
                            </Typography>
                        </Box>
                    );
                })()}
            </Box>
        </Paper>
    );
};

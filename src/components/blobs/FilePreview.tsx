import {
    Box,
    Typography,
    Paper,
    Alert,
    CircularProgress,
    Chip,
    Button,
    IconButton,
    Dialog,
    DialogContent,
    DialogActions,
    DialogTitle,
    Snackbar,
    Tooltip
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
    Info,
    Fullscreen,
    FullscreenExit,
    ContentCopy
} from '@mui/icons-material';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { FC } from 'preact/compat';
import { blobsApi, type BlobItem } from '../../services/blobsService';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeHighlighter } from './CodeHighlighter';
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
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);

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
            setError(null);

            // Get the raw file URL
            const response = await blobsApi.getBlobMetadataWithRawUrl(file.key, container);

            if (response.status === 200 && response.payload?.rawUrl) {
                const { rawUrl } = response.payload;

                // For text files, fetch content and create downloadable blob
                if (!isBinaryFile(file.key)) {
                    const contentResponse = await fetch(rawUrl);
                    if (contentResponse.ok) {
                        const textContent = await contentResponse.text();
                        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                        const downloadUrl = URL.createObjectURL(blob);

                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = file.key;
                        a.style.display = 'none';

                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);

                        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
                    } else {
                        throw new Error('Failed to fetch file content');
                    }
                } else {
                    // For binary files, use direct download
                    const binaryResponse = await fetch(rawUrl);
                    if (binaryResponse.ok) {
                        const blob = await binaryResponse.blob();
                        const downloadUrl = URL.createObjectURL(blob);

                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = file.key;
                        a.style.display = 'none';

                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);

                        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
                    } else {
                        throw new Error('Failed to download file');
                    }
                }
            } else {
                throw new Error(response.error?.message || 'Failed to get file URL');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Download failed');
        }
    };

    const handleCopyDirectLink = async () => {
        if (!file) return;

        try {
            const response = await blobsApi.getBlobMetadataWithRawUrl(file.key, container);

            if (response.status === 200 && response.payload?.rawUrl) {
                const { rawUrl } = response.payload;
                await navigator.clipboard.writeText(rawUrl);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 3000);
            } else {
                setError('Failed to get file URL');
            }
        } catch (err) {
            console.error('Failed to copy link:', err);
            setError('Failed to copy link');
        }
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
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
        const fileName = file.key;
        const extension = fileName.toLowerCase().split('.').pop() || '';

        // Handle images with improved styling
        if (isImageFile(fileName)) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        minHeight: '200px',
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Box
                        component="img"
                        src={content}
                        alt={fileName}
                        sx={{
                            maxWidth: '100%',
                            maxHeight: isFullscreen ? '80vh' : '60vh',
                            objectFit: 'contain',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            boxShadow: 1
                        }}
                    />
                </Box>
            );
        }

        // Handle audio files with improved styling
        if (isAudioFile(fileName)) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 4,
                        minHeight: '200px'
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>
                        {fileName}
                    </Typography>
                    <Box
                        component="audio"
                        controls
                        preload="metadata"
                        sx={{
                            width: '100%',
                            maxWidth: '500px',
                            '& audio': {
                                width: '100%'
                            }
                        }}
                    >
                        <source src={content} />
                        Your browser does not support the audio element.
                    </Box>
                </Box>
            );
        }

        // Handle video files with improved styling
        if (isVideoFile(fileName)) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2
                    }}
                >
                    <Box
                        component="video"
                        controls
                        preload="metadata"
                        sx={{
                            width: '100%',
                            maxWidth: '800px',
                            maxHeight: isFullscreen ? '80vh' : '60vh',
                            bgcolor: 'black',
                            borderRadius: 1
                        }}
                    >
                        <source src={content} />
                        Your browser does not support the video element.
                    </Box>
                </Box>
            );
        }

        // Enhanced text content rendering
        const containerStyles = {
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            whiteSpace: 'pre-wrap' as const,
            wordBreak: 'break-word' as const,
            height: isFullscreen ? 'calc(80vh - 100px)' : '60vh',
            overflow: 'auto',
            p: 2,
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1
        };

        // Show raw content if requested
        if (showRawContent) {
            return (
                <Box component="pre" sx={containerStyles}>
                    {content}
                </Box>
            );
        }

        // Enhanced Markdown rendering
        if (extension === 'md' || extension === 'markdown') {
            return (
                <MarkdownRenderer
                    content={content}
                    isFullscreen={isFullscreen}
                />
            );
        }

        // Enhanced code formatting with syntax highlighting
        if (['js', 'ts', 'jsx', 'tsx', 'py', 'python', 'css', 'html', 'xml', 'yaml', 'yml', 'json', 'sh', 'bash', 'sql', 'php', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'rb', 'swift', 'kt', 'dart', 'r'].includes(extension)) {
            return (
                <CodeHighlighter
                    code={content}
                    language={extension}
                    isFullscreen={isFullscreen}
                />
            );
        }

        // Enhanced formatting for JSON files (if not handled by CodeHighlighter)
        if (extension === 'json') {
            try {
                const formatted = JSON.stringify(JSON.parse(content), null, 2);
                return (
                    <CodeHighlighter
                        code={formatted}
                        language="json"
                        isFullscreen={isFullscreen}
                    />
                );
            } catch {
                // If JSON parsing fails, fall through to default
            }
        }

        // Default text rendering with better styling
        return (
            <Box
                component="pre"
                sx={{
                    ...containerStyles,
                    fontFamily: extension === 'txt' ? 'inherit' : 'monospace',
                    fontSize: extension === 'txt' ? '0.95rem' : '0.875rem'
                }}
            >
                {content}
            </Box>
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
        <>
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
                            <Tooltip title={showRawContent ? 'Show formatted' : 'Show raw'}>
                                <IconButton
                                    onClick={() => setShowRawContent(!showRawContent)}
                                    size="small"
                                    color={showRawContent ? 'primary' : 'default'}
                                >
                                    {showRawContent ? <Visibility /> : <VisibilityOff />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen view'}>
                                <IconButton
                                    onClick={toggleFullscreen}
                                    size="small"
                                    color={isFullscreen ? 'primary' : 'default'}
                                >
                                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Copy direct link">
                                <IconButton
                                    onClick={handleCopyDirectLink}
                                    size="small"
                                >
                                    <ContentCopy />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={showMetadata ? 'Hide metadata' : 'Show metadata'}>
                                <IconButton
                                    onClick={() => setShowMetadata(!showMetadata)}
                                    size="small"
                                    color={showMetadata ? 'primary' : 'default'}
                                >
                                    <Info />
                                </IconButton>
                            </Tooltip>
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

                {/* Content - improved to fill available space */}
                <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                                    {renderFileContent()}
                                </Box>
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

            {/* Fullscreen Modal */}
            <Dialog
                open={isFullscreen}
                onClose={toggleFullscreen}
                maxWidth={false}
                fullWidth
                sx={{
                    '& .MuiDialog-paper': {
                        width: '95vw',
                        height: '95vh',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        m: 0
                    }
                }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">{file.key}</Typography>
                    <IconButton onClick={toggleFullscreen}>
                        <FullscreenExit />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                    <Box sx={{ height: '100%', p: 2 }}>
                        {renderFileContent()}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDownload} startIcon={<Download />}>
                        Download
                    </Button>
                    <Button onClick={handleCopyDirectLink} startIcon={<ContentCopy />}>
                        Copy Link
                    </Button>
                    <Button onClick={toggleFullscreen}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Success Snackbar */}
            <Snackbar
                open={copySuccess}
                autoHideDuration={3000}
                onClose={() => setCopySuccess(false)}
                message="Direct link copied to clipboard!"
            />
        </>
    );
};

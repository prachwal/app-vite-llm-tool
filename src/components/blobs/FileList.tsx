import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    Chip,
    CircularProgress,
    Alert,
    Paper,
    Divider,
    Button
} from '@mui/material';
import {
    InsertDriveFile,
    MoreVert,
    Download,
    Edit,
    Delete,
    Upload,
    Refresh,
    Description,
    Image,
    Code,
    DataObject
} from '@mui/icons-material';
import { signal } from '@preact/signals';
import { useEffect, useState, useRef } from 'preact/hooks';
import type { FC } from 'preact/compat';
import { blobsApi, type BlobItem } from '../../services/blobsService';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

export interface FileListProps {
    container: string;
    selectedFile: string | null;
    onFileSelect: (file: BlobItem | null) => void;
    onRefresh?: () => void;
}

// Global state for file list
export const fileList = signal<BlobItem[]>([]);
export const isLoadingFiles = signal<boolean>(false);

export const FileList: FC<FileListProps> = ({
    container,
    selectedFile,
    onFileSelect,
    onRefresh
}) => {
    const [error, setError] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
        file: BlobItem;
    } | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState<BlobItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load files when container changes
    useEffect(() => {
        if (container) {
            loadFiles();
        }
    }, [container]);

    const loadFiles = async () => {
        if (!container) return;

        isLoadingFiles.value = true;
        setError(null);

        try {
            const response = await blobsApi.listBlobs(container);
            if (response.status === 200 && response.payload) {
                fileList.value = response.payload;
            } else {
                setError(response.error?.message || 'Failed to load files');
                fileList.value = [];
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
            fileList.value = [];
        } finally {
            isLoadingFiles.value = false;
        }
    };

    const handleRefresh = () => {
        loadFiles();
        onRefresh?.();
    };

    const handleFileClick = (file: BlobItem) => {
        onFileSelect(file);
    };

    const handleContextMenu = (event: MouseEvent, file: BlobItem) => {
        event.preventDefault();
        setContextMenu({
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
            file
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleDownload = async (file: BlobItem) => {
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
        handleCloseContextMenu();
    };

    const handleDelete = (file: BlobItem) => {
        setShowDeleteDialog(file);
        handleCloseContextMenu();
    };

    const confirmDelete = async () => {
        if (!showDeleteDialog) return;

        try {
            const response = await blobsApi.deleteBlob(showDeleteDialog.key, container);
            if (response.status === 200) {
                // Remove from local list
                fileList.value = fileList.value.filter(f => f.key !== showDeleteDialog.key);
                // Clear selection if deleted file was selected
                if (selectedFile === showDeleteDialog.key) {
                    onFileSelect(null);
                }
            } else {
                setError(response.error?.message || 'Delete failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
        setShowDeleteDialog(null);
    };

    const handleFileUpload = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
            uploadFiles(Array.from(files));
        }
    };

    const uploadFiles = async (files: File[]) => {
        for (const file of files) {
            try {
                const response = await blobsApi.uploadFile(file, undefined, container);
                if (response.status === 201) {
                    // Refresh file list to show new file
                    await loadFiles();
                } else {
                    setError(`Failed to upload ${file.name}: ${response.error?.message}`);
                }
            } catch (err) {
                setError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
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

    const formatFileSize = (size?: number) => {
        if (!size) return '';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">Files</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            startIcon={<Upload />}
                            variant="outlined"
                            size="small"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoadingFiles.value}
                        >
                            Upload
                        </Button>
                        <IconButton
                            onClick={handleRefresh}
                            disabled={isLoadingFiles.value}
                            size="small"
                        >
                            <Refresh />
                        </IconButton>
                    </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Container: {container} • {fileList.value.length} files
                </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ m: 2 }}>
                    {error}
                </Alert>
            )}

            {/* File List */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {(() => {
                    if (isLoadingFiles.value) {
                        return (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress />
                            </Box>
                        );
                    }

                    if (fileList.value.length === 0) {
                        return (
                            <Box sx={{ p: 4, textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    No files in this container
                                </Typography>
                            </Box>
                        );
                    }

                    return (
                        <List dense>
                            {fileList.value.map((file) => (
                                <ListItem
                                    key={file.key}
                                    disablePadding
                                >
                                    <ListItemButton
                                        onClick={() => handleFileClick(file)}
                                        onContextMenu={(e) => handleContextMenu(e, file)}
                                        selected={selectedFile === file.key}
                                    >
                                        <ListItemIcon>
                                            {getFileIcon(file.key)}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={file.key}
                                            secondary={
                                                <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {file.size && (
                                                        <Chip label={formatFileSize(file.size)} size="small" />
                                                    )}
                                                    {file.modified && (
                                                        <Typography variant="caption" color="text.secondary" component="span">
                                                            {formatDate(file.modified)}
                                                        </Typography>
                                                    )}
                                                </span>
                                            }
                                        />
                                        <IconButton
                                            edge="end"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleContextMenu(e, file);
                                            }}
                                            size="small"
                                        >
                                            <MoreVert />
                                        </IconButton>
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    );
                })()}
            </Box>

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                style={{ display: 'none' }}
            />

            {/* Context Menu */}
            <Menu
                open={Boolean(contextMenu)}
                onClose={handleCloseContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined
                }
            >
                <MenuItem onClick={() => contextMenu && handleDownload(contextMenu.file)}>
                    <ListItemIcon>
                        <Download />
                    </ListItemIcon>
                    Download
                </MenuItem>
                <MenuItem onClick={() => { }}>
                    <ListItemIcon>
                        <Edit />
                    </ListItemIcon>
                    Rename
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => contextMenu && handleDelete(contextMenu.file)}>
                    <ListItemIcon>
                        <Delete />
                    </ListItemIcon>
                    Delete
                </MenuItem>
            </Menu>

            {/* Delete Confirmation */}
            <ConfirmationDialog
                open={Boolean(showDeleteDialog)}
                title="Delete File"
                message={`Are you sure you want to delete "${showDeleteDialog?.key}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteDialog(null)}
            />
        </Paper>
    );
};

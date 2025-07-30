import {
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Alert
} from '@mui/material';
import {
    Edit,
    Save,
    Cancel,
    Close
} from '@mui/icons-material';
import { useState } from 'preact/hooks';
import type { FC } from 'preact/compat';
import { blobsApi, type BlobMetadata } from '../../services/blobsService';

export interface MetadataEditorProps {
    fileKey: string;
    container: string;
    metadata: Record<string, any>;
    onMetadataUpdated: (newMetadata: Record<string, any>) => void;
}

// Common MIME types for easy selection
const COMMON_MIME_TYPES = [
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    'audio/flac',
    'video/mp4',
    'video/webm',
    'video/avi',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/zip',
    'application/json',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/octet-stream'
];

export const MetadataEditor: FC<MetadataEditorProps> = ({
    fileKey,
    container,
    metadata,
    onMetadataUpdated
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editedMetadata, setEditedMetadata] = useState<Record<string, any>>({});

    const handleOpen = () => {
        setEditedMetadata({ ...metadata });
        setIsOpen(true);
        setError(null);
    };

    const handleClose = () => {
        setIsOpen(false);
        setEditedMetadata({});
        setError(null);
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await blobsApi.updateBlobMetadata(
                fileKey,
                editedMetadata as BlobMetadata,
                container
            );

            if (response.status === 201 || response.status === 200) {
                onMetadataUpdated(editedMetadata);
                handleClose();
            } else {
                setError(response.error?.message || 'Failed to update metadata');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFieldChange = (field: string, value: any) => {
        setEditedMetadata(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const validateFilename = (filename: string): boolean => {
        return /^[^<>:"/\\|?*]+\.[a-zA-Z0-9]+$/.test(filename);
    };

    return (
        <>
            <IconButton
                onClick={handleOpen}
                size="small"
                title="Edit metadata"
                sx={{ ml: 1 }}
            >
                <Edit fontSize="small" />
            </IconButton>

            <Dialog
                open={isOpen}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Edit File Metadata
                    <IconButton onClick={handleClose} size="small">
                        <Close />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ pt: 2 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* File Name */}
                        <TextField
                            label="File Name"
                            value={editedMetadata.originalName || ''}
                            onChange={(e) => handleFieldChange('originalName', (e.target as HTMLInputElement)?.value || '')}
                            fullWidth
                            helperText="Include file extension (e.g., .mp3, .pdf)"
                            error={editedMetadata.originalName && !validateFilename(editedMetadata.originalName)}
                        />

                        {/* Content Type */}
                        <FormControl fullWidth>
                            <InputLabel>Content Type</InputLabel>
                            <Select
                                value={editedMetadata.type || ''}
                                onChange={(_, value) => {
                                    if (typeof value === 'string') {
                                        handleFieldChange('type', value);
                                    }
                                }}
                                label="Content Type"
                            >
                                {COMMON_MIME_TYPES.map(mimeType => (
                                    <MenuItem key={mimeType} value={mimeType}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography>{mimeType}</Typography>
                                            {mimeType.startsWith('audio/') && <Chip label="Audio" size="small" color="primary" />}
                                            {mimeType.startsWith('video/') && <Chip label="Video" size="small" color="secondary" />}
                                            {mimeType.startsWith('image/') && <Chip label="Image" size="small" color="success" />}
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Custom Content Type */}
                        <TextField
                            label="Custom Content Type"
                            value={editedMetadata.type && !COMMON_MIME_TYPES.includes(editedMetadata.type) ? editedMetadata.type : ''}
                            onChange={(e) => handleFieldChange('type', (e.target as HTMLInputElement)?.value || '')}
                            fullWidth
                            helperText="Enter custom MIME type if not in the list above"
                            placeholder="e.g., application/x-custom"
                        />

                        {/* Read-only fields */}
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="h6" gutterBottom>
                                Read-only Information
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1, fontSize: '0.875rem' }}>
                                {editedMetadata.size && (
                                    <>
                                        <Typography variant="body2" fontWeight="medium">File Size:</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {(editedMetadata.size / 1024 / 1024).toFixed(2)} MB
                                        </Typography>
                                    </>
                                )}
                                {editedMetadata.uploadedAt && (
                                    <>
                                        <Typography variant="body2" fontWeight="medium">Uploaded:</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {new Date(editedMetadata.uploadedAt).toLocaleString()}
                                        </Typography>
                                    </>
                                )}
                                {editedMetadata.encodedAt && (
                                    <>
                                        <Typography variant="body2" fontWeight="medium">Encoded:</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {new Date(editedMetadata.encodedAt).toLocaleString()}
                                        </Typography>
                                    </>
                                )}
                                {editedMetadata.isBase64 && (
                                    <>
                                        <Typography variant="body2" fontWeight="medium">Encoding:</Typography>
                                        <Typography variant="body2" color="text.secondary">Base64</Typography>
                                    </>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        startIcon={<Cancel />}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        startIcon={<Save />}
                        disabled={isLoading || (editedMetadata.originalName && !validateFilename(editedMetadata.originalName))}
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

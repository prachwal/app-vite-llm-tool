import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
    CircularProgress,
    Alert,
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import { Add, Delete, Refresh } from '@mui/icons-material';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { FC } from 'preact/compat';
import { blobsApi } from '../../services/blobsService';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

export interface ContainerSelectorProps {
    selectedContainer: string;
    onContainerChange: (container: string) => void;
    onRefresh?: () => void;
}

// Global state for containers
export const availableContainers = signal<string[]>([]);
export const defaultContainer = signal<string>('');
export const isLoading = signal<boolean>(false);

export const ContainerSelector: FC<ContainerSelectorProps> = ({
    selectedContainer,
    onContainerChange,
    onRefresh
}) => {
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [newContainerName, setNewContainerName] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Load containers on mount
    useEffect(() => {
        loadContainers();
    }, []);

    const loadContainers = async () => {
        isLoading.value = true;
        setError(null);

        try {
            const response = await blobsApi.getStores();
            if (response.status === 200 && response.payload) {
                availableContainers.value = response.payload.stores;
                defaultContainer.value = response.payload.default;

                // If no container selected, select the default one
                if (!selectedContainer && response.payload.default) {
                    onContainerChange(response.payload.default);
                }
            } else {
                setError(response.error?.message || 'Failed to load containers');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            isLoading.value = false;
        }
    };

    const handleRefresh = () => {
        loadContainers();
        onRefresh?.();
    };

    const handleAddContainer = () => {
        if (newContainerName.trim()) {
            // Note: In a real implementation, you'd need an API endpoint to create containers
            // For now, we'll just add it to the local list
            const trimmedName = newContainerName.trim();
            if (!availableContainers.value.includes(trimmedName)) {
                availableContainers.value = [...availableContainers.value, trimmedName];
                onContainerChange(trimmedName);
            }
            setNewContainerName('');
            setShowAddDialog(false);
        }
    };

    const handleDeleteContainer = () => {
        if (selectedContainer && selectedContainer !== defaultContainer.value) {
            // Note: In a real implementation, you'd need an API endpoint to delete containers
            // For now, we'll just remove it from the local list
            availableContainers.value = availableContainers.value.filter(c => c !== selectedContainer);
            onContainerChange(defaultContainer.value);
        }
        setShowDeleteDialog(false);
    };

    const canDelete = selectedContainer && selectedContainer !== defaultContainer.value;

    return (
        <Box>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl fullWidth variant="outlined" disabled={isLoading.value}>
                    <InputLabel id="container-select-label">Container</InputLabel>
                    <Select
                        labelId="container-select-label"
                        value={selectedContainer}
                        onChange={(e) => onContainerChange((e.target as HTMLSelectElement)?.value || '')}
                        label="Container"
                        startAdornment={
                            isLoading.value && (
                                <CircularProgress size={20} sx={{ ml: 1 }} />
                            )
                        }
                    >
                        {availableContainers.value.map((container) => (
                            <MenuItem key={container} value={container}>
                                {container}
                                {container === defaultContainer.value && ' (default)'}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Tooltip title="Refresh containers">
                    <IconButton
                        onClick={handleRefresh}
                        disabled={isLoading.value}
                        color="primary"
                    >
                        <Refresh />
                    </IconButton>
                </Tooltip>

                <Tooltip title="Add new container">
                    <IconButton
                        onClick={() => setShowAddDialog(true)}
                        disabled={isLoading.value}
                        color="primary"
                    >
                        <Add />
                    </IconButton>
                </Tooltip>

                <Tooltip title={canDelete ? "Delete container" : "Cannot delete default container"}>
                    <span>
                        <IconButton
                            onClick={() => setShowDeleteDialog(true)}
                            disabled={isLoading.value || !canDelete}
                            color="error"
                        >
                            <Delete />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {/* Add Container Dialog */}
            <Dialog
                open={showAddDialog}
                onClose={() => setShowAddDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Add New Container</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Container Name"
                        value={newContainerName}
                        onChange={(e) => setNewContainerName((e.target as HTMLInputElement).value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleAddContainer();
                            }
                        }}
                        sx={{ mt: 2 }}
                        helperText="Container names should be lowercase with no spaces"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleAddContainer}
                        variant="contained"
                        disabled={!newContainerName.trim()}
                    >
                        Add
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Container Confirmation */}
            <ConfirmationDialog
                open={showDeleteDialog}
                title="Delete Container"
                message={`Are you sure you want to delete the container "${selectedContainer}"? This action cannot be undone and will remove all files in this container.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDeleteContainer}
                onCancel={() => setShowDeleteDialog(false)}
            />
        </Box>
    );
};

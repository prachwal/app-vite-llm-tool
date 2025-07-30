import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Alert,
    Box
} from '@mui/material';
import { Warning, Delete, Help } from '@mui/icons-material';
import type { FC } from 'preact/compat';

export interface ConfirmationDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger' | 'warning';
    showThreeButtons?: boolean;
    neutralText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    onNeutral?: () => void;
}

export const ConfirmationDialog: FC<ConfirmationDialogProps> = ({
    open,
    title,
    message,
    confirmText = 'Yes',
    cancelText = 'Cancel',
    neutralText = 'No',
    variant = 'default',
    showThreeButtons = false,
    onConfirm,
    onCancel,
    onNeutral
}) => {
    const getIcon = () => {
        switch (variant) {
            case 'danger':
                return <Delete color="error" />;
            case 'warning':
                return <Warning color="warning" />;
            default:
                return <Help color="primary" />;
        }
    };

    const getAlertSeverity = () => {
        switch (variant) {
            case 'danger':
                return 'error' as const;
            case 'warning':
                return 'warning' as const;
            default:
                return 'info' as const;
        }
    };

    const getConfirmColor = () => {
        switch (variant) {
            case 'danger':
                return 'error' as const;
            case 'warning':
                return 'warning' as const;
            default:
                return 'primary' as const;
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth="sm"
            fullWidth
            aria-labelledby="confirmation-dialog-title"
            aria-describedby="confirmation-dialog-description"
        >
            <DialogTitle id="confirmation-dialog-title">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getIcon()}
                    {title}
                </Box>
            </DialogTitle>

            <DialogContent>
                <Alert severity={getAlertSeverity()} sx={{ mb: 2 }}>
                    <DialogContentText id="confirmation-dialog-description">
                        {message}
                    </DialogContentText>
                </Alert>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button
                    onClick={onCancel}
                    variant="outlined"
                    color="inherit"
                >
                    {cancelText}
                </Button>

                {showThreeButtons && onNeutral && (
                    <Button
                        onClick={onNeutral}
                        variant="outlined"
                        color="inherit"
                    >
                        {neutralText}
                    </Button>
                )}

                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color={getConfirmColor()}
                    autoFocus={variant !== 'danger'}
                >
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

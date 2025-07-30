import { Box, Card, CardContent, Typography, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { FC } from 'preact/compat';

interface ColorTokenProps {
    name: string;
    value: string;
    description?: string;
}

const ColorToken: FC<ColorTokenProps> = ({ name, value, description }) => (
    <Card sx={{ mb: 1 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    bgcolor: value,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    flexShrink: 0
                }}
            />
            <Box sx={{ flexGrow: 1 }}>
                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    {name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {value}
                </Typography>
                {description && (
                    <Typography variant="caption" color="text.secondary">
                        {description}
                    </Typography>
                )}
            </Box>
            <Chip label={value} size="small" variant="outlined" />
        </CardContent>
    </Card>
);

export const ColorTokens: FC = () => {
    const theme = useTheme();

    const colorTokens = [
        // Primary colors
        { name: 'primary.main', value: theme.palette.primary.main, description: 'Main primary color' },
        { name: 'primary.light', value: theme.palette.primary.light, description: 'Light primary variant' },
        { name: 'primary.dark', value: theme.palette.primary.dark, description: 'Dark primary variant' },

        // Secondary colors
        { name: 'secondary.main', value: theme.palette.secondary.main, description: 'Main secondary color' },
        { name: 'secondary.light', value: theme.palette.secondary.light, description: 'Light secondary variant' },
        { name: 'secondary.dark', value: theme.palette.secondary.dark, description: 'Dark secondary variant' },

        // Background colors
        { name: 'background.default', value: theme.palette.background.default, description: 'Default background' },
        { name: 'background.paper', value: theme.palette.background.paper, description: 'Paper background' },

        // Text colors
        { name: 'text.primary', value: theme.palette.text.primary, description: 'Primary text color' },
        { name: 'text.secondary', value: theme.palette.text.secondary, description: 'Secondary text color' },
        { name: 'text.disabled', value: theme.palette.text.disabled, description: 'Disabled text color' },

        // Action colors
        { name: 'action.active', value: theme.palette.action.active, description: 'Active state color' },
        { name: 'action.hover', value: theme.palette.action.hover, description: 'Hover state color' },
        { name: 'action.selected', value: theme.palette.action.selected, description: 'Selected state color' },
        { name: 'action.disabled', value: theme.palette.action.disabled, description: 'Disabled state color' },

        // Status colors
        { name: 'error.main', value: theme.palette.error.main, description: 'Error color' },
        { name: 'warning.main', value: theme.palette.warning.main, description: 'Warning color' },
        { name: 'info.main', value: theme.palette.info.main, description: 'Info color' },
        { name: 'success.main', value: theme.palette.success.main, description: 'Success color' },

        // Divider
        { name: 'divider', value: theme.palette.divider, description: 'Divider color' },
    ];

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Color Tokens
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Current theme color palette with Material-UI design tokens
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px' }}>
                    <Typography variant="subtitle1" gutterBottom>
                        Brand Colors
                    </Typography>
                    {colorTokens.slice(0, 6).map((token) => (
                        <ColorToken key={token.name} {...token} />
                    ))}
                </Box>

                <Box sx={{ flex: '1 1 300px' }}>
                    <Typography variant="subtitle1" gutterBottom>
                        System Colors
                    </Typography>
                    {colorTokens.slice(6).map((token) => (
                        <ColorToken key={token.name} {...token} />
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

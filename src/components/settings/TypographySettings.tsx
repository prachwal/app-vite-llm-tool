import {
    Box,
    Card,
    CardContent,
    Typography,
    Slider,
    Chip,
    Stack
} from '@mui/material';
import type { FC } from 'preact/compat';
import { appSettings, updateTypographySettings } from '../../services/settingsService';

export const TypographySettings: FC = () => {
    const settings = appSettings.value.typography;

    const handleFontSizeChange = (_: Event, value: number | number[]) => {
        updateTypographySettings({
            fontSize: Array.isArray(value) ? value[0] : value
        });
    };

    const handleLineHeightChange = (_: Event, value: number | number[]) => {
        updateTypographySettings({
            lineHeight: Array.isArray(value) ? value[0] : value
        });
    };

    const handleSpacingChange = (_: Event, value: number | number[]) => {
        updateTypographySettings({
            spacingScale: Array.isArray(value) ? value[0] : value
        });
    };

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Typography & Spacing
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Customize text size, line height and spacing scale
                </Typography>

                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {/* Font Size Control */}
                    <Box sx={{ flex: '1 1 250px' }}>
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2">Font Size</Typography>
                                <Chip label={`${settings.fontSize}px`} size="small" />
                            </Box>
                            <Slider
                                value={settings.fontSize}
                                onChange={handleFontSizeChange}
                                min={12}
                                max={24}
                                step={1}
                                marks={[
                                    { value: 12, label: '12px' },
                                    { value: 16, label: '16px' },
                                    { value: 20, label: '20px' },
                                    { value: 24, label: '24px' }
                                ]}
                                valueLabelDisplay="auto"
                            />
                        </Box>
                    </Box>

                    {/* Line Height Control */}
                    <Box sx={{ flex: '1 1 250px' }}>
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2">Line Height</Typography>
                                <Chip label={`${settings.lineHeight}`} size="small" />
                            </Box>
                            <Slider
                                value={settings.lineHeight}
                                onChange={handleLineHeightChange}
                                min={1.2}
                                max={2.0}
                                step={0.1}
                                marks={[
                                    { value: 1.2, label: '1.2' },
                                    { value: 1.5, label: '1.5' },
                                    { value: 1.8, label: '1.8' },
                                    { value: 2.0, label: '2.0' }
                                ]}
                                valueLabelDisplay="auto"
                            />
                        </Box>
                    </Box>

                    {/* Spacing Scale Control */}
                    <Box sx={{ flex: '1 1 250px' }}>
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle2">Spacing Scale</Typography>
                                <Chip label={`${settings.spacingScale}x`} size="small" />
                            </Box>
                            <Slider
                                value={settings.spacingScale}
                                onChange={handleSpacingChange}
                                min={0.5}
                                max={2.0}
                                step={0.1}
                                marks={[
                                    { value: 0.5, label: '0.5x' },
                                    { value: 1.0, label: '1x' },
                                    { value: 1.5, label: '1.5x' },
                                    { value: 2.0, label: '2x' }
                                ]}
                                valueLabelDisplay="auto"
                            />
                        </Box>
                    </Box>
                </Box>

                {/* Live Preview */}
                <Box sx={{ mt: 4, p: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Live Preview
                    </Typography>
                    <Stack spacing={settings.spacingScale}>
                        <Typography
                            variant="h6"
                            sx={{
                                fontSize: `${settings.fontSize * 1.25}px`,
                                lineHeight: settings.lineHeight
                            }}
                        >
                            Sample Heading Text
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{
                                fontSize: `${settings.fontSize}px`,
                                lineHeight: settings.lineHeight
                            }}
                        >
                            This is sample body text that demonstrates how the typography settings affect readability.
                            You can see the changes in font size, line height, and spacing in real time.
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{
                                fontSize: `${settings.fontSize * 0.75}px`,
                                lineHeight: settings.lineHeight
                            }}
                        >
                            This is smaller caption text with the same settings applied.
                        </Typography>
                    </Stack>
                </Box>
            </CardContent>
        </Card>
    );
};

import {
    Box,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Card,
    CardContent,
    Typography,
    Chip
} from '@mui/material';
import { Brightness4, Brightness7, SettingsBrightness } from '@mui/icons-material';
import type { FC } from 'preact/compat';
import { themeMode, setThemeMode, type ThemeMode } from '../../providers/ThemeProvider';

export const ThemeSettings: FC = () => {
    const handleThemeChange = (event: Event) => {
        const target = event.target as HTMLInputElement;
        setThemeMode(target.value as ThemeMode);
    };

    const getThemeIcon = (mode: ThemeMode) => {
        switch (mode) {
            case 'light': return <Brightness7 />;
            case 'dark': return <Brightness4 />;
            case 'system': return <SettingsBrightness />;
        }
    };

    const getThemeDescription = (mode: ThemeMode) => {
        switch (mode) {
            case 'light': return 'Always use light theme';
            case 'dark': return 'Always use dark theme';
            case 'system': return 'Follow system preference';
        }
    };

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    Theme Mode
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Choose your preferred color scheme
                </Typography>

                <FormControl component="fieldset">
                    <FormLabel component="legend">Color Scheme</FormLabel>
                    <RadioGroup
                        value={themeMode.value}
                        onChange={handleThemeChange}
                        sx={{ mt: 1 }}
                    >
                        {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => (
                            <FormControlLabel
                                key={mode}
                                value={mode}
                                control={<Radio />}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {getThemeIcon(mode)}
                                        <Box>
                                            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                                {mode}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {getThemeDescription(mode)}
                                            </Typography>
                                        </Box>
                                        {themeMode.value === mode && (
                                            <Chip label="Active" size="small" color="primary" />
                                        )}
                                    </Box>
                                }
                                sx={{
                                    mb: 1,
                                    alignItems: 'flex-start',
                                    '& .MuiFormControlLabel-label': { mt: -0.5 }
                                }}
                            />
                        ))}
                    </RadioGroup>
                </FormControl>

                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                        💡 System mode automatically switches between light and dark based on your device settings
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
};

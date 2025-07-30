import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { computed } from '@preact/signals';
import type { FC, PropsWithChildren } from 'preact/compat';
import { appSettings, updateThemeSettings } from '../services/settingsService';

// Re-export ThemeMode type
export type ThemeMode = 'light' | 'dark' | 'system';

// Sygnał globalny dla trybu motywu - teraz synchronizowany z appSettings
export const themeMode = computed(() => appSettings.value.theme.mode);

export function setThemeMode(mode: ThemeMode) {
    updateThemeSettings({ mode });
}

// Typography settings signals
export const typographySettings = computed(() => appSettings.value.typography);

export const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
    // No longer need useEffect for localStorage - handled by settingsService

    // Jeśli 'system', wykryj preferencje systemowe
    let muiMode: 'light' | 'dark' = themeMode.value === 'dark' ? 'dark' : 'light';
    if (themeMode.value === 'system') {
        if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            muiMode = 'dark';
        } else {
            muiMode = 'light';
        }
    }

    const theme = createTheme({
        palette: {
            mode: muiMode,
            primary: { main: '#1976d2' },
            secondary: { main: '#9c27b0' },
        },
        typography: {
            fontSize: typographySettings.value.fontSize,
            // Apply spacing scale to theme spacing
        },
        spacing: (factor: number) => `${typographySettings.value.spacingScale * factor * 8}px`,
    });

    return (
        <MuiThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </MuiThemeProvider>
    );
};

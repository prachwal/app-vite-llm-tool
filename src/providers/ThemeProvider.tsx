import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { FC, PropsWithChildren } from 'preact/compat';

// Sygnał globalny dla trybu motywu
export type ThemeMode = 'light' | 'dark' | 'system';
export const themeMode = signal<ThemeMode>(getInitialMode());

function getInitialMode(): ThemeMode {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('themeMode') : null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored as ThemeMode;
    // domyślnie wg preferencji systemu
    return 'system';
}

export function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode;
    if (typeof window !== 'undefined') localStorage.setItem('themeMode', mode);
}

export const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
    useEffect(() => {
        localStorage.setItem('themeMode', themeMode.value);
    }, [themeMode.value]);

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
    });

    return (
        <MuiThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </MuiThemeProvider>
    );
};

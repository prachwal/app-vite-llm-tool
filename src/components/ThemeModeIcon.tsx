import { IconButton, Tooltip } from '@mui/material';
import { themeMode, setThemeMode } from '../providers/ThemeProvider';
import { useSignal } from '@preact/signals';
import { useCallback } from 'preact/hooks';

// SVG ikony
const Sun = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Tryb jasny"><circle cx="12" cy="12" r="5" fill="#FFC107" /><g stroke="#FFC107" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /><line x1="4.22" y1="4.22" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.78" y2="19.78" /><line x1="4.22" y1="19.78" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.78" y2="4.22" /></g></svg>
);
const Moon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Tryb ciemny"><path d="M21 12.79A9 9 0 0112.79 3a7 7 0 100 14 9 9 0 008.21-4.21z" fill="#90CAF9" /></svg>
);
const System = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-label="Tryb systemowy"><rect x="4" y="4" width="16" height="16" rx="4" fill="#BDBDBD" /><path d="M4 12h16" stroke="#616161" strokeWidth="2" /></svg>
);

const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

function getNextMode(current: 'light' | 'dark' | 'system'): 'light' | 'dark' | 'system' {
    const idx = modes.indexOf(current);
    return modes[(idx + 1) % modes.length];
}

export const ThemeModeIcon = () => {
    const mode = useSignal(themeMode.value);

    // Synchronizacja sygnału z globalnym themeMode
    themeMode.subscribe((val) => { mode.value = val; });

    const handleClick = useCallback(() => {
        const next = getNextMode(mode.value);
        setThemeMode(next);
    }, [mode.value]);

    let icon = <Sun />;
    let label = 'Tryb jasny';
    if (mode.value === 'dark') { icon = <Moon />; label = 'Tryb ciemny'; }
    if (mode.value === 'system') { icon = <System />; label = 'Tryb systemowy'; }

    return (
        <Tooltip title={label}>
            <IconButton color="inherit" onClick={handleClick} aria-label={label} sx={{ mr: 1 }}>
                {icon}
            </IconButton>
        </Tooltip>
    );
};

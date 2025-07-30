import { signal } from '@preact/signals';
import type { ThemeMode } from '../providers/ThemeProvider';

// Settings interface
export interface AppSettings {
    theme: {
        mode: ThemeMode;
    };
    typography: {
        fontSize: number;
        lineHeight: number;
        spacingScale: number;
    };
    version: string;
}

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
    theme: {
        mode: 'system'
    },
    typography: {
        fontSize: 16,
        lineHeight: 1.5,
        spacingScale: 1.0
    },
    version: '1.0.0'
};

const STORAGE_KEY = 'app-vite-llm-tool-settings';

// Global settings signal
export const appSettings = signal<AppSettings>(loadSettings());

// Load settings from localStorage
function loadSettings(): AppSettings {
    try {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return DEFAULT_SETTINGS;
        }

        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return DEFAULT_SETTINGS;
        }

        const parsed = JSON.parse(stored) as Partial<AppSettings>;

        // Validate and merge with defaults
        return validateSettings(parsed);
    } catch (error) {
        console.warn('Failed to load settings from localStorage:', error);
        return DEFAULT_SETTINGS;
    }
}

// Validate settings object and provide defaults for missing values
function validateSettings(settings: Partial<AppSettings>): AppSettings {
    const validated: AppSettings = {
        theme: {
            mode: validateThemeMode(settings.theme?.mode) || DEFAULT_SETTINGS.theme.mode
        },
        typography: {
            fontSize: validateNumber(settings.typography?.fontSize, 12, 24) || DEFAULT_SETTINGS.typography.fontSize,
            lineHeight: validateNumber(settings.typography?.lineHeight, 1.2, 2.0) || DEFAULT_SETTINGS.typography.lineHeight,
            spacingScale: validateNumber(settings.typography?.spacingScale, 0.5, 2.0) || DEFAULT_SETTINGS.typography.spacingScale
        },
        version: settings.version || DEFAULT_SETTINGS.version
    };

    return validated;
}

// Validation helpers
function validateThemeMode(mode: unknown): ThemeMode | null {
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
        return mode;
    }
    return null;
}

function validateNumber(value: unknown, min: number, max: number): number | null {
    if (typeof value === 'number' && !isNaN(value) && value >= min && value <= max) {
        return value;
    }
    return null;
}

// Save settings to localStorage
export function saveSettings(settings: AppSettings): void {
    try {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return;
        }

        const validated = validateSettings(settings);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
        appSettings.value = validated;

        console.debug('Settings saved successfully:', validated);
    } catch (error) {
        console.error('Failed to save settings to localStorage:', error);
    }
}

// Update specific setting sections
export function updateThemeSettings(theme: Partial<AppSettings['theme']>): void {
    const newSettings: AppSettings = {
        ...appSettings.value,
        theme: {
            ...appSettings.value.theme,
            ...theme
        }
    };
    saveSettings(newSettings);
}

export function updateTypographySettings(typography: Partial<AppSettings['typography']>): void {
    const newSettings: AppSettings = {
        ...appSettings.value,
        typography: {
            ...appSettings.value.typography,
            ...typography
        }
    };
    saveSettings(newSettings);
}

// Reset to defaults
export function resetSettings(): void {
    saveSettings(DEFAULT_SETTINGS);
}

// Export current settings as JSON (for backup/debugging)
export function exportSettings(): string {
    return JSON.stringify(appSettings.value, null, 2);
}

// Import settings from JSON string
export function importSettings(jsonString: string): boolean {
    try {
        const parsed = JSON.parse(jsonString) as Partial<AppSettings>;
        const validated = validateSettings(parsed);
        saveSettings(validated);
        return true;
    } catch (error) {
        console.error('Failed to import settings:', error);
        return false;
    }
}

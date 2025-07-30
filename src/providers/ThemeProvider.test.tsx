import { describe, it, expect, beforeEach } from 'vitest';
import { themeMode, setThemeMode } from './ThemeProvider';

const STORAGE_KEY = 'app-vite-llm-tool-settings';

describe('ThemeProvider Logic', () => {
    beforeEach(() => {
        // Ensure localStorage exists and is clear
        if (typeof localStorage !== 'undefined') {
            localStorage.clear();
        }
        setThemeMode('system');
    });

    it('should default to system mode', () => {
        expect(themeMode.value).toBe('system');
    });

    it('should persist themeMode in localStorage', () => {
        setThemeMode('dark');
        expect(themeMode.value).toBe('dark');
        
        // Check if settings are saved properly in localStorage
        const storedSettings = localStorage.getItem(STORAGE_KEY);
        expect(storedSettings).toBeTruthy();
        const parsedSettings = JSON.parse(storedSettings!);
        expect(parsedSettings.theme.mode).toBe('dark');

        setThemeMode('light');
        expect(themeMode.value).toBe('light');
        
        const storedSettings2 = localStorage.getItem(STORAGE_KEY);
        const parsedSettings2 = JSON.parse(storedSettings2!);
        expect(parsedSettings2.theme.mode).toBe('light');

        setThemeMode('system');
        expect(themeMode.value).toBe('system');
        
        const storedSettings3 = localStorage.getItem(STORAGE_KEY);
        const parsedSettings3 = JSON.parse(storedSettings3!);
        expect(parsedSettings3.theme.mode).toBe('system');
    });

    it('should update themeMode signal when setThemeMode is called', () => {
        expect(themeMode.value).toBe('system');

        setThemeMode('dark');
        expect(themeMode.value).toBe('dark');

        setThemeMode('light');
        expect(themeMode.value).toBe('light');
    });

    it('should handle missing localStorage gracefully', () => {
        // Mock missing localStorage
        const originalLocalStorage = globalThis.localStorage;

        // Remove localStorage temporarily
        Object.defineProperty(globalThis, 'localStorage', {
            value: undefined,
            writable: true,
        });

        expect(() => setThemeMode('dark')).not.toThrow();

        // Restore localStorage
        Object.defineProperty(globalThis, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });
    });

    it('should validate theme mode values', () => {
        const validModes = ['light', 'dark', 'system'];

        validModes.forEach(mode => {
            setThemeMode(mode as any);
            expect(themeMode.value).toBe(mode);

            // Check if the mode is saved in the settings object
            if (typeof localStorage !== 'undefined') {
                const storedSettings = localStorage.getItem(STORAGE_KEY);
                expect(storedSettings).toBeTruthy();
                const parsedSettings = JSON.parse(storedSettings!);
                expect(parsedSettings.theme.mode).toBe(mode);
            }
        });
    });
});

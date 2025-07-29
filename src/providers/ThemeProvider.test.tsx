import { describe, it, expect, beforeEach } from 'vitest';
import { themeMode, setThemeMode } from './ThemeProvider';

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
        expect(localStorage.getItem('themeMode')).toBe('dark');

        setThemeMode('light');
        expect(localStorage.getItem('themeMode')).toBe('light');

        setThemeMode('system');
        expect(localStorage.getItem('themeMode')).toBe('system');
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

            // Only check localStorage if it exists
            if (typeof localStorage !== 'undefined') {
                expect(localStorage.getItem('themeMode')).toBe(mode);
            }
        });
    });
});

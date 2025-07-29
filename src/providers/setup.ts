// Globalne rozszerzenia do asercji
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock React dla kompatybilności z MUI + Preact
import { options } from 'preact';

// Konfiguracja Preact/compat dla MUI
options.debounceRendering = (cb) => cb();

// Mock React context dla MUI
vi.mock('react', async () => {
    const preact = await vi.importActual('preact/compat');
    return {
        ...preact,
        default: preact,
    };
});

// Mock localStorage dla środowiska testowego
if (typeof globalThis.localStorage === 'undefined') {
    let store: Record<string, string> = {};
    globalThis.localStorage = {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        key: (i: number) => Object.keys(store)[i] ?? null,
        length: 0,
    } as Storage;
}

// Mock matchMedia dla testów motywu systemowego
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
    window.matchMedia = vi.fn().mockImplementation((_query: string) => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    } as MediaQueryList));
}

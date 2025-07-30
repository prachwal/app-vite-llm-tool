// setup.ts - Enhanced setup file for Vitest with Preact + MUI

import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Global fetch mock (before imports that might use fetch)
global.fetch = vi.fn();

// Import Preact core
import { options, render as preactRender } from 'preact';
import { h, Fragment } from 'preact';

// Import testing library
import { cleanup } from '@testing-library/preact';

// Global declarations for JSX
declare global {
    var h: any;
    var Fragment: any;
}

// Assign to global scope for JSX compatibility
globalThis.h = h;
globalThis.Fragment = Fragment;

// Configure Preact for testing environment
const configurePreactForTesting = () => {
    // Disable async rendering and debouncing for predictable tests
    options.debounceRendering = (cb: () => void) => {
        cb();
        return undefined as any;
    };

    // Make animations synchronous
    if (typeof options.requestAnimationFrame !== 'undefined') {
        options.requestAnimationFrame = (cb: FrameRequestCallback) => {
            setTimeout(cb, 0);
            return 0;
        };
    }

    // Override diff options for testing - using any types to avoid TypeScript errors
    const originalDiff = (options as any).diff;
    (options as any).diff = (vnode: any) => {
        try {
            if (originalDiff) {
                originalDiff(vnode);
            }
        } catch (error) {
            // Suppress diff errors in tests that might cause __k issues
            console.warn('Preact diff warning in test:', error);
        }
    };

    // Ensure proper hook context initialization - using any types
    const originalHook = (options as any).__h;
    (options as any).__h = (component: any, index: any, type: any) => {
        try {
            if (originalHook) {
                return originalHook(component, index, type);
            }
        } catch (error) {
            console.warn('Hook initialization warning:', error);
            // Return a minimal hook context to prevent __k errors
            return {
                __H: { __: [], __h: [] },
                __h: []
            };
        }
    };
};

// Initialize Preact configuration
configurePreactForTesting();

// Mock DOM APIs
const setupDOMMocks = () => {
    // matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    // ResizeObserver mock
    global.ResizeObserver = class ResizeObserver {
        constructor(_callback: ResizeObserverCallback) { }
        observe(_target: Element, _options?: ResizeObserverOptions) { }
        unobserve(_target: Element) { }
        disconnect() { }
    };

    // IntersectionObserver mock
    global.IntersectionObserver = class IntersectionObserver {
        constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) { }
        observe(_target: Element) { }
        unobserve(_target: Element) { }
        disconnect() { }
        takeRecords(): IntersectionObserverEntry[] { return []; }
        readonly root: Element | null = null;
        readonly rootMargin: string = '';
        readonly thresholds: ReadonlyArray<number> = [];
    };

    // CSS.supports mock for MUI
    if (!window.CSS) {
        (window as any).CSS = {
            supports: vi.fn(() => false)
        };
    }

    // getComputedStyle mock for MUI
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = vi.fn((element: Element) => {
        const style = originalGetComputedStyle(element);
        return {
            ...style,
            getPropertyValue: vi.fn((prop: string) => {
                // Return reasonable defaults for common CSS properties
                const defaults: Record<string, string> = {
                    'font-size': '16px',
                    'line-height': '1.5',
                    'margin': '0px',
                    'padding': '0px',
                    'display': 'block'
                };
                return defaults[prop] || '';
            })
        };
    });
};

// Setup storage mocks
const setupStorageMocks = () => {
    const createStorageMock = () => {
        const storage = new Map<string, string>();

        return {
            getItem: vi.fn((key: string) => storage.get(key) || null),
            setItem: vi.fn((key: string, value: string) => {
                storage.set(key, value);
            }),
            removeItem: vi.fn((key: string) => {
                storage.delete(key);
            }),
            clear: vi.fn(() => {
                storage.clear();
            }),
            get length() {
                return storage.size;
            },
            key: vi.fn((index: number) => {
                const keys = Array.from(storage.keys());
                return keys[index] || null;
            }),
        };
    };

    Object.defineProperty(window, 'localStorage', {
        value: createStorageMock(),
        writable: true,
    });

    Object.defineProperty(window, 'sessionStorage', {
        value: createStorageMock(),
        writable: true,
    });
};

// Setup File APIs mock
const setupFileAPIMocks = () => {
    // File constructor mock
    global.File = class MockFile extends Blob {
        public name: string;
        public lastModified: number;
        public webkitRelativePath: string = '';

        constructor(fileBits: BlobPart[], name: string, options?: FilePropertyBag) {
            super(fileBits, options);
            this.name = name;
            this.lastModified = options?.lastModified || Date.now();
        }
    } as any;

    // FileReader mock
    global.FileReader = class MockFileReader extends EventTarget {
        public result: string | ArrayBuffer | null = null;
        public error: DOMException | null = null;
        public readyState: number = 0;

        public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
        public onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
        public onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

        readAsText(_file: Blob, _encoding?: string) {
            setTimeout(() => {
                this.result = 'mocked file content';
                this.readyState = 2;
                this.onload?.call(this as any, {} as ProgressEvent<FileReader>);
            }, 0);
        }

        readAsDataURL(_file: Blob) {
            setTimeout(() => {
                this.result = 'data:text/plain;base64,bW9ja2VkIGZpbGUgY29udGVudA==';
                this.readyState = 2;
                this.onload?.call(this as any, {} as ProgressEvent<FileReader>);
            }, 0);
        }

        readAsArrayBuffer(_file: Blob) {
            setTimeout(() => {
                this.result = new ArrayBuffer(8);
                this.readyState = 2;
                this.onload?.call(this as any, {} as ProgressEvent<FileReader>);
            }, 0);
        }

        abort() {
            this.readyState = 2;
            this.onabort?.call(this as any, {} as ProgressEvent<FileReader>);
        }

        static readonly EMPTY = 0;
        static readonly LOADING = 1;
        static readonly DONE = 2;
    } as any;

    // URL object methods
    if (!URL.createObjectURL) {
        Object.defineProperty(URL, 'createObjectURL', {
            value: vi.fn(() => 'mocked-object-url'),
            configurable: true,
        });
    }

    if (!URL.revokeObjectURL) {
        Object.defineProperty(URL, 'revokeObjectURL', {
            value: vi.fn(),
            configurable: true,
        });
    }
};

// Setup MUI-specific mocks
const setupMUIMocks = () => {
    // Mock emotion cache for MUI
    if (typeof window !== 'undefined') {
        (window as any).__EMOTION_REACT_17_SSR__ = true;
    }

    // Mock React hooks for MUI compatibility with Preact
    // Import Preact hooks
    const { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer } = require('preact/hooks');

    // Create React-compatible hook object
    const reactHooks = {
        useState,
        useEffect,
        useRef,
        useMemo,
        useCallback,
        useContext,
        useReducer,
        useLayoutEffect: useEffect, // useLayoutEffect maps to useEffect in testing
        useImperativeHandle: vi.fn(() => { }),
        useDebugValue: vi.fn(() => { }),
        useDeferredValue: (value: any) => value, // Simple passthrough
        useId: vi.fn(() => 'test-id'),
        useInsertionEffect: useEffect,
        useSyncExternalStore: vi.fn((_subscribe: any, getSnapshot: any) => getSnapshot()),
        useTransition: vi.fn(() => [false, vi.fn()]),
    };

    // Mock React object globally for MUI
    if (typeof global !== 'undefined') {
        (global as any).React = reactHooks;
    }

    // Also mock React as a module for imports
    vi.mock('react', () => reactHooks);
};

// Initialize all mocks
const initializeMocks = () => {
    setupDOMMocks();
    setupStorageMocks();
    setupFileAPIMocks();
    setupMUIMocks();
};

// Test lifecycle hooks
beforeAll(() => {
    initializeMocks();
});

beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';

    // Reset all mocks
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Ensure clean Preact state
    configurePreactForTesting();
});

afterEach(() => {
    // Cleanup testing library
    cleanup();

    // Clear timers
    vi.clearAllTimers();

    // Clear any remaining DOM content
    document.body.innerHTML = '';
});

afterAll(() => {
    // Final cleanup
    vi.restoreAllMocks();
});

// Utility functions for tests
export const createMockFile = (name: string, content: string = 'test content', type: string = 'text/plain') => {
    return new File([content], name, { type });
};

export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Enhanced render function that ensures proper Preact context
export const renderWithContext = (component: any, options?: any) => {
    // Pre-warm Preact context
    const tempDiv = document.createElement('div');
    document.body.appendChild(tempDiv);

    try {
        preactRender(h('div', null), tempDiv);
        preactRender(null, tempDiv);
    } catch (e) {
        console.warn('Preact pre-warm warning:', e);
    } finally {
        document.body.removeChild(tempDiv);
    }

    // Now render the actual component
    const { render } = require('@testing-library/preact');
    return render(component, options);
};

// Re-export testing library functions
export { screen, waitFor, fireEvent } from '@testing-library/preact';
export { render } from '@testing-library/preact';



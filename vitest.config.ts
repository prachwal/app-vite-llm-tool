// vitest.config.ts - Enhanced configuration for Preact + MUI testing

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom', // Default environment for frontend tests
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'netlify/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
        exclude: [
            'node_modules',
            'dist',
            '.idea',
            '.git',
            '.cache',
            '**/node_modules/**',
            'src/test/.netlify/**',
            '**/.netlify/**',
            'src/test/plugins/**'
        ],        // Increased timeouts for complex component tests
        testTimeout: 15000,
        hookTimeout: 15000,
        teardownTimeout: 10000,

        // Thread configuration for stability
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true, // Single thread prevents Preact context conflicts
                isolate: true,     // Isolate tests to prevent state leakage
            }
        },

        // Retry configuration
        retry: 2, // Retry flaky tests up to 2 times

        // Mock configuration
        clearMocks: true,
        restoreMocks: true,
        mockReset: true,

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                '**/*.stories.tsx',
                '**/*.stories.ts',
                '**/*.stories.jsx',
                '**/node_modules/**',
                '**/dist/**',
                '**/*.config.*',
                '**/coverage/**',
                '**/*.test.*',
                '**/*.spec.*'
            ],
            thresholds: {
                global: {
                    branches: 70,
                    functions: 70,
                    lines: 70,
                    statements: 70
                }
            }
        },

        // Environment configuration
        env: {
            NODE_ENV: 'test',
            VITEST: 'true'
        },

        // Disable file watching for CI/CD
        watch: false,

        // Reporter configuration
        reporters: process.env.CI ? ['basic'] : ['verbose'],

        // Sequence configuration for deterministic test runs
        sequence: {
            shuffle: false, // Disable shuffling for consistent results
            concurrent: false // Run tests sequentially for Preact stability
        }
    },

    // ESBuild configuration for JSX
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'preact',
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
        target: 'es2020',
        // Enable source maps for better debugging
        sourcemap: true,
        // Optimize for testing
        keepNames: true
    },

    // Path resolution
    resolve: {
        alias: {
            // Main path alias
            '@': resolve(__dirname, './src'),

            // Preact compatibility aliases
            'react': 'preact/compat',
            'react-dom': 'preact/compat',
            'react-dom/client': 'preact/compat',
            'react/jsx-runtime': 'preact/jsx-runtime',
            'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
            'react-test-renderer': 'preact/test-utils',

            // Additional aliases for common libraries
            '@emotion/react': '@emotion/react',
            '@emotion/styled': '@emotion/styled',
            '@mui/material': '@mui/material',
            '@mui/icons-material': '@mui/icons-material',
            '@mui/system': '@mui/system'
        }
    },

    // Global definitions
    define: {
        'process.env.NODE_ENV': JSON.stringify('test'),
        'process.env.VITEST': JSON.stringify('true'),
        '__DEV__': JSON.stringify(true),
        // For MUI compatibility
        'process.env.MUI_SUPPRESS_ED_WARNINGS': JSON.stringify('true')
    },

    // Optimization for testing
    optimizeDeps: {
        include: [
            'preact',
            'preact/compat',
            'preact/hooks',
            '@testing-library/preact',
            '@testing-library/jest-dom',
            '@mui/material',
            '@emotion/react',
            '@emotion/styled'
        ],
        exclude: [
            // Exclude problematic dependencies
        ]
    },

    // Server configuration for test environment
    server: {
        fs: {
            // Allow serving files from parent directory
            allow: ['..']
        }
    }
})

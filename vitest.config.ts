import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
    plugins: [preact()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['**/*.stories.tsx', '**/*.stories.ts', '**/*.stories.jsx'],
        },
    },
    resolve: {
        alias: {
            'react': 'preact/compat',
            'react-dom': 'preact/compat',
        },
    },
});

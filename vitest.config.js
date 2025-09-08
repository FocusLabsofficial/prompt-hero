import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.js',
        '**/*.spec.js',
        'docs/',
        'scripts/',
        'database/',
        'vercel.json',
        'package.json'
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    },
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000
  }
});

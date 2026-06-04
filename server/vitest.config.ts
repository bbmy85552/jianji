import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});

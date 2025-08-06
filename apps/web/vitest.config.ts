import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Configure test environment to handle async cleanup better
    testTimeout: 10000,
    hookTimeout: 10000,
    // Ensure proper cleanup of resources
    onConsoleLog: (log: string): boolean => {
      // Don't fail tests on React warnings about state updates after unmount in test env
      if (log.includes('Warning: Can\'t perform a React state update on an unmounted component')) {
        return false;
      }
      return true;
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});

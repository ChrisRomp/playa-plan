// Vitest setup file
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Setup global mocks
global.localStorage = localStorageMock as unknown as Storage;

// Ensure window is always available in tests
if (typeof window === 'undefined') {
  // This should not happen with jsdom but let's be safe
  Object.defineProperty(globalThis, 'window', {
    value: {},
    writable: true,
    configurable: true
  });
}

// Mock window.URL for tests that use it
if (!window.URL) {
  Object.defineProperty(window, 'URL', {
    value: {
      createObjectURL: vi.fn(() => 'mocked-url'),
      revokeObjectURL: vi.fn(),
    },
    writable: true,
    configurable: true
  });
}

// Mock window.location for tests that use it
if (!window.location) {
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
    writable: true,
    configurable: true
  });
}

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

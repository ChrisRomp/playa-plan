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

// Clean up after each test
afterEach(async () => {
  cleanup();
  vi.clearAllMocks();
  // Clear any pending timers
  vi.clearAllTimers();
});

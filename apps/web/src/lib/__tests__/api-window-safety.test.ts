import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Type for global object with window property
interface GlobalWithWindow {
  window?: Window & typeof globalThis & {
    RUNTIME_CONFIG?: {
      API_URL?: string;
    };
  };
}

describe('api.ts window safety', () => {
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    // Store the original window
    originalWindow = (global as GlobalWithWindow).window;
  });

  afterEach(() => {
    // Restore the original window
    (global as GlobalWithWindow).window = originalWindow;
    // Clear module cache to force re-import
    vi.resetModules();
  });

  it('should not throw ReferenceError when window is undefined during module import', () => {
    // Remove window from global scope to simulate strict Node.js environment
    delete (global as GlobalWithWindow).window;

    // This should not throw a ReferenceError
    expect(() => {
      // Force re-import of the api module
      vi.doUnmock('../api');
      return import('../api');
    }).not.toThrow();
  });

  it('should handle API URL configuration safely when window is undefined', async () => {
    // Remove window from global scope
    delete (global as GlobalWithWindow).window;

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should fall back to environment variable or default
    expect(api.defaults.baseURL).toBe('http://localhost:3000');
  });

  it('should handle window.RUNTIME_CONFIG safely when window exists but RUNTIME_CONFIG is undefined', async () => {
    // Set window but without RUNTIME_CONFIG
    (global as GlobalWithWindow).window = {} as Window & typeof globalThis;

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should fall back to environment variable or default
    expect(api.defaults.baseURL).toBe('http://localhost:3000');
  });

  it('should use runtime config when available', async () => {
    // Set window with RUNTIME_CONFIG
    (global as GlobalWithWindow).window = {
      RUNTIME_CONFIG: {
        API_URL: 'https://api.example.com'
      }
    } as Window & typeof globalThis & {
      RUNTIME_CONFIG: {
        API_URL: string;
      };
    };

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should use the runtime config
    expect(api.defaults.baseURL).toBe('https://api.example.com');
  });

  it('should skip template URLs with unprocessed placeholders', async () => {
    // Set window with template URL
    (global as GlobalWithWindow).window = {
      RUNTIME_CONFIG: {
        API_URL: 'https://api.${ENVIRONMENT}.example.com'
      }
    } as Window & typeof globalThis & {
      RUNTIME_CONFIG: {
        API_URL: string;
      };
    };

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should fall back to environment variable or default, skipping the template
    expect(api.defaults.baseURL).toBe('http://localhost:3000');
  });
});
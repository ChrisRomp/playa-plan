import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('api.ts window safety', () => {
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    // Store the original window
    originalWindow = (global as any).window;
  });

  afterEach(() => {
    // Restore the original window
    (global as any).window = originalWindow;
    // Clear module cache to force re-import
    vi.resetModules();
  });

  it('should not throw ReferenceError when window is undefined during module import', () => {
    // Remove window from global scope to simulate strict Node.js environment
    delete (global as any).window;

    // This should not throw a ReferenceError
    expect(() => {
      // Force re-import of the api module
      vi.doUnmock('../api');
      return import('../api');
    }).not.toThrow();
  });

  it('should handle API URL configuration safely when window is undefined', async () => {
    // Remove window from global scope
    delete (global as any).window;

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should fall back to environment variable or default
    expect(api.defaults.baseURL).toBe('http://localhost:3000');
  });

  it('should handle window.RUNTIME_CONFIG safely when window exists but RUNTIME_CONFIG is undefined', async () => {
    // Set window but without RUNTIME_CONFIG
    (global as any).window = {};

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should fall back to environment variable or default
    expect(api.defaults.baseURL).toBe('http://localhost:3000');
  });

  it('should use runtime config when available', async () => {
    // Set window with RUNTIME_CONFIG
    (global as any).window = {
      RUNTIME_CONFIG: {
        API_URL: 'https://api.example.com'
      }
    };

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should use the runtime config
    expect(api.defaults.baseURL).toBe('https://api.example.com');
  });

  it('should skip template URLs with unprocessed placeholders', async () => {
    // Set window with template URL
    (global as any).window = {
      RUNTIME_CONFIG: {
        API_URL: 'https://api.${ENVIRONMENT}.example.com'
      }
    };

    // Force re-import of the api module
    vi.doUnmock('../api');
    const { api } = await import('../api');

    // Should fall back to environment variable or default, skipping the template
    expect(api.defaults.baseURL).toBe('http://localhost:3000');
  });
});
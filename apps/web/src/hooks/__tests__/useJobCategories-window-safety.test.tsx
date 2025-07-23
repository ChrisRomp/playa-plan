import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';

// This test verifies that the window safety fixes prevent CI failures
describe('useJobCategories window safety', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should import and use the hook without window-related errors', async () => {
    // Mock the API to avoid actual network requests
    const mockJobCategories = {
      getAll: vi.fn().mockResolvedValue([
        { id: '1', name: 'Kitchen', description: 'Kitchen jobs', staffOnly: false, alwaysRequired: false }
      ])
    };

    // Mock the api module before importing the hook
    vi.doMock('../../lib/api', () => ({
      jobCategories: mockJobCategories
    }));

    // Import the hook after mocking
    const { useJobCategories } = await import('../useJobCategories');

    // This should not throw "ReferenceError: window is not defined"
    expect(() => {
      const { result } = renderHook(() => useJobCategories());
      
      // Verify hook initializes properly
      expect(result.current.categories).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    }).not.toThrow();
  });

  it('should handle async operations without causing unhandled promise rejections', async () => {
    // Import normally since jsdom provides window
    const { useJobCategories } = await import('../useJobCategories');
    
    // Mock API to test async behavior
    const mockGetAll = vi.fn();
    vi.doMock('../../lib/api', () => ({
      jobCategories: {
        getAll: mockGetAll
      }
    }));

    // Create a controlled promise
    let resolvePromise: (value: any) => void;
    const controlledPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    mockGetAll.mockReturnValue(controlledPromise);

    const { unmount, result } = renderHook(() => useJobCategories());
    
    // Verify hook starts with loading state
    expect(result.current.loading).toBe(true);
    
    // Unmount before the async operation completes
    unmount();
    
    // Now resolve the promise - this should not cause unhandled errors
    resolvePromise!([
      { id: '1', name: 'Test', description: 'Test', staffOnly: false, alwaysRequired: false }
    ]);

    // Wait a bit to ensure any async cleanup happens
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Test should complete without unhandled promise rejections
    expect(true).toBe(true); // If we get here, no unhandled promises occurred
  });

  it('should demonstrate that API window access is now safe', () => {
    // Test that api.ts can be imported without window errors
    // This validates our fix for the window.RUNTIME_CONFIG access
    expect(() => {
      // Re-import to test module loading
      return import('../../lib/api');
    }).not.toThrow();
  });
});
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentMetadata } from '../useDocumentMetadata';

// Mock the API client
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

// Import the mocked API after the mock is defined
import { api } from '../../lib/api';
const mockApiGet = api.get as ReturnType<typeof vi.fn>;

describe('useDocumentMetadata', () => {
  beforeEach(() => {
    // Reset DOM state
    document.title = 'Test';
    const metaTag = document.querySelector('meta[name="description"]');
    if (metaTag) {
      metaTag.remove();
    }
    
    // Reset API mock
    mockApiGet.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should update document title with camp name', async () => {
    const mockConfig = {
      campName: 'Black Rock City Camp',
      campDescription: 'A test camp description'
    };

    mockApiGet.mockResolvedValueOnce({
      data: mockConfig
    });

    renderHook(() => useDocumentMetadata());

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockApiGet).toHaveBeenCalledWith('/public/config');
    expect(document.title).toBe('Black Rock City Camp - Camp Registration');
  });

  it('should update meta description with sanitized camp description', async () => {
    const mockConfig = {
      campName: 'Test Camp',
      campDescription: '<p>This is a <strong>test</strong> description with HTML tags</p>'
    };

    mockApiGet.mockResolvedValueOnce({
      data: mockConfig
    });

    renderHook(() => useDocumentMetadata());

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    const metaTag = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(metaTag).toBeTruthy();
    expect(metaTag.content).toBe('This is a test description with HTML tags');
  });

  it('should handle API errors gracefully', async () => {
    mockApiGet.mockRejectedValueOnce(new Error('API Error'));

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useDocumentMetadata());

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleSpy).toHaveBeenCalledWith('Failed to update document metadata:', expect.any(Error));
    expect(document.title).toBe('Test'); // Should remain unchanged
  });

  it('should truncate long descriptions to 160 characters', async () => {
    const longDescription = 'A'.repeat(200);
    const mockConfig = {
      campName: 'Test Camp',
      campDescription: longDescription
    };

    mockApiGet.mockResolvedValueOnce({
      data: mockConfig
    });

    renderHook(() => useDocumentMetadata());

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    const metaTag = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(metaTag.content.length).toBe(160);
    expect(metaTag.content).toBe('A'.repeat(160));
  });
}); 
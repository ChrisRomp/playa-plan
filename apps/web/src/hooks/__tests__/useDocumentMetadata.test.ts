import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { useDocumentMetadata } from '../useDocumentMetadata';

// Mock fetch
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

describe('useDocumentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document title and meta description
    document.title = 'PlayaPlan';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Camp registration and management platform');
    }
  });

  it('should update document title when camp configuration is available', async () => {
    const mockConfig = {
      campName: 'Burning Man 2024',
      campDescription: 'The ultimate desert experience with art, music, and community.',
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockConfig),
    } as Response);

    renderHook(() => useDocumentMetadata());

    // Wait for the async operation to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.title).toBe('Burning Man 2024 - Camp Registration');
  });

  it('should update meta description and strip HTML tags', async () => {
    const mockConfig = {
      campName: 'Test Camp',
      campDescription: '<p>This is a <strong>test description</strong> with HTML tags.</p>',
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockConfig),
    } as Response);

    renderHook(() => useDocumentMetadata());

    // Wait for the async operation to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(metaDesc?.content).toBe('This is a test description with HTML tags.');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useDocumentMetadata());

    // Wait for the async operation to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(consoleSpy).toHaveBeenCalledWith('Failed to update document metadata:', expect.any(Error));
    expect(document.title).toBe('PlayaPlan'); // Should remain unchanged

    consoleSpy.mockRestore();
  });

  it('should truncate long descriptions to 160 characters', async () => {
    const longDescription = 'A'.repeat(200);
    const mockConfig = {
      campName: 'Test Camp',
      campDescription: longDescription,
    };

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockConfig),
    } as Response);

    renderHook(() => useDocumentMetadata());

    // Wait for the async operation to complete
    await new Promise(resolve => setTimeout(resolve, 0));

    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(metaDesc?.content).toBe('A'.repeat(157) + '...');
    expect(metaDesc?.content.length).toBe(160);
  });
}); 
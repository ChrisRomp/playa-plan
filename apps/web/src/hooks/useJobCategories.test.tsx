import { renderHook, act } from '@testing-library/react';
import { useJobCategories } from './useJobCategories';
import * as api from '../lib/api';
import { describe, it, vi, beforeEach } from 'vitest';

const mockCategories = [
  { id: '1', name: 'Kitchen', description: 'Kitchen jobs' },
  { id: '2', name: 'Greeter', description: 'Greeting jobs' },
];

describe('useJobCategories', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch categories on mount', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockResolvedValue(mockCategories);
    const { result } = renderHook(() => useJobCategories());
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await result.current.fetchCategories();
    });
    expect(result.current.categories).toEqual(mockCategories);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch error', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useJobCategories());
    await act(async () => {
      await result.current.fetchCategories();
    });
    expect(result.current.error).toBe('Failed to fetch job categories');
  });

  it('should create a category', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockResolvedValue([]);
    const created = { id: '3', name: 'New', description: 'Desc' };
    vi.spyOn(api.jobCategories, 'create').mockResolvedValue(created);
    const { result } = renderHook(() => useJobCategories());
    await act(async () => {
      await result.current.fetchCategories();
      await result.current.createCategory({ name: 'New', description: 'Desc' });
    });
    expect(result.current.categories).toContainEqual(created);
  });

  it('should handle create error', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockResolvedValue([]);
    vi.spyOn(api.jobCategories, 'create').mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useJobCategories());
    await act(async () => {
      await result.current.fetchCategories();
      await result.current.createCategory({ name: 'Bad', description: 'Bad' });
    });
    expect(result.current.error).toBe('Failed to create job category');
  });

  it('should update a category', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockResolvedValue(mockCategories);
    const updated = { ...mockCategories[0], name: 'Updated' };
    vi.spyOn(api.jobCategories, 'update').mockResolvedValue(updated);
    const { result } = renderHook(() => useJobCategories());
    await act(async () => {
      await result.current.fetchCategories();
      await result.current.updateCategory('1', { name: 'Updated' });
    });
    expect(result.current.categories[0].name).toBe('Updated');
  });

  it('should handle update error', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockResolvedValue(mockCategories);
    vi.spyOn(api.jobCategories, 'update').mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useJobCategories());
    await act(async () => {
      await result.current.fetchCategories();
      await result.current.updateCategory('1', { name: 'Bad' });
    });
    expect(result.current.error).toBe('Failed to update job category');
  });

  it('should delete a category', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockResolvedValue(mockCategories);
    vi.spyOn(api.jobCategories, 'delete').mockResolvedValue(mockCategories[0]);
    const { result } = renderHook(() => useJobCategories());
    await act(async () => {
      await result.current.fetchCategories();
      await result.current.deleteCategory('1');
    });
    expect(result.current.categories.find((c) => c.id === '1')).toBeUndefined();
  });

  it('should handle delete error', async () => {
    vi.spyOn(api.jobCategories, 'getAll').mockResolvedValue(mockCategories);
    vi.spyOn(api.jobCategories, 'delete').mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useJobCategories());
    await act(async () => {
      await result.current.fetchCategories();
      await result.current.deleteCategory('1');
    });
    expect(result.current.error).toBe('Failed to delete job category');
  });
}); 
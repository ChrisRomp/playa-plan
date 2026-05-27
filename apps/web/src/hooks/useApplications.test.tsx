import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';
import { useApplications } from './useApplications';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('useApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches applications with query parameters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'application-1',
            userId: 'user-1',
            year: 2025,
            status: 'APPLICATION_SUBMITTED',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 2,
        limit: 20,
      },
    });

    const { result } = renderHook(() => useApplications());

    await act(async () => {
      await result.current.fetchApplications({
        status: 'APPLICATION_SUBMITTED',
        year: 2025,
        search: 'river',
        page: 2,
        limit: 20,
      });
    });

    expect(api.get).toHaveBeenCalledWith(
      '/admin/applications?status=APPLICATION_SUBMITTED&year=2025&search=river&page=2&limit=20'
    );

    await waitFor(() => {
      expect(result.current.applications).toHaveLength(1);
      expect(result.current.total).toBe(1);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it('stores fetch errors', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Unable to load applications'));

    const { result } = renderHook(() => useApplications());

    await act(async () => {
      await result.current.fetchApplications();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Unable to load applications');
      expect(result.current.loading).toBe(false);
    });
  });

  it('approves, declines, bulk-processes, and loads application details', async () => {
    vi.mocked(api.patch)
      .mockResolvedValueOnce({ data: { success: true, status: 'APPLICATION_APPROVED' } })
      .mockResolvedValueOnce({ data: { success: true, status: 'APPLICATION_DECLINED' } })
      .mockResolvedValueOnce({ data: { success: true, processed: 2 } });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        id: 'application-1',
        userId: 'user-1',
        year: 2025,
        status: 'APPLICATION_APPROVED',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-02T00:00:00.000Z',
      },
    });

    const { result } = renderHook(() => useApplications());

    await act(async () => {
      await expect(result.current.approveApplication('application-1', 'Welcome')).resolves.toEqual({
        success: true,
        status: 'APPLICATION_APPROVED',
      });
      await expect(result.current.declineApplication('application-1', 'Not enough space')).resolves.toEqual({
        success: true,
        status: 'APPLICATION_DECLINED',
      });
      await expect(result.current.bulkProcess(['application-1', 'application-2'], 'approve')).resolves.toEqual({
        success: true,
        processed: 2,
      });
      await expect(result.current.getApplicationDetail('application-1')).resolves.toMatchObject({
        id: 'application-1',
        status: 'APPLICATION_APPROVED',
      });
    });

    expect(api.patch).toHaveBeenNthCalledWith(1, '/admin/applications/application-1/approve', { message: 'Welcome' });
    expect(api.patch).toHaveBeenNthCalledWith(2, '/admin/applications/application-1/decline', { message: 'Not enough space' });
    expect(api.patch).toHaveBeenNthCalledWith(3, '/admin/applications/bulk', {
      ids: ['application-1', 'application-2'],
      action: 'approve',
      message: undefined,
    });
    expect(api.get).toHaveBeenCalledWith('/admin/applications/application-1');
  });
});

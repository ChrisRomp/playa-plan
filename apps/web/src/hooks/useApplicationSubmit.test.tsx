import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';
import { useApplicationSubmit } from './useApplicationSubmit';

vi.mock('../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('useApplicationSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits applications and completes registrations', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { id: 'registration-1', status: 'APPLICATION_SUBMITTED' } })
      .mockResolvedValueOnce({ data: { id: 'registration-1', status: 'CONFIRMED' } });

    const { result } = renderHook(() => useApplicationSubmit());

    await act(async () => {
      await expect(result.current.submitApplication({
        campingOptions: ['camp-1'],
        customFields: { arrival: 'Tuesday' },
      })).resolves.toEqual({
        id: 'registration-1',
        status: 'APPLICATION_SUBMITTED',
      });

      await expect(result.current.completeRegistration({
        jobs: ['job-1'],
        acceptedTerms: true,
        deferPayment: true,
      })).resolves.toEqual({
        id: 'registration-1',
        status: 'CONFIRMED',
      });
    });

    expect(api.post).toHaveBeenNthCalledWith(1, '/registrations/apply', {
      campingOptions: ['camp-1'],
      customFields: { arrival: 'Tuesday' },
    });
    expect(api.post).toHaveBeenNthCalledWith(2, '/registrations/complete', {
      jobs: ['job-1'],
      acceptedTerms: true,
      deferPayment: true,
    });
    expect(result.current.error).toBeNull();
  });

  it('stores API error messages when submission fails', async () => {
    const error = {
      response: {
        data: {
          message: 'Approval workflow is closed',
        },
      },
    };
    vi.mocked(api.post).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useApplicationSubmit());

    await act(async () => {
      await expect(result.current.submitApplication({ campingOptions: ['camp-1'] })).rejects.toEqual(error);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Approval workflow is closed');
      expect(result.current.loading).toBe(false);
    });
  });
});

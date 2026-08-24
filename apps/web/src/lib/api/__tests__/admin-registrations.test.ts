import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { adminRegistrationsApi } from '../admin-registrations';

vi.mock('../../api', () => ({
  api: {
    put: vi.fn(),
  },
}));

const mockApiPut = vi.mocked(api.put);

describe('adminRegistrationsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make stale registration edits actionable', async () => {
    mockApiPut.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          message: 'Registration changed concurrently; refresh and retry the edit',
        },
      },
    });

    const editRequest = {
      expectedUpdatedAt: '2026-08-22T18:00:00.000Z',
      status: 'CONFIRMED' as const,
      jobIds: ['job-1'],
      campingOptionIds: ['camping-option-1'],
      notes: '',
      sendNotification: false,
    };

    await expect(
      adminRegistrationsApi.editRegistration('registration-1', editRequest),
    ).rejects.toThrow(
      'Registration changed concurrently; refresh and retry the edit. Close and reopen the editor to load the latest registration before retrying.',
    );
  });

  it('should not label other conflicts as stale registration edits', async () => {
    mockApiPut.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          message: 'Camping option is at capacity',
        },
      },
    });

    const editRequest = {
      expectedUpdatedAt: '2026-08-22T18:00:00.000Z',
      status: 'CONFIRMED' as const,
      jobIds: ['job-1'],
      campingOptionIds: ['camping-option-1'],
      notes: '',
      sendNotification: false,
    };

    await expect(
      adminRegistrationsApi.editRegistration('registration-1', editRequest),
    ).rejects.toThrow('Camping option is at capacity');
  });
});

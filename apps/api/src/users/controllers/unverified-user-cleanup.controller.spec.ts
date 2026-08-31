import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../../auth/types/safe-user';
import { UnverifiedUserCleanupService } from '../services/unverified-user-cleanup.service';
import { UnverifiedUserCleanupController } from './unverified-user-cleanup.controller';

describe('UnverifiedUserCleanupController', () => {
  const serviceMock = {
    listEligibleUsers: jest.fn(),
    deleteEligibleUsers: jest.fn(),
  };
  const controller = new UnverifiedUserCleanupController(
    serviceMock as unknown as UnverifiedUserCleanupService
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should list eligible users with validated pagination', async () => {
    const expectedResult = {
      users: [],
      total: 0,
      page: 1,
      limit: 100,
      totalPages: 1,
      minimumAgeDays: 30,
    };
    serviceMock.listEligibleUsers.mockResolvedValue(expectedResult);

    const actualResult = await controller.listEligibleUsers({
      page: 1,
      limit: 100,
    });

    expect(actualResult).toBe(expectedResult);
    expect(serviceMock.listEligibleUsers).toHaveBeenCalledWith(1, 100);
  });

  it('should forward selected IDs and the acting admin ID', async () => {
    const inputId = '11111111-1111-4111-8111-111111111111';
    const expectedResult = { deleted: [], skipped: [] };
    serviceMock.deleteEligibleUsers.mockResolvedValue(expectedResult);
    const request = {
      user: {
        id: 'admin-user-id',
        role: UserRole.ADMIN,
      },
    } as AuthenticatedRequest;

    const actualResult = await controller.deleteEligibleUsers({ ids: [inputId] }, request);

    expect(actualResult).toBe(expectedResult);
    expect(serviceMock.deleteEligibleUsers).toHaveBeenCalledWith([inputId], 'admin-user-id');
  });
});

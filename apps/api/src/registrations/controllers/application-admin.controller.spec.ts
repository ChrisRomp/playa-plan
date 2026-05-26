import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../../auth/types/safe-user';
import {
  ApplicationQueryDto,
  ApproveApplicationDto,
  BulkApplicationActionDto,
  DeclineApplicationDto,
} from '../dto/application-admin.dto';
import { ApplicationAdminService } from '../services/application-admin.service';
import { ApplicationAdminController } from './application-admin.controller';

describe('ApplicationAdminController', () => {
  let controller: ApplicationAdminController;
  let applicationAdminService: jest.Mocked<ApplicationAdminService>;

  const mockRequest = {
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    },
  } as unknown as AuthenticatedRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationAdminController],
      providers: [
        {
          provide: ApplicationAdminService,
          useValue: {
            approveApplication: jest.fn(),
            bulkProcessApplications: jest.fn(),
            declineApplication: jest.fn(),
            getApplicationDetail: jest.fn(),
            listApplications: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ApplicationAdminController>(ApplicationAdminController);
    applicationAdminService = module.get(ApplicationAdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should list applications', async () => {
    const inputQuery: ApplicationQueryDto = {
      page: 2,
      limit: 10,
      search: 'Dusty',
    };
    const expectedResult = { data: [], total: 0, page: 2, limit: 10 };
    applicationAdminService.listApplications.mockResolvedValue(expectedResult as never);

    const actualResult = await controller.listApplications(inputQuery);

    expect(applicationAdminService.listApplications).toHaveBeenCalledWith(inputQuery);
    expect(actualResult).toEqual(expectedResult);
  });

  it('should get application detail', async () => {
    applicationAdminService.getApplicationDetail.mockResolvedValue({ id: 'reg-123' } as never);

    const actualResult = await controller.getApplicationDetail('reg-123');

    expect(applicationAdminService.getApplicationDetail).toHaveBeenCalledWith('reg-123');
    expect(actualResult).toEqual({ id: 'reg-123' });
  });

  it('should approve an application using the authenticated user id', async () => {
    const inputDto: ApproveApplicationDto = {
      message: 'Approved',
    };
    applicationAdminService.approveApplication.mockResolvedValue({ id: 'reg-123' } as never);

    const actualResult = await controller.approveApplication('reg-123', inputDto, mockRequest);

    expect(applicationAdminService.approveApplication).toHaveBeenCalledWith(
      'reg-123',
      mockRequest.user.id,
      inputDto,
    );
    expect(actualResult).toEqual({ id: 'reg-123' });
  });

  it('should decline an application using the authenticated user id', async () => {
    const inputDto: DeclineApplicationDto = {
      message: 'Declined',
    };
    applicationAdminService.declineApplication.mockResolvedValue({ id: 'reg-123' } as never);

    const actualResult = await controller.declineApplication('reg-123', inputDto, mockRequest);

    expect(applicationAdminService.declineApplication).toHaveBeenCalledWith(
      'reg-123',
      mockRequest.user.id,
      inputDto,
    );
    expect(actualResult).toEqual({ id: 'reg-123' });
  });

  it('should bulk process applications using the authenticated user id', async () => {
    const inputDto: BulkApplicationActionDto = {
      ids: ['reg-123'],
      action: 'approve',
    };
    const expectedResult = { results: [], processed: 0, skipped: 0 };
    applicationAdminService.bulkProcessApplications.mockResolvedValue(expectedResult as never);

    const actualResult = await controller.bulkProcessApplications(inputDto, mockRequest);

    expect(applicationAdminService.bulkProcessApplications).toHaveBeenCalledWith(
      mockRequest.user.id,
      inputDto,
    );
    expect(actualResult).toEqual(expectedResult);
  });
});

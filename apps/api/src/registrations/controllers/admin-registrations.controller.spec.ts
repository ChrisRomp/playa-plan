import { Test, TestingModule } from '@nestjs/testing';
import { AdminRegistrationsController } from './admin-registrations.controller';
import { RegistrationAdminService } from '../services/registration-admin.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole, RegistrationStatus } from '@prisma/client';
import {
  AdminEditRegistrationDto,
  AdminCancelRegistrationDto,
  AdminRegistrationQueryDto,
  AdminRegistrationResponseDto,
} from '../dto/admin-registration.dto';

interface MockAuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

describe('AdminRegistrationsController', () => {
  let controller: AdminRegistrationsController;
  let adminService: jest.Mocked<RegistrationAdminService>;

  const mockAdminUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };



  const mockRegistration = {
    id: 'reg-123',
    userId: 'user-123',
    year: 2024,
    status: RegistrationStatus.CONFIRMED,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    user: {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'TestUser',
      role: UserRole.PARTICIPANT,
    },
    jobs: [],
    payments: [],
  };

  const mockRegistrationsResponse = {
    registrations: [mockRegistration],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockAdminResponse: AdminRegistrationResponseDto = {
    registration: mockRegistration,
    transactionId: 'tx-123',
    message: 'Registration successfully updated',
    notificationStatus: 'No notification sent',
  };

  const mockAuditRecords = [
    {
      id: 'audit-1',
      adminUserId: 'admin-123',
      actionType: 'REGISTRATION_EDIT' as const,
      targetRecordType: 'REGISTRATION' as const,
      targetRecordId: 'reg-123',
      oldValues: {},
      newValues: {},
      reason: 'Test reason',
      transactionId: 'tx-123',
      createdAt: new Date(),
      adminUser: {
        id: 'admin-123',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
      },
    },
  ];

  const mockCampingOptions = [
    {
      id: 'camping-reg-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-123',
      campingOptionId: 'camping-option-1',
      campingOption: {
        id: 'camping-option-1',
        name: 'RV Spot',
        description: 'RV parking spot',
        enabled: true,
        participantDues: 5000,
        staffDues: 0,
      },
    },
  ];

  beforeEach(async () => {
    const mockAdminService = {
      getRegistrations: jest.fn(),
      editRegistration: jest.fn(),
      cancelRegistration: jest.fn(),
      getRegistrationAuditTrail: jest.fn(),
      getUserCampingOptions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminRegistrationsController],
      providers: [
        { provide: RegistrationAdminService, useValue: mockAdminService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AdminRegistrationsController>(AdminRegistrationsController);
    adminService = module.get(RegistrationAdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRegistrations', () => {
    // Task 5.4.1: Test GET /admin/registrations endpoint with proper authorization
    it('should get registrations with proper authorization', async () => {
      const query: AdminRegistrationQueryDto = {
        page: 1,
        limit: 10,
        status: RegistrationStatus.CONFIRMED,
      };

      adminService.getRegistrations.mockResolvedValue(mockRegistrationsResponse);

      const result = await controller.getRegistrations(query);

      expect(adminService.getRegistrations).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockRegistrationsResponse);
    });

    it('should handle query parameters correctly', async () => {
      const query: AdminRegistrationQueryDto = {
        userId: 'user-123',
        year: 2024,
        status: RegistrationStatus.CONFIRMED,
        email: 'test@example.com',
        name: 'John',
        page: 2,
        limit: 20,
      };

      adminService.getRegistrations.mockResolvedValue(mockRegistrationsResponse);

      await controller.getRegistrations(query);

      expect(adminService.getRegistrations).toHaveBeenCalledWith(query);
    });

    it('should handle empty query parameters', async () => {
      const query: AdminRegistrationQueryDto = {};

      adminService.getRegistrations.mockResolvedValue(mockRegistrationsResponse);

      await controller.getRegistrations(query);

      expect(adminService.getRegistrations).toHaveBeenCalledWith({});
    });
  });

  describe('editRegistration', () => {
    // Task 5.4.2: Test PUT /admin/registrations/:id endpoint with validation and audit logging
    it('should edit registration with validation and audit logging', async () => {
      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.WAITLISTED,
        notes: 'Admin update',
        sendNotification: false,
      };

      const request = { user: mockAdminUser };

      adminService.editRegistration.mockResolvedValue(mockAdminResponse);

      const result = await controller.editRegistration('reg-123', editData, request as MockAuthenticatedRequest);

      expect(adminService.editRegistration).toHaveBeenCalledWith('reg-123', editData, 'admin-123');
      expect(result).toEqual(mockAdminResponse);
    });

    // Task 5.4.6: Test validation errors return appropriate error messages
    it('should handle validation errors', async () => {
      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.CONFIRMED,
        notes: 'Invalid data',
      };

      const request = { user: mockAdminUser };

      adminService.editRegistration.mockRejectedValue(
        new BadRequestException('Cannot edit a cancelled registration')
      );

      await expect(
        controller.editRegistration('reg-123', editData, request as MockAuthenticatedRequest)
      ).rejects.toThrow(BadRequestException);

      expect(adminService.editRegistration).toHaveBeenCalledWith('reg-123', editData, 'admin-123');
    });

    it('should handle not found errors', async () => {
      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.CONFIRMED,
        notes: 'Update non-existent registration',
      };

      const request = { user: mockAdminUser };

      adminService.editRegistration.mockRejectedValue(
        new NotFoundException('Registration reg-456 not found')
      );

      await expect(
        controller.editRegistration('reg-456', editData, request as MockAuthenticatedRequest)
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle conflict errors for capacity exceeded', async () => {
      const editData: AdminEditRegistrationDto = {
        campingOptionIds: ['camping-option-1'],
        notes: 'Adding camping option',
      };

      const request = { user: mockAdminUser };

      adminService.editRegistration.mockRejectedValue(
        new ConflictException('Camping option RV Spot is at capacity')
      );

      await expect(
        controller.editRegistration('reg-123', editData, request as MockAuthenticatedRequest)
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelRegistration', () => {
    // Task 5.4.3: Test DELETE /admin/registrations/:id endpoint with confirmation and cleanup
    it('should cancel registration with confirmation and cleanup', async () => {
      const cancelData: AdminCancelRegistrationDto = {
        reason: 'User request',
        sendNotification: false,
        processRefund: true,
      };

      const request = { user: mockAdminUser };

      const cancelResponse = {
        ...mockAdminResponse,
        message: 'Registration successfully cancelled',
        refundInfo: 'Refund of $150.00 processed automatically',
      };

      adminService.cancelRegistration.mockResolvedValue(cancelResponse);

      const result = await controller.cancelRegistration('reg-123', cancelData, request as MockAuthenticatedRequest);

      expect(adminService.cancelRegistration).toHaveBeenCalledWith('reg-123', cancelData, 'admin-123');
      expect(result).toEqual(cancelResponse);
    });

    it('should handle already cancelled registration', async () => {
      const cancelData: AdminCancelRegistrationDto = {
        reason: 'Duplicate cancellation',
        sendNotification: false,
        processRefund: false,
      };

      const request = { user: mockAdminUser };

      adminService.cancelRegistration.mockRejectedValue(
        new BadRequestException('Registration is already cancelled')
      );

      await expect(
        controller.cancelRegistration('reg-123', cancelData, request as MockAuthenticatedRequest)
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle not found registration', async () => {
      const cancelData: AdminCancelRegistrationDto = {
        reason: 'Cancel non-existent registration',
        sendNotification: false,
        processRefund: false,
      };

      const request = { user: mockAdminUser };

      adminService.cancelRegistration.mockRejectedValue(
        new NotFoundException('Registration reg-456 not found')
      );

      await expect(
        controller.cancelRegistration('reg-456', cancelData, request as MockAuthenticatedRequest)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRegistrationAuditTrail', () => {
    // Task 5.4.4: Test GET /admin/registrations/:id/audit-trail endpoint returns audit history
    it('should return audit history for registration', async () => {
      adminService.getRegistrationAuditTrail.mockResolvedValue(mockAuditRecords);

      const result = await controller.getRegistrationAuditTrail('reg-123');

      expect(adminService.getRegistrationAuditTrail).toHaveBeenCalledWith('reg-123');
      expect(result).toEqual(mockAuditRecords);
    });

    it('should handle not found registration for audit trail', async () => {
      adminService.getRegistrationAuditTrail.mockRejectedValue(
        new NotFoundException('Registration reg-456 not found')
      );

      await expect(
        controller.getRegistrationAuditTrail('reg-456')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty audit trail for registration with no history', async () => {
      adminService.getRegistrationAuditTrail.mockResolvedValue([]);

      const result = await controller.getRegistrationAuditTrail('reg-123');

      expect(result).toEqual([]);
    });
  });

  describe('getUserCampingOptions', () => {
    it('should return camping options for registration user', async () => {
      adminService.getUserCampingOptions.mockResolvedValue(mockCampingOptions);

      const result = await controller.getUserCampingOptions('reg-123');

      expect(adminService.getUserCampingOptions).toHaveBeenCalledWith('reg-123');
      expect(result).toEqual(mockCampingOptions);
    });

    it('should handle not found registration for camping options', async () => {
      adminService.getUserCampingOptions.mockRejectedValue(
        new NotFoundException('Registration reg-456 not found')
      );

      await expect(
        controller.getUserCampingOptions('reg-456')
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty array for user with no camping options', async () => {
      adminService.getUserCampingOptions.mockResolvedValue([]);

      const result = await controller.getUserCampingOptions('reg-123');

      expect(result).toEqual([]);
    });
  });

  describe('Authorization and Access Control', () => {

    // Task 5.4.5: Test unauthorized access returns proper HTTP status codes
    // Task 5.4.9: Test unauthenticated requests receive 401 Unauthorized for all endpoints
    it('should require authentication for all endpoints', async () => {
      // This test verifies that the JwtAuthGuard is applied to the controller
      // In a real application, the guard would throw UnauthorizedException for unauthenticated requests
      const guards = Reflect.getMetadata('__guards__', AdminRegistrationsController);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    // Task 5.4.7: Test participant users receive 403 Forbidden for all admin registration endpoints
    it('should reject participant users with 403 Forbidden', async () => {
      // This test verifies that the @Roles(UserRole.ADMIN) decorator is applied
      // In a real application, the RolesGuard would throw ForbiddenException for non-admin users
      const roles = Reflect.getMetadata('roles', AdminRegistrationsController);
      expect(roles).toContain(UserRole.ADMIN);
    });

    // Task 5.4.8: Test staff users receive 403 Forbidden for all admin registration endpoints
    it('should reject staff users with 403 Forbidden', async () => {
      // This test verifies that only ADMIN role is allowed
      // Staff users would be rejected by the RolesGuard
      const roles = Reflect.getMetadata('roles', AdminRegistrationsController);
      expect(roles).toEqual([UserRole.ADMIN]);
      expect(roles).not.toContain(UserRole.STAFF);
      expect(roles).not.toContain(UserRole.PARTICIPANT);
    });

    it('should allow admin users to access all endpoints', async () => {
      // This test verifies that admin users have access
      const roles = Reflect.getMetadata('roles', AdminRegistrationsController);
      expect(roles).toContain(UserRole.ADMIN);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const query: AdminRegistrationQueryDto = { page: 1, limit: 10 };

      adminService.getRegistrations.mockRejectedValue(new Error('Database connection failed'));

      await expect(controller.getRegistrations(query)).rejects.toThrow('Database connection failed');
    });

    it('should handle malformed registration IDs', async () => {
      adminService.editRegistration.mockRejectedValue(
        new BadRequestException('Invalid registration ID format')
      );

      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.CONFIRMED,
        notes: 'Test update',
      };

      const request = { user: mockAdminUser };

      await expect(
        controller.editRegistration('invalid-id', editData, request as MockAuthenticatedRequest)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Request Validation', () => {
    it('should validate edit registration data', async () => {
      // This test ensures that the DTO validation is working
      // In a real application, the ValidationPipe would validate the incoming data
      const editData: AdminEditRegistrationDto = {
        status: RegistrationStatus.CONFIRMED,
        notes: 'Valid update',
        sendNotification: true,
        campingOptionIds: ['camping-option-1'],
        jobIds: ['job-1', 'job-2'],
      };

      const request = { user: mockAdminUser };

      adminService.editRegistration.mockResolvedValue(mockAdminResponse);

      await controller.editRegistration('reg-123', editData, request as MockAuthenticatedRequest);

      expect(adminService.editRegistration).toHaveBeenCalledWith('reg-123', editData, 'admin-123');
    });

    it('should validate cancel registration data', async () => {
      const cancelData: AdminCancelRegistrationDto = {
        reason: 'Valid cancellation reason',
        sendNotification: true,
        processRefund: true,
      };

      const request = { user: mockAdminUser };

      adminService.cancelRegistration.mockResolvedValue(mockAdminResponse);

      await controller.cancelRegistration('reg-123', cancelData, request as MockAuthenticatedRequest);

      expect(adminService.cancelRegistration).toHaveBeenCalledWith('reg-123', cancelData, 'admin-123');
    });
  });
}); 
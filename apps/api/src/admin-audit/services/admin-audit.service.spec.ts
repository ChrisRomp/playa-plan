import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuditService, CreateAuditRecordDto } from './admin-audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditActionType, AdminAuditTargetType, Prisma } from '@prisma/client';
import { Logger } from '@nestjs/common';

describe('AdminAuditService', () => {
  let service: AdminAuditService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockAdminAudit = {
    id: 'audit-1',
    adminUserId: 'admin-user-1',
    actionType: AdminAuditActionType.REGISTRATION_EDIT,
    targetRecordType: AdminAuditTargetType.REGISTRATION,
    targetRecordId: 'registration-1',
    oldValues: { status: 'PENDING' },
    newValues: { status: 'CONFIRMED' },
    reason: 'Test reason',
    transactionId: 'transaction-1',
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockAdminUser = {
    id: 'admin-user-1',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
  };

  const mockAuditWithUser = {
    ...mockAdminAudit,
    adminUser: mockAdminUser,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      adminAudit: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminAuditService>(AdminAuditService);
    prismaService = module.get(PrismaService);

    // Mock logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditRecord', () => {
    describe('5.1.1 - Test createAuditRecord() with all required fields and proper data types', () => {
      it('should create audit record with all required fields', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: { status: 'PENDING' },
          newValues: { status: 'CONFIRMED' },
          reason: 'Updated registration status',
          transactionId: 'transaction-1',
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(mockAdminAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(prismaService.adminAudit.create).toHaveBeenCalledWith({
          data: {
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: 'registration-1',
            oldValues: { status: 'PENDING' },
            newValues: { status: 'CONFIRMED' },
            reason: 'Updated registration status',
            transactionId: 'transaction-1',
          },
        });
        expect(result).toEqual(mockAdminAudit);
      });

      it('should create audit record with only required fields (minimal data)', async () => {
        // Arrange
        const minimalData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_CANCEL,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.REGISTRATION_CANCEL,
          oldValues: null,
          newValues: null,
          reason: null,
          transactionId: null,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(minimalData);

        // Assert
        expect(prismaService.adminAudit.create).toHaveBeenCalledWith({
          data: {
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.REGISTRATION_CANCEL,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: 'registration-1',
            oldValues: Prisma.DbNull,
            newValues: Prisma.DbNull,
            reason: undefined,
            transactionId: undefined,
          },
        });
        expect(result).toEqual(expectedAudit);
      });

      it('should handle different action types correctly', async () => {
        const actionTypes = [
          AdminAuditActionType.REGISTRATION_EDIT,
          AdminAuditActionType.REGISTRATION_CANCEL,
          AdminAuditActionType.PAYMENT_REFUND,
          AdminAuditActionType.WORK_SHIFT_ADD,
          AdminAuditActionType.WORK_SHIFT_REMOVE,
          AdminAuditActionType.CAMPING_OPTION_ADD,
        ];

        for (const actionType of actionTypes) {
          // Arrange
          const createData: CreateAuditRecordDto = {
            adminUserId: 'admin-user-1',
            actionType,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: 'registration-1',
          };

          const expectedAudit = { ...mockAdminAudit, actionType };
          (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

          // Act
          const result = await service.createAuditRecord(createData);

          // Assert
          expect(result.actionType).toBe(actionType);
        }
      });

      it('should handle different target record types correctly', async () => {
        const targetTypes = [
          AdminAuditTargetType.REGISTRATION,
          AdminAuditTargetType.USER,
          AdminAuditTargetType.PAYMENT,
          AdminAuditTargetType.WORK_SHIFT,
          AdminAuditTargetType.CAMPING_OPTION,
        ];

        for (const targetType of targetTypes) {
          // Arrange
          const createData: CreateAuditRecordDto = {
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: targetType,
            targetRecordId: 'target-1',
          };

          const expectedAudit = { ...mockAdminAudit, targetRecordType: targetType };
          (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

          // Act
          const result = await service.createAuditRecord(createData);

          // Assert
          expect(result.targetRecordType).toBe(targetType);
        }
      });

      it('should handle complex JSON values in oldValues and newValues', async () => {
        // Arrange
        const complexOldValues = {
          user: { name: 'John Doe', email: 'john@test.com' },
          status: 'PENDING',
          metadata: { source: 'web', timestamp: '2025-01-01T00:00:00Z' },
          jobs: [{ id: 'job-1', name: 'Test Job' }],
        };

        const complexNewValues = {
          user: { name: 'John Smith', email: 'johnsmith@test.com' },
          status: 'CONFIRMED',
          metadata: { source: 'admin', timestamp: '2025-01-01T01:00:00Z' },
          jobs: [
            { id: 'job-1', name: 'Test Job' },
            { id: 'job-2', name: 'New Job' },
          ],
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: complexOldValues,
          newValues: complexNewValues,
        };

        const expectedAudit = {
          ...mockAdminAudit,
          oldValues: complexOldValues,
          newValues: complexNewValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(prismaService.adminAudit.create).toHaveBeenCalledWith({
          data: {
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: 'registration-1',
            oldValues: complexOldValues,
            newValues: complexNewValues,
            reason: undefined,
            transactionId: undefined,
          },
        });
        expect(result.oldValues).toEqual(complexOldValues);
        expect(result.newValues).toEqual(complexNewValues);
      });

      it('should validate UUID format for adminUserId and targetRecordId', async () => {
        // Test with valid UUIDs
        const validUUIDs = [
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          '01234567-89ab-cdef-0123-456789abcdef',
        ];

        for (const uuid of validUUIDs) {
          const createData: CreateAuditRecordDto = {
            adminUserId: uuid,
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: uuid,
          };

          const expectedAudit = {
            ...mockAdminAudit,
            adminUserId: uuid,
            targetRecordId: uuid,
          };

          (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

          // Act & Assert - should not throw
          const result = await service.createAuditRecord(createData);
          expect(result.adminUserId).toBe(uuid);
          expect(result.targetRecordId).toBe(uuid);
        }
      });

      it('should handle null and undefined values correctly', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: undefined,
          newValues: undefined,
          reason: undefined,
          transactionId: undefined,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(mockAdminAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(prismaService.adminAudit.create).toHaveBeenCalledWith({
          data: {
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: 'registration-1',
            oldValues: Prisma.DbNull,
            newValues: Prisma.DbNull,
            reason: undefined,
            transactionId: undefined,
          },
        });
      });
    });
  });

  describe('getAuditTrail', () => {
    describe('5.1.2 - Test getAuditTrail() returns audit records for specific registration', () => {
      it('should return audit trail for specific registration with admin user information', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-1';
        
        const mockAuditRecords = [
          {
            ...mockAdminAudit,
            id: 'audit-1',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            createdAt: new Date('2025-01-01T10:00:00Z'),
            adminUser: mockAdminUser,
          },
          {
            ...mockAdminAudit,
            id: 'audit-2',
            actionType: AdminAuditActionType.WORK_SHIFT_ADD,
            createdAt: new Date('2025-01-01T11:00:00Z'),
            adminUser: mockAdminUser,
          },
          {
            ...mockAdminAudit,
            id: 'audit-3',
            actionType: AdminAuditActionType.REGISTRATION_CANCEL,
            createdAt: new Date('2025-01-01T12:00:00Z'),
            adminUser: mockAdminUser,
          },
        ];

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue(mockAuditRecords);

        // Act
        const result = await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith({
          where: {
            targetRecordType,
            targetRecordId,
          },
          include: {
            adminUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        expect(result).toEqual(mockAuditRecords);
        expect(result).toHaveLength(3);
        expect(result[0].adminUser).toEqual(mockAdminUser);
      });

      it('should return empty array when no audit records exist for target', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'non-existent-registration';

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        const result = await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith({
          where: {
            targetRecordType,
            targetRecordId,
          },
          include: {
            adminUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        expect(result).toEqual([]);
        expect(result).toHaveLength(0);
      });

      it('should handle different target record types correctly', async () => {
        const targetTypes = [
          AdminAuditTargetType.REGISTRATION,
          AdminAuditTargetType.USER,
          AdminAuditTargetType.PAYMENT,
          AdminAuditTargetType.WORK_SHIFT,
          AdminAuditTargetType.CAMPING_OPTION,
        ];

        for (const targetType of targetTypes) {
          // Arrange
          const targetRecordId = `${targetType.toLowerCase()}-1`;
          const mockRecord = {
            ...mockAuditWithUser,
            targetRecordType: targetType,
            targetRecordId,
          };

          (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue([mockRecord]);

          // Act
          const result = await service.getAuditTrail(targetType, targetRecordId);

          // Assert
          expect(result[0].targetRecordType).toBe(targetType);
          expect(result[0].targetRecordId).toBe(targetRecordId);
        }
      });

      it('should return audit records ordered by createdAt descending', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-1';
        
        const mockAuditRecords = [
          {
            ...mockAuditWithUser,
            id: 'audit-3',
            createdAt: new Date('2025-01-01T12:00:00Z'), // Latest
          },
          {
            ...mockAuditWithUser,
            id: 'audit-2',
            createdAt: new Date('2025-01-01T11:00:00Z'), // Middle
          },
          {
            ...mockAuditWithUser,
            id: 'audit-1',
            createdAt: new Date('2025-01-01T10:00:00Z'), // Earliest
          },
        ];

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue(mockAuditRecords);

        // Act
        const result = await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: {
              createdAt: 'desc',
            },
          })
        );
        expect(result[0].createdAt.getTime()).toBeGreaterThan(result[1].createdAt.getTime());
        expect(result[1].createdAt.getTime()).toBeGreaterThan(result[2].createdAt.getTime());
      });

      it('should include admin user information with correct fields', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-1';
        
        const mockRecord = {
          ...mockAuditWithUser,
          adminUser: {
            id: 'admin-user-1',
            email: 'admin@test.com',
            firstName: 'John',
            lastName: 'Admin',
          },
        };

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue([mockRecord]);

        // Act
        const result = await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: {
              adminUser: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        );
        expect(result[0].adminUser).toEqual({
          id: 'admin-user-1',
          email: 'admin@test.com',
          firstName: 'John',
          lastName: 'Admin',
        });
      });

      it('should handle UUID format validation for target record IDs', async () => {
        // Arrange
        const validUUIDs = [
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          '01234567-89ab-cdef-0123-456789abcdef',
        ];

        for (const uuid of validUUIDs) {
          const mockRecord = {
            ...mockAuditWithUser,
            targetRecordId: uuid,
          };

          (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue([mockRecord]);

          // Act
          const result = await service.getAuditTrail(AdminAuditTargetType.REGISTRATION, uuid);

          // Assert
          expect(result[0].targetRecordId).toBe(uuid);
        }
      });

      it('should filter records by both targetRecordType and targetRecordId', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.PAYMENT;
        const targetRecordId = 'payment-123';

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue([]);

        // Act
        await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              targetRecordType: AdminAuditTargetType.PAYMENT,
              targetRecordId: 'payment-123',
            },
          })
        );
      });
    });
  });

  describe('JSON Serialization', () => {
    describe('5.1.3 - Test audit logging handles JSON serialization of old/new values', () => {
      it('should handle nested object serialization correctly', async () => {
        // Arrange
        const nestedOldValues = {
          registration: {
            user: {
              id: 'user-1',
              personalInfo: {
                firstName: 'John',
                lastName: 'Doe',
                address: {
                  street: '123 Main St',
                  city: 'San Francisco',
                  state: 'CA',
                  zipCode: '94102',
                },
              },
            },
            preferences: {
              dietary: ['vegetarian', 'gluten-free'],
              accessibility: {
                mobility: false,
                visual: true,
                hearing: false,
              },
            },
          },
          metadata: {
            submittedAt: '2025-01-01T10:00:00Z',
            source: 'web',
          },
        };

        const nestedNewValues = {
          registration: {
            user: {
              id: 'user-1',
              personalInfo: {
                firstName: 'John',
                lastName: 'Smith', // Changed
                address: {
                  street: '456 Oak Ave', // Changed
                  city: 'San Francisco',
                  state: 'CA',
                  zipCode: '94103', // Changed
                },
              },
            },
            preferences: {
              dietary: ['vegetarian'], // Removed gluten-free
              accessibility: {
                mobility: true, // Changed
                visual: true,
                hearing: false,
              },
            },
          },
          metadata: {
            submittedAt: '2025-01-01T10:00:00Z',
            source: 'admin', // Changed
            modifiedAt: '2025-01-01T15:00:00Z', // Added
          },
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: nestedOldValues,
          newValues: nestedNewValues,
        };

        const expectedAudit = {
          ...mockAdminAudit,
          oldValues: nestedOldValues,
          newValues: nestedNewValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.oldValues).toEqual(nestedOldValues);
        expect(result.newValues).toEqual(nestedNewValues);
        expect(prismaService.adminAudit.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            oldValues: nestedOldValues,
            newValues: nestedNewValues,
          }),
        });
      });

      it('should handle array serialization with complex objects', async () => {
        // Arrange
        const arrayOldValues = {
          campingOptions: [
            {
              id: 'camping-1',
              name: 'RV Camping',
              details: {
                hookups: ['electric', 'water'],
                maxLength: 40,
                pets: true,
              },
              pricing: {
                baseRate: 150,
                extraPerson: 25,
              },
            },
            {
              id: 'camping-2',
              name: 'Tent Camping',
              details: {
                size: 'large',
                fireRing: true,
                pets: false,
              },
              pricing: {
                baseRate: 75,
                extraPerson: 15,
              },
            },
          ],
          workShifts: [
            {
              id: 'shift-1',
              job: {
                id: 'job-1',
                category: 'kitchen',
                title: 'Kitchen Helper',
                requirements: ['food-safe-certified'],
              },
              timeSlot: {
                start: '2025-08-15T08:00:00Z',
                end: '2025-08-15T12:00:00Z',
                duration: 4,
              },
            },
          ],
        };

        const arrayNewValues = {
          campingOptions: [
            {
              id: 'camping-1',
              name: 'RV Camping',
              details: {
                hookups: ['electric', 'water', 'sewer'], // Added sewer
                maxLength: 45, // Changed
                pets: true,
              },
              pricing: {
                baseRate: 175, // Changed
                extraPerson: 30, // Changed
              },
            },
            // Removed tent camping
          ],
          workShifts: [
            {
              id: 'shift-1',
              job: {
                id: 'job-1',
                category: 'kitchen',
                title: 'Kitchen Helper',
                requirements: ['food-safe-certified'],
              },
              timeSlot: {
                start: '2025-08-15T08:00:00Z',
                end: '2025-08-15T12:00:00Z',
                duration: 4,
              },
            },
            {
              id: 'shift-2', // Added new shift
              job: {
                id: 'job-2',
                category: 'maintenance',
                title: 'Grounds Cleanup',
                requirements: [],
              },
              timeSlot: {
                start: '2025-08-15T13:00:00Z',
                end: '2025-08-15T17:00:00Z',
                duration: 4,
              },
            },
          ],
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: arrayOldValues,
          newValues: arrayNewValues,
        };

        const expectedAudit = {
          ...mockAdminAudit,
          oldValues: arrayOldValues,
          newValues: arrayNewValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.oldValues).toEqual(arrayOldValues);
        expect(result.newValues).toEqual(arrayNewValues);
        expect(Array.isArray((result.oldValues as Record<string, unknown>)?.campingOptions)).toBe(true);
        expect(Array.isArray((result.newValues as Record<string, unknown>)?.workShifts)).toBe(true);
      });

      it('should handle special JSON values (null, boolean, number)', async () => {
        // Arrange
        const specialOldValues = {
          isActive: true,
          priority: null,
          score: 85.5,
          tags: [],
          metadata: {},
          count: 0,
          isVerified: false,
        };

        const specialNewValues = {
          isActive: false, // Changed
          priority: 'high', // Changed from null
          score: 92.75, // Changed
          tags: ['urgent', 'review'], // Added items
          metadata: { reviewer: 'admin-1' }, // Added data
          count: 3, // Changed
          isVerified: true, // Changed
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: specialOldValues,
          newValues: specialNewValues,
        };

        const expectedAudit = {
          ...mockAdminAudit,
          oldValues: specialOldValues,
          newValues: specialNewValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.oldValues).toEqual(specialOldValues);
        expect(result.newValues).toEqual(specialNewValues);
        expect(typeof (result.oldValues as Record<string, unknown>)?.isActive).toBe('boolean');
        expect(typeof (result.newValues as Record<string, unknown>)?.score).toBe('number');
        expect((result.oldValues as Record<string, unknown>)?.priority).toBeNull();
      });

      it('should handle large JSON objects without loss of data', async () => {
        // Arrange
        const largeOldValues = {
          registrationData: {
            ...Array.from({ length: 50 }, (_, i) => ({
              [`field${i}`]: {
                value: `value${i}`,
                metadata: {
                  timestamp: `2025-01-01T${(i % 24).toString().padStart(2, '0')}:00:00Z`,
                  source: i % 2 === 0 ? 'user' : 'system',
                  validated: i % 3 === 0,
                },
              },
            })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          },
          history: Array.from({ length: 100 }, (_, i) => ({
            id: `history-${i}`,
            action: `action-${i}`,
            timestamp: `2025-01-01T${(i % 24).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00Z`,
            data: { index: i, processed: i % 2 === 0 },
          })),
        };

        const largeNewValues = {
          ...largeOldValues,
          registrationData: {
            ...largeOldValues.registrationData,
            field0: {
              value: 'updated-value0', // Changed
              metadata: {
                timestamp: '2025-01-01T00:00:00Z',
                source: 'admin', // Changed
                validated: true,
              },
            },
          },
          history: [
            ...largeOldValues.history,
            {
              id: 'history-100',
              action: 'admin-update',
              timestamp: '2025-01-01T15:00:00Z',
              data: { index: 100, processed: true },
            },
          ],
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: largeOldValues,
          newValues: largeNewValues,
        };

        const expectedAudit = {
          ...mockAdminAudit,
          oldValues: largeOldValues,
          newValues: largeNewValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.oldValues).toEqual(largeOldValues);
        expect(result.newValues).toEqual(largeNewValues);
        expect((result.oldValues as Record<string, unknown>)?.history).toHaveLength(100);
        expect((result.newValues as Record<string, unknown>)?.history).toHaveLength(101);
        expect(Object.keys((result.oldValues as Record<string, unknown>)?.registrationData || {})).toHaveLength(50);
      });

      it('should handle circular reference protection via JSON serialization', async () => {
        // Arrange - Create objects that would cause circular references if not handled properly
        const baseObject = {
          id: 'obj-1',
          name: 'Test Object',
          data: {
            values: [1, 2, 3],
            nested: {
              level: 2,
              info: 'deep data',
            },
          },
        };

        // Simulate what happens when Prisma handles the data - it should be serializable
        const oldValues = JSON.parse(JSON.stringify(baseObject));
        const newValues = JSON.parse(JSON.stringify({
          ...baseObject,
          name: 'Updated Test Object',
          data: {
            ...baseObject.data,
            values: [1, 2, 3, 4], // Added value
            nested: {
              ...baseObject.data.nested,
              level: 3, // Changed
            },
          },
        }));

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues,
          newValues,
        };

        const expectedAudit = {
          ...mockAdminAudit,
          oldValues,
          newValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.oldValues).toEqual(oldValues);
        expect(result.newValues).toEqual(newValues);
        expect(() => JSON.stringify(result.oldValues)).not.toThrow();
        expect(() => JSON.stringify(result.newValues)).not.toThrow();
      });

      it('should preserve data types through JSON serialization round-trip', async () => {
        // Arrange
        const typedOldValues = {
          stringValue: 'test string',
          numberValue: 42,
          floatValue: 3.14159,
          booleanTrue: true,
          booleanFalse: false,
          nullValue: null,
          arrayValue: [1, 'two', true, null],
          objectValue: {
            nested: 'value',
            count: 5,
          },
          dateString: '2025-01-01T00:00:00Z',
          emptyString: '',
          zeroNumber: 0,
        };

        const typedNewValues = {
          ...typedOldValues,
          stringValue: 'updated string',
          numberValue: 100,
          floatValue: 2.71828,
          booleanTrue: false,
          arrayValue: [1, 'two', true, null, 'added'],
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: typedOldValues,
          newValues: typedNewValues,
        };

        const expectedAudit = {
          ...mockAdminAudit,
          oldValues: typedOldValues,
          newValues: typedNewValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.oldValues).toEqual(typedOldValues);
        expect(result.newValues).toEqual(typedNewValues);

        // Verify specific type preservation
        const oldVals = result.oldValues as Record<string, unknown>;
        const newVals = result.newValues as Record<string, unknown>;
        
        expect(typeof oldVals.stringValue).toBe('string');
        expect(typeof oldVals.numberValue).toBe('number');
        expect(typeof oldVals.floatValue).toBe('number');
        expect(typeof oldVals.booleanTrue).toBe('boolean');
        expect(oldVals.nullValue).toBeNull();
        expect(Array.isArray(oldVals.arrayValue)).toBe(true);
        expect(typeof oldVals.objectValue).toBe('object');
        expect(oldVals.zeroNumber).toBe(0);
        expect(oldVals.emptyString).toBe('');

        expect(typeof newVals.stringValue).toBe('string');
        expect(newVals.numberValue).toBe(100);
        expect(newVals.floatValue).toBe(2.71828);
        expect(newVals.booleanTrue).toBe(false);
        expect(newVals.arrayValue).toHaveLength(5);
      });
    });
  });

  describe('Action and Target Type Combinations', () => {
    describe('5.1.4 - Test audit record creation with different action types and target types', () => {
      it('should handle all valid action type and target type combinations', async () => {
        // Define all valid combinations based on business logic
        const validCombinations = [
          // Registration actions
          { actionType: AdminAuditActionType.REGISTRATION_EDIT, targetType: AdminAuditTargetType.REGISTRATION },
          { actionType: AdminAuditActionType.REGISTRATION_CANCEL, targetType: AdminAuditTargetType.REGISTRATION },

          // Payment actions
          { actionType: AdminAuditActionType.PAYMENT_REFUND, targetType: AdminAuditTargetType.PAYMENT },

          // Work shift actions
          { actionType: AdminAuditActionType.WORK_SHIFT_ADD, targetType: AdminAuditTargetType.WORK_SHIFT },
          { actionType: AdminAuditActionType.WORK_SHIFT_REMOVE, targetType: AdminAuditTargetType.WORK_SHIFT },
          { actionType: AdminAuditActionType.WORK_SHIFT_MODIFY, targetType: AdminAuditTargetType.WORK_SHIFT },

          // Camping option actions
          { actionType: AdminAuditActionType.CAMPING_OPTION_ADD, targetType: AdminAuditTargetType.CAMPING_OPTION },
          { actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE, targetType: AdminAuditTargetType.CAMPING_OPTION },
          { actionType: AdminAuditActionType.CAMPING_OPTION_MODIFY, targetType: AdminAuditTargetType.CAMPING_OPTION },

          // Cross-entity actions (some actions can apply to different target types)
          { actionType: AdminAuditActionType.REGISTRATION_EDIT, targetType: AdminAuditTargetType.USER },
          { actionType: AdminAuditActionType.WORK_SHIFT_ADD, targetType: AdminAuditTargetType.REGISTRATION },
          { actionType: AdminAuditActionType.CAMPING_OPTION_ADD, targetType: AdminAuditTargetType.REGISTRATION },
        ];

        for (const { actionType, targetType } of validCombinations) {
          // Arrange
          const createData: CreateAuditRecordDto = {
            adminUserId: 'admin-user-1',
            actionType,
            targetRecordType: targetType,
            targetRecordId: `${targetType.toLowerCase()}-123`,
            reason: `Testing ${actionType} on ${targetType}`,
          };

          const expectedAudit = {
            ...mockAdminAudit,
            actionType,
            targetRecordType: targetType,
            targetRecordId: `${targetType.toLowerCase()}-123`,
            reason: `Testing ${actionType} on ${targetType}`,
          };

          (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

          // Act
          const result = await service.createAuditRecord(createData);

          // Assert
          expect(result.actionType).toBe(actionType);
          expect(result.targetRecordType).toBe(targetType);
          expect(result.targetRecordId).toBe(`${targetType.toLowerCase()}-123`);
          expect(result.reason).toBe(`Testing ${actionType} on ${targetType}`);
        }
      });

      it('should create registration edit audit records with appropriate data structures', async () => {
        // Arrange
        const oldRegistrationValues = {
          status: 'PENDING',
          totalAmount: 450,
          campingOptions: [
            { id: 'camping-1', name: 'RV Site' },
          ],
          workShifts: [
            { id: 'shift-1', jobTitle: 'Kitchen Helper' },
          ],
        };

        const newRegistrationValues = {
          status: 'CONFIRMED',
          totalAmount: 525,
          campingOptions: [
            { id: 'camping-1', name: 'RV Site' },
            { id: 'camping-2', name: 'Tent Site' },
          ],
          workShifts: [
            { id: 'shift-1', jobTitle: 'Kitchen Helper' },
            { id: 'shift-2', jobTitle: 'Cleanup Crew' },
          ],
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-123',
          oldValues: oldRegistrationValues,
          newValues: newRegistrationValues,
          reason: 'Updated camping options and work shifts',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-123',
          oldValues: oldRegistrationValues,
          newValues: newRegistrationValues,
          reason: 'Updated camping options and work shifts',
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.actionType).toBe(AdminAuditActionType.REGISTRATION_EDIT);
        expect(result.targetRecordType).toBe(AdminAuditTargetType.REGISTRATION);
        expect(result.oldValues).toEqual(oldRegistrationValues);
        expect(result.newValues).toEqual(newRegistrationValues);
      });

      it('should create payment refund audit records with payment-specific data', async () => {
        // Arrange
        const paymentOldValues = {
          status: 'COMPLETED',
          amount: 450.00,
          provider: 'STRIPE',
          stripePaymentIntentId: 'pi_1234567890',
          processedAt: '2025-01-01T10:00:00Z',
        };

        const paymentNewValues = {
          status: 'REFUNDED',
          amount: 450.00,
          provider: 'STRIPE',
          stripePaymentIntentId: 'pi_1234567890',
          processedAt: '2025-01-01T10:00:00Z',
          refundedAt: '2025-01-01T15:00:00Z',
          refundAmount: 450.00,
          refundReason: 'Registration cancelled by admin',
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.PAYMENT_REFUND,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: 'payment-123',
          oldValues: paymentOldValues,
          newValues: paymentNewValues,
          reason: 'Registration cancelled - full refund issued',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.PAYMENT_REFUND,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: 'payment-123',
          oldValues: paymentOldValues,
          newValues: paymentNewValues,
          reason: 'Registration cancelled - full refund issued',
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.actionType).toBe(AdminAuditActionType.PAYMENT_REFUND);
        expect(result.targetRecordType).toBe(AdminAuditTargetType.PAYMENT);
        expect(result.oldValues).toEqual(paymentOldValues);
        expect(result.newValues).toEqual(paymentNewValues);
      });

      it('should create work shift audit records with shift-specific data', async () => {
        // Arrange
        const workShiftValues = {
          id: 'shift-456',
          jobId: 'job-123',
          jobTitle: 'Kitchen Helper',
          jobCategory: 'kitchen',
          startTime: '2025-08-15T08:00:00Z',
          endTime: '2025-08-15T12:00:00Z',
          duration: 4,
          requirements: ['food-safe-certified'],
          registrationId: 'registration-123',
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.WORK_SHIFT_ADD,
          targetRecordType: AdminAuditTargetType.WORK_SHIFT,
          targetRecordId: 'shift-456',
          oldValues: undefined,
          newValues: workShiftValues,
          reason: 'Added kitchen shift to registration',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.WORK_SHIFT_ADD,
          targetRecordType: AdminAuditTargetType.WORK_SHIFT,
          targetRecordId: 'shift-456',
          oldValues: undefined,
          newValues: workShiftValues,
          reason: 'Added kitchen shift to registration',
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.actionType).toBe(AdminAuditActionType.WORK_SHIFT_ADD);
        expect(result.targetRecordType).toBe(AdminAuditTargetType.WORK_SHIFT);
        expect(result.oldValues).toBeUndefined();
        expect(result.newValues).toEqual(workShiftValues);
      });

      it('should create camping option audit records with camping-specific data', async () => {
        // Arrange
        const campingOldValues = {
          id: 'camping-789',
          name: 'Standard RV Site',
          description: 'Basic RV hookups',
          maxOccupancy: 4,
          pricePerNight: 45,
          amenities: ['electric', 'water'],
          registrationId: 'registration-123',
        };

        const campingNewValues = {
          id: 'camping-789',
          name: 'Premium RV Site',
          description: 'Full RV hookups with premium amenities',
          maxOccupancy: 6,
          pricePerNight: 65,
          amenities: ['electric', 'water', 'sewer', 'cable'],
          registrationId: 'registration-123',
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.CAMPING_OPTION_MODIFY,
          targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
          targetRecordId: 'camping-789',
          oldValues: campingOldValues,
          newValues: campingNewValues,
          reason: 'Upgraded to premium site',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.CAMPING_OPTION_MODIFY,
          targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
          targetRecordId: 'camping-789',
          oldValues: campingOldValues,
          newValues: campingNewValues,
          reason: 'Upgraded to premium site',
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.actionType).toBe(AdminAuditActionType.CAMPING_OPTION_MODIFY);
        expect(result.targetRecordType).toBe(AdminAuditTargetType.CAMPING_OPTION);
        expect(result.oldValues).toEqual(campingOldValues);
        expect(result.newValues).toEqual(campingNewValues);
      });

      it('should create user-related audit records when admin modifies user data', async () => {
        // Arrange
        const userOldValues = {
          id: 'user-123',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'PARTICIPANT',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '555-0123',
          },
        };

        const userNewValues = {
          id: 'user-123',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'STAFF',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '555-0456',
          },
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.USER,
          targetRecordId: 'user-123',
          oldValues: userOldValues,
          newValues: userNewValues,
          reason: 'Updated email and promoted to staff role',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.USER,
          targetRecordId: 'user-123',
          oldValues: userOldValues,
          newValues: userNewValues,
          reason: 'Updated email and promoted to staff role',
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.actionType).toBe(AdminAuditActionType.REGISTRATION_EDIT);
        expect(result.targetRecordType).toBe(AdminAuditTargetType.USER);
        expect(result.oldValues).toEqual(userOldValues);
        expect(result.newValues).toEqual(userNewValues);
      });

      it('should handle removal actions with appropriate old values and null new values', async () => {
        // Test removing work shift
        const removedShiftValues = {
          id: 'shift-to-remove',
          jobTitle: 'Cleanup Crew',
          startTime: '2025-08-15T18:00:00Z',
          endTime: '2025-08-15T20:00:00Z',
          registrationId: 'registration-123',
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
          targetRecordType: AdminAuditTargetType.WORK_SHIFT,
          targetRecordId: 'shift-to-remove',
          oldValues: removedShiftValues,
          newValues: undefined,
          reason: 'Shift no longer needed',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.WORK_SHIFT_REMOVE,
          targetRecordType: AdminAuditTargetType.WORK_SHIFT,
          targetRecordId: 'shift-to-remove',
          oldValues: removedShiftValues,
          newValues: undefined,
          reason: 'Shift no longer needed',
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert
        expect(result.actionType).toBe(AdminAuditActionType.WORK_SHIFT_REMOVE);
        expect(result.targetRecordType).toBe(AdminAuditTargetType.WORK_SHIFT);
        expect(result.oldValues).toEqual(removedShiftValues);
        expect(result.newValues).toBeUndefined();
      });

      it('should validate that action types align with expected target types', async () => {
        // This test ensures business logic consistency
        const actionTargetMappings = [
          {
            action: AdminAuditActionType.REGISTRATION_EDIT,
            validTargets: [AdminAuditTargetType.REGISTRATION, AdminAuditTargetType.USER],
          },
          {
            action: AdminAuditActionType.REGISTRATION_CANCEL,
            validTargets: [AdminAuditTargetType.REGISTRATION],
          },
          {
            action: AdminAuditActionType.PAYMENT_REFUND,
            validTargets: [AdminAuditTargetType.PAYMENT],
          },
          {
            action: AdminAuditActionType.WORK_SHIFT_ADD,
            validTargets: [AdminAuditTargetType.WORK_SHIFT, AdminAuditTargetType.REGISTRATION],
          },
          {
            action: AdminAuditActionType.WORK_SHIFT_REMOVE,
            validTargets: [AdminAuditTargetType.WORK_SHIFT, AdminAuditTargetType.REGISTRATION],
          },
          {
            action: AdminAuditActionType.WORK_SHIFT_MODIFY,
            validTargets: [AdminAuditTargetType.WORK_SHIFT],
          },
          {
            action: AdminAuditActionType.CAMPING_OPTION_ADD,
            validTargets: [AdminAuditTargetType.CAMPING_OPTION, AdminAuditTargetType.REGISTRATION],
          },
          {
            action: AdminAuditActionType.CAMPING_OPTION_REMOVE,
            validTargets: [AdminAuditTargetType.CAMPING_OPTION, AdminAuditTargetType.REGISTRATION],
          },
          {
            action: AdminAuditActionType.CAMPING_OPTION_MODIFY,
            validTargets: [AdminAuditTargetType.CAMPING_OPTION],
          },
        ];

        for (const { action, validTargets } of actionTargetMappings) {
          for (const target of validTargets) {
            // Arrange
            const createData: CreateAuditRecordDto = {
              adminUserId: 'admin-user-1',
              actionType: action,
              targetRecordType: target,
              targetRecordId: `${target.toLowerCase()}-test`,
              reason: `Testing valid combination: ${action} -> ${target}`,
            };

            const expectedAudit = {
              ...mockAdminAudit,
              actionType: action,
              targetRecordType: target,
              targetRecordId: `${target.toLowerCase()}-test`,
              reason: `Testing valid combination: ${action} -> ${target}`,
            };

            (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

            // Act & Assert - should not throw
            const result = await service.createAuditRecord(createData);
            expect(result.actionType).toBe(action);
            expect(result.targetRecordType).toBe(target);
          }
        }
      });
    });
  });

  describe('Error Handling', () => {
    describe('5.1.5 - Test error handling for database failures during audit logging', () => {
      it('should handle database connection errors during audit record creation', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: { status: 'PENDING' },
          newValues: { status: 'CONFIRMED' },
          reason: 'Test audit record',
        };

        const dbError = new Error('Database connection failed');
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('Database connection failed');
        expect(prismaService.adminAudit.create).toHaveBeenCalledTimes(1);
      });

      it('should handle database timeout errors during audit record creation', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.PAYMENT_REFUND,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: 'payment-1',
          reason: 'Refund processed',
        };

        const timeoutError = new Error('Query timeout');
        timeoutError.name = 'QueryTimeoutError';
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('Query timeout');
        expect(prismaService.adminAudit.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.PAYMENT_REFUND,
            targetRecordType: AdminAuditTargetType.PAYMENT,
            targetRecordId: 'payment-1',
          }),
        });
      });

      it('should handle Prisma constraint violation errors during audit record creation', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'invalid-uuid',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
        };

        const constraintError = new Error('Foreign key constraint failed');
        constraintError.name = 'PrismaClientKnownRequestError';
        (constraintError as Error & { code: string }).code = 'P2003';
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(constraintError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('Foreign key constraint failed');
      });

      it('should handle JSON serialization errors during audit record creation', async () => {
        // Arrange - Create object that might cause serialization issues
        const problematicOldValues = {
          data: 'valid data',
          circular: undefined, // This will be fine, but we'll simulate a serialization error
        };

        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: problematicOldValues,
          newValues: { status: 'updated' },
        };

        const serializationError = new Error('JSON serialization failed');
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(serializationError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('JSON serialization failed');
      });

      it('should handle database errors during audit trail retrieval', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-1';
        
        const dbError = new Error('Database connection lost');
        (prismaService.adminAudit.findMany as jest.Mock).mockRejectedValue(dbError);

        // Act & Assert
        await expect(service.getAuditTrail(targetRecordType, targetRecordId)).rejects.toThrow('Database connection lost');
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith({
          where: {
            targetRecordType,
            targetRecordId,
          },
          include: {
            adminUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      });

      it('should handle memory errors with large audit trail queries', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-with-many-audits';
        
        const memoryError = new Error('Query result too large');
        memoryError.name = 'MemoryError';
        (prismaService.adminAudit.findMany as jest.Mock).mockRejectedValue(memoryError);

        // Act & Assert
        await expect(service.getAuditTrail(targetRecordType, targetRecordId)).rejects.toThrow('Query result too large');
      });

      it('should handle concurrent access errors during audit record creation', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.WORK_SHIFT_ADD,
          targetRecordType: AdminAuditTargetType.WORK_SHIFT,
          targetRecordId: 'shift-1',
          transactionId: 'transaction-123',
        };

        const concurrencyError = new Error('Transaction conflict detected');
        concurrencyError.name = 'PrismaClientKnownRequestError';
        (concurrencyError as Error & { code: string }).code = 'P2034';
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(concurrencyError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('Transaction conflict detected');
        expect(prismaService.adminAudit.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            transactionId: 'transaction-123',
          }),
        });
      });

      it('should handle network connectivity issues during database operations', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.CAMPING_OPTION_REMOVE,
          targetRecordType: AdminAuditTargetType.CAMPING_OPTION,
          targetRecordId: 'camping-1',
        };

        const networkError = new Error('Network unreachable');
        networkError.name = 'NetworkError';
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(networkError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('Network unreachable');
      });

      it('should handle disk space errors during audit record creation', async () => {
        // Arrange
        const largeAuditData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
          oldValues: {
            // Simulate large data that might cause disk space issues
            largeData: Array.from({ length: 1000 }, (_, i) => ({
              field: `value${i}`,
              data: `large data string ${i}`.repeat(100),
            })),
          },
          newValues: {
            largeData: Array.from({ length: 1000 }, (_, i) => ({
              field: `updated_value${i}`,
              data: `updated large data string ${i}`.repeat(100),
            })),
          },
        };

        const diskSpaceError = new Error('Insufficient disk space');
        diskSpaceError.name = 'DiskSpaceError';
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(diskSpaceError);

        // Act & Assert
        await expect(service.createAuditRecord(largeAuditData)).rejects.toThrow('Insufficient disk space');
      });

      it('should handle missing admin user reference errors', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-1';
        
        const referenceError = new Error('Admin user not found');
        referenceError.name = 'NotFoundError';
        (prismaService.adminAudit.findMany as jest.Mock).mockRejectedValue(referenceError);

        // Act & Assert
        await expect(service.getAuditTrail(targetRecordType, targetRecordId)).rejects.toThrow('Admin user not found');
      });

      it('should handle database schema migration errors during operations', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_CANCEL,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
        };

        const migrationError = new Error('Table does not exist');
        migrationError.name = 'PrismaClientInitializationError';
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(migrationError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('Table does not exist');
      });

      it('should handle unexpected errors gracefully', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-1',
        };

        const unexpectedError = new Error('Unexpected system error');
        (prismaService.adminAudit.create as jest.Mock).mockRejectedValue(unexpectedError);

        // Act & Assert
        await expect(service.createAuditRecord(createData)).rejects.toThrow('Unexpected system error');
        expect(prismaService.adminAudit.create).toHaveBeenCalledTimes(1);
      });

      it('should handle null/undefined parameters gracefully', async () => {
        // Arrange - Mock Prisma to reject when called with invalid parameters
        const parameterError = new Error('Invalid parameters provided');
        (prismaService.adminAudit.findMany as jest.Mock).mockRejectedValue(parameterError);

        // Test with null targetRecordType
        await expect(
          service.getAuditTrail(null as unknown as AdminAuditTargetType, 'registration-1')
        ).rejects.toThrow('Invalid parameters provided');

        // Reset and test with undefined targetRecordId
        (prismaService.adminAudit.findMany as jest.Mock).mockRejectedValue(parameterError);
        await expect(
          service.getAuditTrail(AdminAuditTargetType.REGISTRATION, undefined as unknown as string)
        ).rejects.toThrow('Invalid parameters provided');
      });
    });
  });

  describe('PII Protection and Admin User Joins', () => {
    describe('5.1.6 - Test audit records use IDs for target records to avoid PII, but include admin user information via joins', () => {
      it('should store only IDs for target records to avoid PII exposure', async () => {
        // Arrange - Create audit data that only stores IDs, not sensitive user data
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-123', // Only ID, no PII
          oldValues: {
            // Audit should store IDs for references, not actual PII
            userId: 'user-456', // ID only
            campingOptionId: 'camping-789', // ID only
            workShiftIds: ['shift-1', 'shift-2'], // IDs only
            status: 'PENDING',
            totalAmount: 450,
            // No email, firstName, lastName, phone, etc.
          },
          newValues: {
            userId: 'user-456', // Same user ID
            campingOptionId: 'camping-999', // Different camping option ID
            workShiftIds: ['shift-1', 'shift-3'], // Different work shift IDs
            status: 'CONFIRMED',
            totalAmount: 525,
          },
          reason: 'Updated camping and work shift assignments',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          targetRecordId: 'registration-123',
          oldValues: createData.oldValues,
          newValues: createData.newValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert - Verify only IDs are stored, no PII
        expect(result.targetRecordId).toBe('registration-123');
        const oldVals = result.oldValues as Record<string, unknown>;
        const newVals = result.newValues as Record<string, unknown>;

        // Verify that only IDs are stored for user references
        expect(oldVals.userId).toBe('user-456');
        expect(newVals.userId).toBe('user-456');
        expect(oldVals.campingOptionId).toBe('camping-789');
        expect(newVals.campingOptionId).toBe('camping-999');
        expect(oldVals.workShiftIds).toEqual(['shift-1', 'shift-2']);
        expect(newVals.workShiftIds).toEqual(['shift-1', 'shift-3']);

        // Verify no PII is stored in the audit values
        expect(oldVals.firstName).toBeUndefined();
        expect(oldVals.lastName).toBeUndefined();
        expect(oldVals.email).toBeUndefined();
        expect(oldVals.phone).toBeUndefined();
        expect(newVals.firstName).toBeUndefined();
        expect(newVals.lastName).toBeUndefined();
        expect(newVals.email).toBeUndefined();
        expect(newVals.phone).toBeUndefined();
      });

      it('should include admin user information via joins for audit context', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-123';

        const adminUserDetails = {
          id: 'admin-user-1',
          email: 'admin@playa-plan.com',
          firstName: 'Jane',
          lastName: 'Admin',
        };

        const mockAuditRecords = [
          {
            id: 'audit-1',
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.REGISTRATION,
            targetRecordId: 'registration-123',
            oldValues: { userId: 'user-456', status: 'PENDING' },
            newValues: { userId: 'user-456', status: 'CONFIRMED' },
            reason: 'Status update',
            transactionId: null,
            createdAt: new Date('2025-01-01T10:00:00Z'),
            adminUser: adminUserDetails, // Admin user info included via join
          },
        ];

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue(mockAuditRecords);

        // Act
        const result = await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert - Verify admin user information is included via join
        expect(result).toHaveLength(1);
        expect(result[0].adminUser).toEqual(adminUserDetails);
        expect(result[0].adminUser.id).toBe('admin-user-1');
        expect(result[0].adminUser.email).toBe('admin@playa-plan.com');
        expect(result[0].adminUser.firstName).toBe('Jane');
        expect(result[0].adminUser.lastName).toBe('Admin');

        // Verify the join query was called correctly
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith({
          where: {
            targetRecordType,
            targetRecordId,
          },
          include: {
            adminUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
      });

      it('should demonstrate PII protection by not storing sensitive user data directly', async () => {
        // Arrange - Simulate what should NOT be stored in audit records
        const sensitiveUserData = {
          email: 'user@sensitive.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '555-0123',
          address: '123 Private St',
          socialSecurityNumber: '***-**-****',
          creditCardNumber: '****-****-****-1234',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '555-0456',
            relationship: 'spouse',
          },
        };

        // Create audit that only stores IDs and non-PII data
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.USER,
          targetRecordId: 'user-123', // Only the user ID
          oldValues: {
            // Store only IDs and business data, never direct PII
            id: 'user-123',
            role: 'PARTICIPANT',
            registrationCount: 1,
            lastLoginAt: '2025-01-01T08:00:00Z',
            isActive: true,
          },
          newValues: {
            id: 'user-123',
            role: 'STAFF', // Role change
            registrationCount: 1,
            lastLoginAt: '2025-01-01T15:00:00Z',
            isActive: true,
          },
          reason: 'User promoted to staff role',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.REGISTRATION_EDIT,
          targetRecordType: AdminAuditTargetType.USER,
          targetRecordId: 'user-123',
          oldValues: createData.oldValues,
          newValues: createData.newValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert - Verify that sensitive data is NOT in the audit record
        const oldVals = result.oldValues as Record<string, unknown>;
        const newVals = result.newValues as Record<string, unknown>;

        // Verify only user ID is stored, not sensitive details
        expect(result.targetRecordId).toBe('user-123');
        expect(oldVals.id).toBe('user-123');
        expect(newVals.id).toBe('user-123');

        // Verify no PII is stored
        Object.keys(sensitiveUserData).forEach(sensitiveField => {
          expect(oldVals[sensitiveField]).toBeUndefined();
          expect(newVals[sensitiveField]).toBeUndefined();
        });

        // Verify only business-relevant data is stored
        expect(oldVals.role).toBe('PARTICIPANT');
        expect(newVals.role).toBe('STAFF');
        expect(oldVals.isActive).toBe(true);
        expect(newVals.isActive).toBe(true);
      });

      it('should store payment references by ID without exposing payment details', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.PAYMENT_REFUND,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: 'payment-456', // Only payment ID
          oldValues: {
            // Store payment business data, not sensitive payment details
            id: 'payment-456',
            registrationId: 'registration-123',
            amount: 450.00,
            provider: 'STRIPE',
            status: 'COMPLETED',
            processedAt: '2025-01-01T10:00:00Z',
            // NO credit card numbers, bank details, etc.
          },
          newValues: {
            id: 'payment-456',
            registrationId: 'registration-123',
            amount: 450.00,
            provider: 'STRIPE',
            status: 'REFUNDED',
            processedAt: '2025-01-01T10:00:00Z',
            refundedAt: '2025-01-01T15:00:00Z',
            refundAmount: 450.00,
          },
          reason: 'Registration cancelled - full refund',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.PAYMENT_REFUND,
          targetRecordType: AdminAuditTargetType.PAYMENT,
          targetRecordId: 'payment-456',
          oldValues: createData.oldValues,
          newValues: createData.newValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert - Verify payment details are stored safely
        const oldVals = result.oldValues as Record<string, unknown>;
        const newVals = result.newValues as Record<string, unknown>;

        expect(result.targetRecordId).toBe('payment-456');
        expect(oldVals.status).toBe('COMPLETED');
        expect(newVals.status).toBe('REFUNDED');
        expect(oldVals.provider).toBe('STRIPE');

        // Verify no sensitive payment data is stored
        expect(oldVals.creditCardNumber).toBeUndefined();
        expect(oldVals.bankAccountNumber).toBeUndefined();
        expect(oldVals.paymentMethodDetails).toBeUndefined();
        expect(newVals.creditCardNumber).toBeUndefined();
        expect(newVals.bankAccountNumber).toBeUndefined();
        expect(newVals.paymentMethodDetails).toBeUndefined();
      });

      it('should verify admin user join returns only necessary fields', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.REGISTRATION;
        const targetRecordId = 'registration-123';

        // Mock admin user with full data to verify only selected fields are returned
        const fullAdminUserData = {
          id: 'admin-user-1',
          email: 'admin@playa-plan.com',
          firstName: 'Jane',
          lastName: 'Admin',
          // These fields should NOT be included in the select
          password: 'hashed-password',
          personalInfo: { phone: '555-0123' },
          emergencyContact: { name: 'Emergency' },
          internalNotes: 'Internal admin notes',
        };

        const mockAuditWithSelectiveAdmin = {
          ...mockAdminAudit,
          adminUser: {
            // Only the selected fields should be present
            id: fullAdminUserData.id,
            email: fullAdminUserData.email,
            firstName: fullAdminUserData.firstName,
            lastName: fullAdminUserData.lastName,
            // password, personalInfo, emergencyContact, internalNotes should NOT be included
          },
        };

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue([mockAuditWithSelectiveAdmin]);

        // Act
        const result = await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert - Verify only necessary admin fields are included
        expect(result).toHaveLength(1);
        const adminUser = result[0].adminUser;

        // Verify required fields are present
        expect(adminUser.id).toBe('admin-user-1');
        expect(adminUser.email).toBe('admin@playa-plan.com');
        expect(adminUser.firstName).toBe('Jane');
        expect(adminUser.lastName).toBe('Admin');

        // Verify sensitive admin fields are NOT included
        expect((adminUser as Record<string, unknown>).password).toBeUndefined();
        expect((adminUser as Record<string, unknown>).personalInfo).toBeUndefined();
        expect((adminUser as Record<string, unknown>).emergencyContact).toBeUndefined();
        expect((adminUser as Record<string, unknown>).internalNotes).toBeUndefined();

        // Verify the correct select clause was used
        expect(prismaService.adminAudit.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: {
              adminUser: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  // password: NOT included
                  // personalInfo: NOT included
                  // emergencyContact: NOT included
                  // internalNotes: NOT included
                },
              },
            },
          })
        );
      });

      it('should demonstrate proper ID-based referencing for work shifts and camping options', async () => {
        // Arrange
        const createData: CreateAuditRecordDto = {
          adminUserId: 'admin-user-1',
          actionType: AdminAuditActionType.WORK_SHIFT_ADD,
          targetRecordType: AdminAuditTargetType.REGISTRATION,
          targetRecordId: 'registration-123',
          oldValues: {
            workShiftIds: ['shift-1', 'shift-2'],
            campingOptionIds: ['camping-1'],
            totalWorkHours: 8,
            totalCampingCost: 200,
          },
          newValues: {
            workShiftIds: ['shift-1', 'shift-2', 'shift-3'], // Added shift-3
            campingOptionIds: ['camping-1', 'camping-2'], // Added camping-2
            totalWorkHours: 12,
            totalCampingCost: 350,
          },
          reason: 'Added additional work shift and camping option',
        };

        const expectedAudit = {
          ...mockAdminAudit,
          actionType: AdminAuditActionType.WORK_SHIFT_ADD,
          oldValues: createData.oldValues,
          newValues: createData.newValues,
        };

        (prismaService.adminAudit.create as jest.Mock).mockResolvedValue(expectedAudit);

        // Act
        const result = await service.createAuditRecord(createData);

        // Assert - Verify ID-based references are used
        const oldVals = result.oldValues as Record<string, unknown>;
        const newVals = result.newValues as Record<string, unknown>;

        // Verify work shift references use IDs only
        expect(oldVals.workShiftIds).toEqual(['shift-1', 'shift-2']);
        expect(newVals.workShiftIds).toEqual(['shift-1', 'shift-2', 'shift-3']);

        // Verify camping option references use IDs only
        expect(oldVals.campingOptionIds).toEqual(['camping-1']);
        expect(newVals.campingOptionIds).toEqual(['camping-1', 'camping-2']);

        // Verify no detailed shift/camping data is stored
        expect(oldVals.workShiftDetails).toBeUndefined();
        expect(oldVals.campingOptionDetails).toBeUndefined();
        expect(newVals.workShiftDetails).toBeUndefined();
        expect(newVals.campingOptionDetails).toBeUndefined();

        // Only aggregate/summary data should be present
        expect(oldVals.totalWorkHours).toBe(8);
        expect(newVals.totalWorkHours).toBe(12);
        expect(oldVals.totalCampingCost).toBe(200);
        expect(newVals.totalCampingCost).toBe(350);
      });

      it('should ensure audit trail queries maintain PII protection while providing admin context', async () => {
        // Arrange
        const targetRecordType = AdminAuditTargetType.USER;
        const targetRecordId = 'user-456';

        const mockAuditRecords = [
          {
            id: 'audit-1',
            adminUserId: 'admin-user-1',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.USER,
            targetRecordId: 'user-456', // Only user ID, no PII
            oldValues: {
              role: 'PARTICIPANT',
              isActive: true,
              registrationCount: 1,
            },
            newValues: {
              role: 'STAFF',
              isActive: true,
              registrationCount: 1,
            },
            reason: 'Promoted to staff',
            transactionId: null,
            createdAt: new Date('2025-01-01T10:00:00Z'),
            adminUser: {
              id: 'admin-user-1',
              email: 'admin@playa-plan.com',
              firstName: 'Jane',
              lastName: 'Admin',
            },
          },
          {
            id: 'audit-2',
            adminUserId: 'admin-user-2',
            actionType: AdminAuditActionType.REGISTRATION_EDIT,
            targetRecordType: AdminAuditTargetType.USER,
            targetRecordId: 'user-456',
            oldValues: {
              role: 'STAFF',
              isActive: true,
            },
            newValues: {
              role: 'STAFF',
              isActive: false, // Deactivated
            },
            reason: 'Temporary deactivation',
            transactionId: null,
            createdAt: new Date('2025-01-01T14:00:00Z'),
            adminUser: {
              id: 'admin-user-2',
              email: 'other-admin@playa-plan.com',
              firstName: 'Bob',
              lastName: 'Administrator',
            },
          },
        ];

        (prismaService.adminAudit.findMany as jest.Mock).mockResolvedValue(mockAuditRecords);

        // Act
        const result = await service.getAuditTrail(targetRecordType, targetRecordId);

        // Assert - Verify PII protection and admin context
        expect(result).toHaveLength(2);

        // Check first audit record
        expect(result[0].targetRecordId).toBe('user-456'); // Only ID
        expect(result[0].adminUser.email).toBe('admin@playa-plan.com'); // Admin context
        
        const firstOldVals = result[0].oldValues as Record<string, unknown>;
        const firstNewVals = result[0].newValues as Record<string, unknown>;
        
        // Verify no user PII in audit values
        expect(firstOldVals.email).toBeUndefined();
        expect(firstOldVals.firstName).toBeUndefined();
        expect(firstOldVals.lastName).toBeUndefined();
        expect(firstNewVals.email).toBeUndefined();
        expect(firstNewVals.firstName).toBeUndefined();
        expect(firstNewVals.lastName).toBeUndefined();

        // But business data is present
        expect(firstOldVals.role).toBe('PARTICIPANT');
        expect(firstNewVals.role).toBe('STAFF');

        // Check second audit record
        expect(result[1].targetRecordId).toBe('user-456'); // Same user ID
        expect(result[1].adminUser.email).toBe('other-admin@playa-plan.com'); // Different admin

        const secondNewVals = result[1].newValues as Record<string, unknown>;
        expect(secondNewVals.isActive).toBe(false);
      });
    });
  });
}); 
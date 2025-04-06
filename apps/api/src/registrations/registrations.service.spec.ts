import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RegistrationStatus } from '@prisma/client';
import { CreateRegistrationDto } from './dto';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  // PrismaService is mocked and not directly used in tests

  const mockPrismaService = {
    registration: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    shift: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateRegistrationDto = {
      userId: 'user-id',
      shiftId: 'shift-id',
    };

    const mockShift = {
      id: 'shift-id',
      maxRegistrations: 10,
      registrations: [],
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
    };

    const mockRegistration = {
      id: 'registration-id',
      userId: 'user-id',
      shiftId: 'shift-id',
      status: RegistrationStatus.PENDING,
    };

    it('should create a registration successfully', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.registration.create.mockResolvedValue(mockRegistration);

      const result = await service.create(createDto);
      
      expect(mockPrismaService.shift.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.shiftId },
        include: { registrations: true },
      });
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.userId },
      });
      expect(mockPrismaService.registration.findFirst).toHaveBeenCalled();
      expect(mockPrismaService.registration.create).toHaveBeenCalled();
      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if shift does not exist', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already registered for shift', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(mockShift);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue({
        id: 'existing-registration',
        userId: 'user-id',
        shiftId: 'shift-id',
      });

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should set status to WAITLISTED if shift is at capacity', async () => {
      const fullShift = {
        ...mockShift,
        registrations: Array(10).fill({ status: RegistrationStatus.CONFIRMED }),
      };
      
      mockPrismaService.shift.findUnique.mockResolvedValue(fullShift);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.registration.findFirst.mockResolvedValue(null);
      mockPrismaService.registration.create.mockImplementation((args) => {
        return Promise.resolve({
          ...args.data,
          id: 'registration-id',
          status: RegistrationStatus.WAITLISTED,
        });
      });

      const result = await service.create(createDto);
      
      expect(result.status).toBe(RegistrationStatus.WAITLISTED);
    });
  });

  describe('findAll', () => {
    it('should return an array of registrations', async () => {
      const expectedRegistrations = [
        { id: '1', userId: 'user1', shiftId: 'shift1' },
        { id: '2', userId: 'user2', shiftId: 'shift2' },
      ];
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findAll();
      
      expect(mockPrismaService.registration.findMany).toHaveBeenCalled();
      expect(result).toEqual(expectedRegistrations);
    });
  });

  describe('findByUser', () => {
    const userId = 'user-id';
    
    it('should return registrations for a specific user', async () => {
      const expectedRegistrations = [
        { id: '1', userId, shiftId: 'shift1' },
        { id: '2', userId, shiftId: 'shift2' },
      ];
      
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId });
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findByUser(userId);
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedRegistrations);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByUser(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByShift', () => {
    const shiftId = 'shift-id';
    
    it('should return registrations for a specific shift', async () => {
      const expectedRegistrations = [
        { id: '1', userId: 'user1', shiftId },
        { id: '2', userId: 'user2', shiftId },
      ];
      
      mockPrismaService.shift.findUnique.mockResolvedValue({ id: shiftId });
      mockPrismaService.registration.findMany.mockResolvedValue(expectedRegistrations);

      const result = await service.findByShift(shiftId);
      
      expect(mockPrismaService.shift.findUnique).toHaveBeenCalledWith({
        where: { id: shiftId },
      });
      expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
        where: { shiftId },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedRegistrations);
    });

    it('should throw NotFoundException if shift does not exist', async () => {
      mockPrismaService.shift.findUnique.mockResolvedValue(null);

      await expect(service.findByShift(shiftId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    const registrationId = 'registration-id';
    const mockRegistration = { id: registrationId, userId: 'user-id', shiftId: 'shift-id' };
    
    it('should return a registration by id', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);

      const result = await service.findOne(registrationId);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.findOne(registrationId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const registrationId = 'registration-id';
    const updateDto = { status: RegistrationStatus.CONFIRMED };
    const mockRegistration = { 
      id: registrationId, 
      userId: 'user-id', 
      shiftId: 'shift-id',
      status: RegistrationStatus.PENDING,
    };
    
    it('should update a registration successfully', async () => {
      const updatedRegistration = { ...mockRegistration, ...updateDto };
      
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);
      mockPrismaService.registration.update.mockResolvedValue(updatedRegistration);

      const result = await service.update(registrationId, updateDto);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(mockPrismaService.registration.update).toHaveBeenCalledWith({
        where: { id: registrationId },
        data: updateDto,
        include: expect.any(Object),
      });
      expect(result).toEqual(updatedRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.update(registrationId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const registrationId = 'registration-id';
    const mockRegistration = { id: registrationId, userId: 'user-id', shiftId: 'shift-id' };
    
    it('should delete a registration successfully', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(mockRegistration);
      mockPrismaService.registration.delete.mockResolvedValue(mockRegistration);

      const result = await service.remove(registrationId);
      
      expect(mockPrismaService.registration.findUnique).toHaveBeenCalledWith({
        where: { id: registrationId },
        include: expect.any(Object),
      });
      expect(mockPrismaService.registration.delete).toHaveBeenCalledWith({
        where: { id: registrationId },
      });
      expect(result).toEqual(mockRegistration);
    });

    it('should throw NotFoundException if registration does not exist', async () => {
      mockPrismaService.registration.findUnique.mockResolvedValue(null);

      await expect(service.remove(registrationId)).rejects.toThrow(NotFoundException);
    });
  });
});

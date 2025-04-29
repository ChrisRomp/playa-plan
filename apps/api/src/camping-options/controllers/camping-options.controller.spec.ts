import { Test, TestingModule } from '@nestjs/testing';
import { CampingOptionsController } from './camping-options.controller';
import { CampingOptionsService } from '../services/camping-options.service';
import { CreateCampingOptionDto, UpdateCampingOptionDto, CampingOptionResponseDto } from '../dto';
import { CampingOption } from '../entities/camping-option.entity';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('CampingOptionsController', () => {
  let controller: CampingOptionsController;
  let service: CampingOptionsService;

  const mockCampingOption = {
    id: 'test-id',
    name: 'Test Camping Option',
    description: 'Test description',
    enabled: true,
    workShiftsRequired: 1,
    participantDues: 100.00,
    staffDues: 50.00,
    maxSignups: 10,
    campId: 'camp-id',
    jobCategoryIds: ['category-1', 'category-2'],
    createdAt: new Date(),
    updatedAt: new Date(),
    isAvailable: jest.fn().mockReturnValue(true),
  } as unknown as CampingOption;

  const mockCreateCampingOptionDto: CreateCampingOptionDto = {
    name: 'Test Camping Option',
    description: 'Test description',
    enabled: true,
    workShiftsRequired: 1,
    participantDues: 100.00,
    staffDues: 50.00,
    maxSignups: 10,
    campId: 'camp-id',
    jobCategoryIds: ['category-1', 'category-2'],
  };

  const mockUpdateCampingOptionDto: UpdateCampingOptionDto = {
    name: 'Updated Camping Option',
    description: 'Updated description',
    enabled: false,
  };

  const mockResponseDto = {
    id: 'test-id',
    name: 'Test Camping Option',
    description: 'Test description',
    enabled: true,
    workShiftsRequired: 1,
    participantDues: 100.00,
    staffDues: 50.00,
    maxSignups: 10,
    campId: 'camp-id',
    jobCategoryIds: ['category-1', 'category-2'],
    currentRegistrations: 0,
    availabilityStatus: true,
    createdAt: expect.any(Date),
    updatedAt: expect.any(Date),
  };

  const mockCampingOptionsService = {
    create: jest.fn().mockResolvedValue(mockCampingOption),
    findAll: jest.fn().mockResolvedValue([mockCampingOption]),
    findOne: jest.fn().mockResolvedValue(mockCampingOption),
    update: jest.fn().mockResolvedValue(mockCampingOption),
    remove: jest.fn().mockResolvedValue(mockCampingOption),
    getRegistrationCount: jest.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampingOptionsController],
      providers: [
        {
          provide: CampingOptionsService,
          useValue: mockCampingOptionsService,
        },
      ],
    }).compile();

    controller = module.get<CampingOptionsController>(CampingOptionsController);
    service = module.get<CampingOptionsService>(CampingOptionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new camping option', async () => {
      const result = await controller.create(mockCreateCampingOptionDto);
      
      expect(service.create).toHaveBeenCalledWith(mockCreateCampingOptionDto);
      expect(result).toEqual(expect.objectContaining(mockResponseDto));
    });
  });

  describe('findAll', () => {
    it('should return all camping options', async () => {
      const result = await controller.findAll();
      
      expect(service.findAll).toHaveBeenCalledWith(false, undefined);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining(mockResponseDto));
    });

    it('should respect includeDisabled parameter', async () => {
      await controller.findAll(true);
      
      expect(service.findAll).toHaveBeenCalledWith(true, undefined);
    });

    it('should respect campId parameter', async () => {
      await controller.findAll(false, 'camp-id');
      
      expect(service.findAll).toHaveBeenCalledWith(false, 'camp-id');
    });
  });

  describe('findOne', () => {
    it('should return a single camping option', async () => {
      const result = await controller.findOne('test-id');
      
      expect(service.findOne).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(expect.objectContaining(mockResponseDto));
    });

    it('should throw NotFoundException if camping option not found', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException());
      
      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a camping option', async () => {
      const result = await controller.update('test-id', mockUpdateCampingOptionDto);
      
      expect(service.update).toHaveBeenCalledWith('test-id', mockUpdateCampingOptionDto);
      expect(result).toEqual(expect.objectContaining(mockResponseDto));
    });
  });

  describe('remove', () => {
    it('should remove a camping option', async () => {
      const result = await controller.remove('test-id');
      
      expect(service.remove).toHaveBeenCalledWith('test-id');
      expect(result).toEqual(expect.objectContaining({
        ...mockResponseDto,
        availabilityStatus: false
      }));
    });
  });
}); 
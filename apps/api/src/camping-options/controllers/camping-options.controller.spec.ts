import { Test, TestingModule } from '@nestjs/testing';
import { CampingOptionsController } from './camping-options.controller';
import { CampingOptionsService } from '../services/camping-options.service';
import { 
  CreateCampingOptionDto, 
  UpdateCampingOptionDto, 
  CreateCampingOptionFieldDto,
  UpdateCampingOptionFieldDto
} from '../dto';
import { CampingOption } from '../entities/camping-option.entity';
import { NotFoundException } from '@nestjs/common';
import { CampingOptionFieldsService } from '../services/camping-option-fields.service';
import { CampingOptionField } from '../entities/camping-option-field.entity';
import { FieldType } from '../entities/camping-option-field.entity';

describe('CampingOptionsController', () => {
  let controller: CampingOptionsController;
  let service: CampingOptionsService;
  let fieldsService: CampingOptionFieldsService;

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
    const mockCampingOptionFieldsService = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampingOptionsController],
      providers: [
        {
          provide: CampingOptionsService,
          useValue: mockCampingOptionsService,
        },
        {
          provide: CampingOptionFieldsService,
          useValue: mockCampingOptionFieldsService,
        },
      ],
    }).compile();

    controller = module.get<CampingOptionsController>(CampingOptionsController);
    service = module.get<CampingOptionsService>(CampingOptionsService);
    fieldsService = module.get<CampingOptionFieldsService>(CampingOptionFieldsService);
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
      
      expect(service.findAll).toHaveBeenCalledWith(false);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining(mockResponseDto));
    });

    it('should respect includeDisabled parameter', async () => {
      await controller.findAll(true);
      
      expect(service.findAll).toHaveBeenCalledWith(true);
    });

    // Removed test for campId parameter as the entity has been removed
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

  describe('fields', () => {
    it('should get fields for a camping option', async () => {
      const campingOptionId = 'test-id';
      const mockFields = [{ id: 'field-id', displayName: 'Test Field' }] as unknown as CampingOptionField[];
      
      jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: campingOptionId } as unknown as CampingOption);
      jest.spyOn(fieldsService, 'findAll').mockResolvedValueOnce(mockFields);
      
      const result = await controller.getFields(campingOptionId);
      
      expect(service.findOne).toHaveBeenCalledWith(campingOptionId);
      expect(fieldsService.findAll).toHaveBeenCalledWith(campingOptionId);
      expect(result).toEqual(mockFields);
    });
    
    it('should throw NotFoundException when camping option does not exist', async () => {
      const campingOptionId = 'test-id';
      
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException());
      
      await expect(controller.getFields(campingOptionId)).rejects.toThrow(NotFoundException);
      expect(service.findOne).toHaveBeenCalledWith(campingOptionId);
    });
    
    it('should create a field for a camping option', async () => {
      const campingOptionId = 'test-id';
      const createDto: CreateCampingOptionFieldDto = {
        displayName: 'Test Field',
        dataType: FieldType.STRING,
        required: false,
      };
      const expectedDto = { ...createDto, campingOptionId };
      const mockField = { id: 'field-id', ...expectedDto } as unknown as CampingOptionField;
      
      jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: campingOptionId } as unknown as CampingOption);
      jest.spyOn(fieldsService, 'create').mockResolvedValueOnce(mockField);
      
      const result = await controller.createField(campingOptionId, createDto);
      
      expect(service.findOne).toHaveBeenCalledWith(campingOptionId);
      expect(fieldsService.create).toHaveBeenCalledWith(expectedDto);
      expect(result).toEqual(mockField);
    });
    
    it('should update a field for a camping option', async () => {
      const campingOptionId = 'test-id';
      const fieldId = 'field-id';
      const updateDto: UpdateCampingOptionFieldDto = { 
        displayName: 'Updated Field'
      };
      const mockField = { id: fieldId, campingOptionId, ...updateDto } as unknown as CampingOptionField;
      
      jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: campingOptionId } as unknown as CampingOption);
      jest.spyOn(fieldsService, 'findOne').mockResolvedValueOnce({ id: fieldId, campingOptionId } as unknown as CampingOptionField);
      jest.spyOn(fieldsService, 'update').mockResolvedValueOnce(mockField);
      
      const result = await controller.updateField(campingOptionId, fieldId, updateDto);
      
      expect(service.findOne).toHaveBeenCalledWith(campingOptionId);
      expect(fieldsService.findOne).toHaveBeenCalledWith(fieldId);
      expect(fieldsService.update).toHaveBeenCalledWith(fieldId, updateDto);
      expect(result).toEqual(mockField);
    });
    
    it('should delete a field for a camping option', async () => {
      const campingOptionId = 'test-id';
      const fieldId = 'field-id';
      const mockField = { id: fieldId, campingOptionId } as unknown as CampingOptionField;
      
      jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: campingOptionId } as unknown as CampingOption);
      jest.spyOn(fieldsService, 'findOne').mockResolvedValueOnce({ id: fieldId, campingOptionId } as unknown as CampingOptionField);
      jest.spyOn(fieldsService, 'remove').mockResolvedValueOnce(mockField);
      
      const result = await controller.deleteField(campingOptionId, fieldId);
      
      expect(service.findOne).toHaveBeenCalledWith(campingOptionId);
      expect(fieldsService.findOne).toHaveBeenCalledWith(fieldId);
      expect(fieldsService.remove).toHaveBeenCalledWith(fieldId);
      expect(result).toEqual(mockField);
    });

    it('should throw NotFoundException if field does not belong to the camping option (updateField)', async () => {
      const campingOptionId = 'test-id';
      const fieldId = 'field-id';
      const updateDto = { displayName: 'Updated Field' };
      // The field's campingOptionId does not match the requested campingOptionId
      jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: campingOptionId } as unknown as CampingOption);
      jest.spyOn(fieldsService, 'findOne').mockResolvedValueOnce({ id: fieldId, campingOptionId: 'other-option-id' } as unknown as CampingOptionField);
      await expect(controller.updateField(campingOptionId, fieldId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });
}); 
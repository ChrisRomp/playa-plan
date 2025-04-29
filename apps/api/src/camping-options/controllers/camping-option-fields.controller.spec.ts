import { Test, TestingModule } from '@nestjs/testing';
import { CampingOptionFieldsController } from './camping-option-fields.controller';
import { CampingOptionFieldsService } from '../services/camping-option-fields.service';
import { CreateCampingOptionFieldDto, UpdateCampingOptionFieldDto, CampingOptionFieldResponseDto } from '../dto';
import { NotFoundException } from '@nestjs/common';
import { FieldType } from '../entities/camping-option-field.entity';

describe('CampingOptionFieldsController', () => {
  let controller: CampingOptionFieldsController;
  let service: CampingOptionFieldsService;

  const mockCampingOptionField = {
    id: 'field-id',
    displayName: 'Test Field',
    description: 'Test field description',
    dataType: FieldType.STRING,
    required: true,
    maxLength: 255,
    minValue: null,
    maxValue: null,
    campingOptionId: 'camping-option-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateCampingOptionFieldDto: CreateCampingOptionFieldDto = {
    displayName: 'Test Field',
    description: 'Test field description',
    dataType: FieldType.STRING,
    required: true,
    maxLength: 255,
    campingOptionId: 'camping-option-id',
  };

  const mockUpdateCampingOptionFieldDto: UpdateCampingOptionFieldDto = {
    displayName: 'Updated Field',
    description: 'Updated description',
    required: false,
  };

  const mockCampingOptionFieldsService = {
    create: jest.fn().mockResolvedValue(mockCampingOptionField),
    findAll: jest.fn().mockResolvedValue([mockCampingOptionField]),
    findOne: jest.fn().mockResolvedValue(mockCampingOptionField),
    update: jest.fn().mockResolvedValue(mockCampingOptionField),
    remove: jest.fn().mockResolvedValue(mockCampingOptionField),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampingOptionFieldsController],
      providers: [
        {
          provide: CampingOptionFieldsService,
          useValue: mockCampingOptionFieldsService,
        },
      ],
    }).compile();

    controller = module.get<CampingOptionFieldsController>(CampingOptionFieldsController);
    service = module.get<CampingOptionFieldsService>(CampingOptionFieldsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new camping option field', async () => {
      const result = await controller.create(mockCreateCampingOptionFieldDto);

      expect(service.create).toHaveBeenCalledWith(mockCreateCampingOptionFieldDto);
      expect(result).toEqual(mockCampingOptionField);
    });
  });

  describe('findAll', () => {
    it('should return all fields for a camping option', async () => {
      const campingOptionId = 'camping-option-id';
      const result = await controller.findAll(campingOptionId);

      expect(service.findAll).toHaveBeenCalledWith(campingOptionId);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockCampingOptionField);
    });
  });

  describe('findOne', () => {
    it('should return a single camping option field', async () => {
      const result = await controller.findOne('field-id');

      expect(service.findOne).toHaveBeenCalledWith('field-id');
      expect(result).toEqual(mockCampingOptionField);
    });

    it('should throw NotFoundException if field not found', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException());

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a camping option field', async () => {
      const result = await controller.update('field-id', mockUpdateCampingOptionFieldDto);

      expect(service.update).toHaveBeenCalledWith('field-id', mockUpdateCampingOptionFieldDto);
      expect(result).toEqual(mockCampingOptionField);
    });
  });

  describe('remove', () => {
    it('should remove a camping option field', async () => {
      const result = await controller.remove('field-id');

      expect(service.remove).toHaveBeenCalledWith('field-id');
      expect(result).toEqual(mockCampingOptionField);
    });
  });
}); 
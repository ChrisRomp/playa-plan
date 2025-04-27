import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CampingOptionFieldsService } from './camping-option-fields.service';
import { CreateCampingOptionFieldDto, UpdateCampingOptionFieldDto } from '../dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FieldType } from '../entities/camping-option-field.entity';

describe('CampingOptionFieldsService', () => {
  let service: CampingOptionFieldsService;
  let prisma: PrismaService;

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

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampingOptionFieldsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CampingOptionFieldsService>(CampingOptionFieldsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Default mock implementations
    mockPrismaService.$queryRaw.mockImplementation((query, ...params) => {
      // Check for SELECT on camping_options (create method)
      if (query[0].includes('SELECT id FROM "camping_options"')) {
        return [{ id: 'camping-option-id' }];
      }
      
      // Check for INSERT (create method)
      if (query[0].includes('INSERT INTO "camping_option_fields"')) {
        return [mockCampingOptionField];
      }

      // Check for SELECT on camping_option_fields (findAll method)
      if (query[0].includes('SELECT * FROM "camping_option_fields" WHERE "campingOptionId"')) {
        return [mockCampingOptionField];
      }

      // Check for SELECT on camping_option_fields (findOne method)
      if (query[0].includes('SELECT * FROM "camping_option_fields" WHERE id =')) {
        return [mockCampingOptionField];
      }

      // Check for DELETE (remove method)
      if (query[0].includes('DELETE FROM "camping_option_fields"')) {
        return [{ affected: 1 }];
      }

      return [];
    });

    mockPrismaService.$queryRawUnsafe.mockImplementation((query) => {
      // Check for UPDATE (update method)
      if (query.includes('UPDATE "camping_option_fields"')) {
        return [mockCampingOptionField];
      }

      return [];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a camping option field', async () => {
      const result = await service.create(mockCreateCampingOptionFieldDto);

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        displayName: mockCampingOptionField.displayName,
        dataType: mockCampingOptionField.dataType,
      }));
    });

    it('should throw NotFoundException if camping option not found', async () => {
      // Override the default mock to return empty array (camping option not found)
      mockPrismaService.$queryRaw.mockImplementationOnce(() => []);

      await expect(service.create(mockCreateCampingOptionFieldDto))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all fields for a camping option', async () => {
      const campingOptionId = 'camping-option-id';
      const result = await service.findAll(campingOptionId);

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        displayName: mockCampingOptionField.displayName,
      }));
    });
  });

  describe('findOne', () => {
    it('should return a camping option field by id', async () => {
      const result = await service.findOne('field-id');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: mockCampingOptionField.id,
        displayName: mockCampingOptionField.displayName,
      }));
    });

    it('should throw NotFoundException if field not found', async () => {
      // Override the default mock to return empty array (field not found)
      mockPrismaService.$queryRaw.mockImplementationOnce(() => []);

      await expect(service.findOne('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a camping option field', async () => {
      const result = await service.update('field-id', mockUpdateCampingOptionFieldDto);

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: mockCampingOptionField.id,
      }));
    });

    it('should throw NotFoundException if field not found', async () => {
      // Override the findOne method
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException());

      await expect(service.update('non-existent', mockUpdateCampingOptionFieldDto))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a camping option field', async () => {
      const result = await service.remove('field-id');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: mockCampingOptionField.id,
      }));
    });

    it('should throw NotFoundException if field not found', async () => {
      // Override the findOne method
      jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException());

      await expect(service.remove('non-existent'))
        .rejects.toThrow(NotFoundException);
    });
  });
}); 
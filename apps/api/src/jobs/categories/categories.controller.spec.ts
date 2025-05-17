import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: CategoriesService;

  // Sample data with staffOnly field
  const mockCategories = [
    {
      id: '1',
      name: 'Test Category 1',
      description: 'Test Description 1',
      staffOnly: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      alwaysRequired: false,
      location: null,
      jobs: [],
    },
    {
      id: '2',
      name: 'Test Category 2',
      description: 'Test Description 2',
      staffOnly: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      alwaysRequired: false,
      location: null,
      jobs: [],
    },
  ];

  // Mock the categories service
  const mockCategoriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  // Mock guards
  const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
  const mockRolesGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CategoriesController>(CategoriesController);
    service = module.get<CategoriesService>(CategoriesService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a job category with staffOnly field', async () => {
      const createDto = {
        name: 'New Staff Category',
        description: 'New staff-only category',
        staffOnly: true,
      };

      const expectedResult = {
        ...createDto,
        id: '3',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        alwaysRequired: false,
        location: null,
      };

      mockCategoriesService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);
      
      expect(mockCategoriesService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
      expect(result.staffOnly).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return all job categories with staffOnly field', async () => {
      mockCategoriesService.findAll.mockResolvedValue(mockCategories);

      const result = await controller.findAll();
      
      expect(mockCategoriesService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
      expect(result[0].staffOnly).toBe(false);
      expect(result[1].staffOnly).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return a single job category with staffOnly field', async () => {
      mockCategoriesService.findOne.mockResolvedValue(mockCategories[1]);

      const result = await controller.findOne('2');
      
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith('2');
      expect(result).toEqual(mockCategories[1]);
      expect(result.staffOnly).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a job category including the staffOnly field', async () => {
      const updateDto = {
        staffOnly: true,
      };

      const updatedCategory = {
        ...mockCategories[0],
        staffOnly: true,
      };

      mockCategoriesService.update.mockResolvedValue(updatedCategory);

      const result = await controller.update('1', updateDto);
      
      expect(mockCategoriesService.update).toHaveBeenCalledWith('1', updateDto);
      expect(result).toEqual(updatedCategory);
      expect(result.staffOnly).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove a job category', async () => {
      mockCategoriesService.remove.mockResolvedValue(mockCategories[0]);

      const result = await controller.remove('1');
      
      expect(mockCategoriesService.remove).toHaveBeenCalledWith('1');
      expect(result).toEqual(mockCategories[0]);
    });
  });
}); 
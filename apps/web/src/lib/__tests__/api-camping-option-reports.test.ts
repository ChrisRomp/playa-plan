import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define types for better type safety
interface CampingOptionRegistrationWithFields {
  id: string;
  userId: string;
  campingOptionId: string;
  createdAt: string;
  updatedAt: string;
}

interface Registration {
  id: string;
  userId: string;
  year: number;
  status: 'CONFIRMED';
  createdAt: string;
  updatedAt: string;
  jobs: unknown[];
  payments: unknown[];
  campingOptions?: Array<{
    id: string;
    userId: string;
    campingOptionId: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

describe('API Camping Option Reports', () => {
  let mockApi: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    defaults: { headers: { common: Record<string, unknown> } };
    interceptors: {
      request: { use: ReturnType<typeof vi.fn> };
      response: { use: ReturnType<typeof vi.fn> };
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Create fresh mocks for each test
    mockApi = {
      get: vi.fn(),
      post: vi.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    // Mock axios to return our mock API
    vi.doMock('axios', () => ({
      default: {
        create: vi.fn(() => mockApi),
      },
    }));
  });

  afterEach(() => {
    vi.doUnmock('axios');
  });

  describe('reports.getCampingOptionRegistrations', () => {
    it('should fetch camping option registrations with default parameters', async () => {
      // Import here to ensure mocks are set up
      const { reports } = await import('../api');
      
      const mockData = [
        {
          id: 'cor-123',
          userId: 'user-123',
          campingOptionId: 'co-123',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            playaName: 'TestUser',
          },
          campingOption: {
            id: 'co-123',
            name: 'RV Camping',
            description: 'RV camping with hookups',
            enabled: true,
            fields: [],
          },
          fieldValues: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValue({ data: mockData });

      const result = await reports.getCampingOptionRegistrations();

      expect(mockApi.get).toHaveBeenCalledWith('/admin/registrations/camping-options-with-fields');
      expect(result).toEqual(mockData);
    });

    it('should fetch camping option registrations with filters', async () => {
      const { reports } = await import('../api');
      
      const mockData: CampingOptionRegistrationWithFields[] = [];
      mockApi.get.mockResolvedValue({ data: mockData });

      const filters = {
        year: 2024,
        userId: 'user-123',
        campingOptionId: 'co-123',
        includeInactive: true,
      };

      await reports.getCampingOptionRegistrations(filters);

      expect(mockApi.get).toHaveBeenCalledWith(
        '/admin/registrations/camping-options-with-fields?year=2024&userId=user-123&campingOptionId=co-123&includeInactive=true'
      );
    });

    it('should handle partial filters correctly', async () => {
      const { reports } = await import('../api');
      
      const mockData: CampingOptionRegistrationWithFields[] = [];
      mockApi.get.mockResolvedValue({ data: mockData });

      await reports.getCampingOptionRegistrations({ year: 2024 });

      expect(mockApi.get).toHaveBeenCalledWith(
        '/admin/registrations/camping-options-with-fields?year=2024'
      );
    });

    it('should throw error when API call fails', async () => {
      const { reports } = await import('../api');
      
      const error = new Error('API Error');
      mockApi.get.mockRejectedValue(error);

      await expect(reports.getCampingOptionRegistrations()).rejects.toThrow('API Error');
    });
  });

  describe('reports.getRegistrations with camping options', () => {
    it('should include camping options when requested', async () => {
      const { reports } = await import('../api');
      
      const mockData = [
        {
          id: 'reg-123',
          userId: 'user-123',
          year: 2024,
          status: 'CONFIRMED' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          jobs: [],
          payments: [],
          campingOptions: [
            {
              id: 'cor-123',
              userId: 'user-123',
              campingOptionId: 'co-123',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ];

      // Fix: Mock response should match the expected API structure
      mockApi.get.mockResolvedValue({ 
        data: {
          registrations: mockData,
          total: mockData.length,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      });

      const result = await reports.getRegistrations({ includeCampingOptions: true });

      expect(mockApi.get).toHaveBeenCalledWith('/admin/registrations?includeCampingOptions=true');
      expect(result).toEqual(mockData);
      expect(result[0]).toHaveProperty('campingOptions');
    });

    it('should not include camping options when not requested', async () => {
      const { reports } = await import('../api');
      
      const mockData = [
        {
          id: 'reg-123',
          userId: 'user-123',
          year: 2024,
          status: 'CONFIRMED' as const,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          jobs: [],
          payments: [],
        },
      ];

      // Fix: Mock response should match the expected API structure
      mockApi.get.mockResolvedValue({ 
        data: {
          registrations: mockData,
          total: mockData.length,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      });

      const result = await reports.getRegistrations({ year: 2024 });

      expect(mockApi.get).toHaveBeenCalledWith('/admin/registrations?year=2024');
      expect(result).toEqual(mockData);
    });

    it('should handle mixed filters with camping options', async () => {
      const { reports } = await import('../api');
      
      const mockData: Registration[] = [];
      mockApi.get.mockResolvedValue({ 
        data: {
          registrations: mockData,
          total: mockData.length,
          page: 1,
          limit: 10,
          totalPages: 1
        }
      });

      await reports.getRegistrations({
        year: 2024,
        userId: 'user-123',
        includeCampingOptions: true,
      });

      expect(mockApi.get).toHaveBeenCalledWith(
        '/admin/registrations?userId=user-123&year=2024&includeCampingOptions=true'
      );
    });
  });
});
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      response: {
        use: vi.fn()
      },
      request: {
        use: vi.fn()
      }
    }
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance)
    }
  };
});

// Get reference to the mocked axios instance
const mockedAxios = axios as unknown as {
  create: () => typeof mockAxiosInstance;
};
const mockAxiosInstance = mockedAxios.create();

// Import the actual api module (not mocked)
import { reports } from '../api';

describe('reports.getPayments pagination fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should include take parameter with high value to avoid pagination', async () => {
    // Arrange
    const mockPayments = [
      { id: 'payment-1', amount: 100, status: 'COMPLETED' },
      { id: 'payment-2', amount: 200, status: 'COMPLETED' },
      { id: 'payment-3', amount: 300, status: 'COMPLETED' }
    ];
    
    mockAxiosInstance.get.mockResolvedValue({
      data: { payments: mockPayments }
    });

    // Act
    await reports.getPayments();

    // Assert
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/payments?take=10000');
  });

  it('should include take parameter along with filters', async () => {
    // Arrange
    const mockPayments = [
      { id: 'payment-1', amount: 100, status: 'COMPLETED' }
    ];
    
    mockAxiosInstance.get.mockResolvedValue({
      data: { payments: mockPayments }
    });

    const filters = {
      status: 'COMPLETED',
      provider: 'STRIPE'
    };

    // Act
    await reports.getPayments(filters);

    // Assert
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/payments?status=COMPLETED&provider=STRIPE&take=10000');
  });

  it('should return all payments when response has payments array', async () => {
    // Arrange
    const mockPayments = [
      { id: 'payment-1', amount: 100, status: 'COMPLETED' },
      { id: 'payment-2', amount: 200, status: 'COMPLETED' },
      { id: 'payment-3', amount: 300, status: 'COMPLETED' }
    ];
    
    mockAxiosInstance.get.mockResolvedValue({
      data: { payments: mockPayments }
    });

    // Act
    const result = await reports.getPayments();

    // Assert
    expect(result).toEqual(mockPayments);
    expect(result).toHaveLength(3);
  });

  it('should handle response with direct array format', async () => {
    // Arrange
    const mockPayments = [
      { id: 'payment-1', amount: 100, status: 'COMPLETED' },
      { id: 'payment-2', amount: 200, status: 'COMPLETED' }
    ];
    
    mockAxiosInstance.get.mockResolvedValue({
      data: mockPayments
    });

    // Act
    const result = await reports.getPayments();

    // Assert
    expect(result).toEqual(mockPayments);
    expect(result).toHaveLength(2);
  });

  it('should return empty array when response format is unexpected', async () => {
    // Arrange
    mockAxiosInstance.get.mockResolvedValue({
      data: { unexpectedFormat: 'something' }
    });

    // Act
    const result = await reports.getPayments();

    // Assert
    expect(result).toEqual([]);
  });

  it('should handle API errors gracefully', async () => {
    // Arrange
    const mockError = new Error('API Error');
    mockAxiosInstance.get.mockRejectedValue(mockError);

    // Act & Assert
    await expect(reports.getPayments()).rejects.toThrow('API Error');
  });
});
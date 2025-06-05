import { renderHook, act, waitFor } from '@testing-library/react';
import { useCampingOptions } from '../useCampingOptions';
import { campingOptions } from '../../lib/api';
import axios, { AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the API functions
vi.mock('../../lib/api', () => ({
  campingOptions: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getFields: vi.fn(),
    createField: vi.fn(),
    updateField: vi.fn(),
    deleteField: vi.fn(),
  },
}));

// Simplified mock for AxiosRequestConfig
// This avoids having to use 'any' for complex nested properties
const createMockConfig = (): InternalAxiosRequestConfig => ({
  headers: new AxiosHeaders(),
  // We're using type assertion here to simplify the mock 
  // since we don't need these properties for our tests
  transitional: {} as InternalAxiosRequestConfig['transitional'],
  adapter: undefined,
  transformRequest: [],
  transformResponse: [],
  timeout: 0,
  xsrfCookieName: '',
  xsrfHeaderName: '',
  maxContentLength: 0,
  maxBodyLength: 0,
  validateStatus: () => false
});

describe('useCampingOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch camping options', async () => {
    const mockOptions = [
      { id: '1', name: 'Option 1' },
      { id: '2', name: 'Option 2' },
    ];
    
    (campingOptions.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(mockOptions);
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.loadCampingOptions();
    });
    
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.options).toEqual(mockOptions);
    expect(result.current.error).toBe(null);
  });

  it('should handle error when fetching camping options', async () => {
    (campingOptions.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.loadCampingOptions();
    });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Failed to load camping options');
  });

  it('should fetch camping option fields', async () => {
    const mockFields = [
      { id: '1', displayName: 'Field 1', dataType: 'STRING' },
      { id: '2', displayName: 'Field 2', dataType: 'NUMBER' },
    ];
    
    (campingOptions.getFields as ReturnType<typeof vi.fn>).mockResolvedValue(mockFields);
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.loadCampingOptionFields('123');
    });
    
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.fields).toEqual(mockFields);
    expect(result.current.error).toBe(null);
  });

  it('should handle API error when fetching fields', async () => {
    const apiError = new Error('API error');
    (campingOptions.getFields as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.loadCampingOptionFields('123');
    });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Failed to load fields for camping option with ID 123');
  });

  it('should handle 404 error when fetching fields', async () => {
    const mockConfig = createMockConfig();
    
    const apiError = new axios.AxiosError();
    apiError.response = {
      status: 404,
      statusText: 'Not Found',
      headers: mockConfig.headers,
      data: { message: 'Camping option not found' },
      config: mockConfig,
    };
    
    (campingOptions.getFields as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.loadCampingOptionFields('123');
    });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Failed to load fields for camping option with ID 123');
  });

  it('should create a camping option field', async () => {
    const mockField = {
      id: '1',
      displayName: 'New Field',
      dataType: 'STRING',
      required: true,
      campingOptionId: '123',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };
    
    (campingOptions.createField as ReturnType<typeof vi.fn>).mockResolvedValue(mockField);
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.createCampingOptionField('123', {
        displayName: 'New Field',
        dataType: 'STRING',
        required: true,
      });
    });
    
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.fields).toEqual([mockField]);
    expect(result.current.error).toBe(null);
  });

  it('should handle error when creating a field', async () => {
    const mockConfig = createMockConfig();
    
    const apiError = new axios.AxiosError();
    apiError.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: mockConfig.headers,
      data: { message: 'Invalid field data' },
      config: mockConfig,
    };
    
    (campingOptions.createField as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.createCampingOptionField('123', {
        displayName: '',
        dataType: 'STRING',
        required: false, // required field must be provided
      });
    });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Failed to create field for camping option with ID 123');
  });

  it('should delete a camping option field', async () => {
    const mockField = {
      id: '1',
      displayName: 'Field to Delete',
      dataType: 'STRING',
      required: true,
      campingOptionId: '123',
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    };
    
    (campingOptions.deleteField as ReturnType<typeof vi.fn>).mockResolvedValue(mockField);
    
    const { result } = renderHook(() => useCampingOptions());
    
    await act(async () => {
      await result.current.deleteCampingOptionField('123', '1');
    });
    
    // Verify the deleteField function was called correctly
    expect(campingOptions.deleteField).toHaveBeenCalledWith('123', '1');
    expect(result.current.error).toBe(null);
  });

  it('should handle error when deleting a field', async () => {
    const mockConfig = createMockConfig();
    
    const apiError = new axios.AxiosError();
    apiError.response = {
      status: 404,
      statusText: 'Not Found',
      headers: mockConfig.headers,
      data: { message: 'Field not found' },
      config: mockConfig,
    };
    
    (campingOptions.deleteField as ReturnType<typeof vi.fn>).mockRejectedValue(apiError);
    
    const { result } = renderHook(() => useCampingOptions());
    
    act(() => {
      result.current.deleteCampingOptionField('123', '999');
    });
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.error).toBe('Failed to delete field with ID 999');
  });
}); 
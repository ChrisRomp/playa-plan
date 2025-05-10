import { renderHook, act, waitFor } from '@testing-library/react';
import { campingOptions, CampingOptionField } from '../lib/api';
import { useCampingOptions } from './useCampingOptions';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the campingOptions API module
vi.mock('../lib/api', () => ({
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
  CampingOptionField: {}, // Mock this for TypeScript
}));

// Mock camping option data
const mockCampingOptions = [
  {
    id: '1',
    name: 'Test Option 1',
    description: 'Test description',
    enabled: true,
    workShiftsRequired: 2,
    participantDues: 100,
    staffDues: 50,
    maxSignups: 50,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    campId: 'camp1',
    jobCategoryIds: ['job1', 'job2'],
    currentRegistrations: 10,
    availabilityStatus: true
  },
  {
    id: '2',
    name: 'Test Option 2',
    description: 'Another test description',
    enabled: false,
    workShiftsRequired: 1,
    participantDues: 200,
    staffDues: 100,
    maxSignups: 30,
    createdAt: '2023-01-02T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
    campId: 'camp1',
    jobCategoryIds: ['job3'],
    currentRegistrations: 5,
    availabilityStatus: false
  }
];

// Mock camping option field data
const mockFields = [
  {
    id: 'field1',
    displayName: 'Test Field 1',
    description: 'Field description',
    dataType: 'STRING' as const,
    required: true,
    maxLength: 100,
    minValue: null,
    maxValue: null,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    campingOptionId: '1'
  },
  {
    id: 'field2',
    displayName: 'Test Field 2',
    description: 'Another field description',
    dataType: 'NUMBER' as const,
    required: false,
    maxLength: null,
    minValue: 0,
    maxValue: 100,
    createdAt: '2023-01-02T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
    campingOptionId: '1'
  }
];

describe('useCampingOptions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should load camping options', async () => {
    // Mock the API call
    (campingOptions.getAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCampingOptions);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Initial state
    expect(result.current.options).toEqual([]);
    expect(result.current.loading).toBe(false);
    
    // Call the load function
    await act(async () => {
      await result.current.loadCampingOptions();
    });
    
    // Verify the API was called
    expect(campingOptions.getAll).toHaveBeenCalledWith(true, undefined);
    
    // Verify the state was updated
    await waitFor(() => {
      expect(result.current.options).toEqual(mockCampingOptions);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle load error', async () => {
    // Mock the API call to throw an error
    (campingOptions.getAll as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('API error'));
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Call the load function
    await act(async () => {
      await result.current.loadCampingOptions();
    });
    
    // Verify the error state
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load camping options');
      expect(result.current.loading).toBe(false);
    });
  });

  it('should load a camping option by ID', async () => {
    // Mock the API call
    (campingOptions.getById as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCampingOptions[0]);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Call the load function
    await act(async () => {
      await result.current.loadCampingOption('1');
    });
    
    // Verify the API was called
    expect(campingOptions.getById).toHaveBeenCalledWith('1');
    
    // Verify the state was updated
    await waitFor(() => {
      expect(result.current.selectedOption).toEqual(mockCampingOptions[0]);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should create a camping option', async () => {
    const newOption = {
      name: 'New Option',
      description: 'New description',
      enabled: true,
      workShiftsRequired: 2,
      participantDues: 150,
      staffDues: 75,
      maxSignups: 40,
      campId: 'camp1',
      jobCategoryIds: ['job1'],
    };
    
    const createdOption = {
      ...newOption,
      id: '3',
      createdAt: '2023-01-03T00:00:00Z',
      updatedAt: '2023-01-03T00:00:00Z',
      currentRegistrations: 0,
      availabilityStatus: true
    };
    
    // Mock the API call
    (campingOptions.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createdOption);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Call the create function
    await act(async () => {
      await result.current.createCampingOption(newOption);
    });
    
    // Verify the API was called
    expect(campingOptions.create).toHaveBeenCalledWith(newOption);
    
    // Verify the state was updated
    await waitFor(() => {
      expect(result.current.selectedOption).toEqual(createdOption);
      expect(result.current.options).toContainEqual(createdOption);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should update a camping option', async () => {
    const updateData = {
      name: 'Updated Option',
      description: 'Updated description',
    };
    
    const updatedOption = {
      ...mockCampingOptions[0],
      ...updateData,
      updatedAt: '2023-01-04T00:00:00Z',
    };
    
    // Setup initial state
    (campingOptions.getAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCampingOptions);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Load initial options
    await act(async () => {
      await result.current.loadCampingOptions();
    });
    
    // Set selected option
    await act(async () => {
      result.current.loadCampingOption('1');
    });
    
    // Mock the update API call
    (campingOptions.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedOption);
    
    // Call the update function
    await act(async () => {
      await result.current.updateCampingOption('1', updateData);
    });
    
    // Verify the API was called
    expect(campingOptions.update).toHaveBeenCalledWith('1', updateData);
    
    // Verify the state was updated
    await waitFor(() => {
      expect(result.current.options.find(o => o.id === '1')).toEqual(updatedOption);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should delete a camping option', async () => {
    // Setup initial state
    (campingOptions.getAll as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCampingOptions);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Load initial options
    await act(async () => {
      await result.current.loadCampingOptions();
    });
    
    // Mock the delete API call
    (campingOptions.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCampingOptions[0]);
    
    // Call the delete function
    await act(async () => {
      await result.current.deleteCampingOption('1');
    });
    
    // Verify the API was called
    expect(campingOptions.delete).toHaveBeenCalledWith('1');
    
    // Verify the option was removed from state
    await waitFor(() => {
      expect(result.current.options.find(o => o.id === '1')).toBeUndefined();
      expect(result.current.loading).toBe(false);
    });
  });

  it('should load camping option fields', async () => {
    // Mock the API call
    (campingOptions.getFields as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFields);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Call the load fields function
    await act(async () => {
      await result.current.loadCampingOptionFields('1');
    });
    
    // Verify the API was called
    expect(campingOptions.getFields).toHaveBeenCalledWith('1');
    
    // Verify the state was updated
    await waitFor(() => {
      expect(result.current.fields).toEqual(mockFields);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should create a camping option field', async () => {
    const newField = {
      displayName: 'New Field',
      description: 'New field description',
      dataType: 'STRING' as const,
      required: true,
      maxLength: 200
    };
    
    const createdField = {
      ...newField,
      id: 'field3',
      createdAt: '2023-01-05T00:00:00Z',
      updatedAt: '2023-01-05T00:00:00Z',
      campingOptionId: '1'
    };
    
    // Mock the API call
    (campingOptions.createField as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createdField);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Call the create field function
    await act(async () => {
      await result.current.createCampingOptionField('1', newField);
    });
    
    // Verify the API was called
    expect(campingOptions.createField).toHaveBeenCalledWith('1', newField);
    
    // Verify the state was updated
    await waitFor(() => {
      expect(result.current.fields).toContainEqual(createdField);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should update a camping option field', async () => {
    // Setup initial fields
    (campingOptions.getFields as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFields);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Load initial fields
    await act(async () => {
      await result.current.loadCampingOptionFields('1');
    });
    
    const updateData = {
      displayName: 'Updated Field',
      required: false
    };
    
    const updatedField = {
      ...mockFields[0],
      ...updateData,
      updatedAt: '2023-01-06T00:00:00Z'
    };
    
    // Mock the update API call
    (campingOptions.updateField as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedField);
    
    // Call the update field function
    await act(async () => {
      await result.current.updateCampingOptionField('1', 'field1', updateData);
    });
    
    // Verify the API was called
    expect(campingOptions.updateField).toHaveBeenCalledWith('1', 'field1', updateData);
    
    // Verify the state was updated
    await waitFor(() => {
      expect(result.current.fields.find(f => f.id === 'field1')).toEqual(updatedField);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should delete a camping option field', async () => {
    // Setup initial fields
    (campingOptions.getFields as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFields);
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Load initial fields
    await act(async () => {
      await result.current.loadCampingOptionFields('1');
    });
    
    // Mock the delete API call
    (campingOptions.deleteField as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockFields[0]);
    
    // Call the delete field function
    await act(async () => {
      await result.current.deleteCampingOptionField('1', 'field1');
    });
    
    // Verify the API was called
    expect(campingOptions.deleteField).toHaveBeenCalledWith('1', 'field1');
    
    // Verify the field was removed from state
    await waitFor(() => {
      expect(result.current.fields.find(f => f.id === 'field1')).toBeUndefined();
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle legacy dataType conversion', async () => {
    // Test data with a legacy 'TEXT' dataType that should be converted to 'STRING'
    const legacyFieldData = {
      displayName: 'Legacy Text Field',
      description: 'Uses old TEXT type',
      dataType: 'TEXT' as unknown as CampingOptionField['dataType'], // Cast to supported type
      required: true,
      maxLength: 100
    };
    
    const convertedField = {
      ...legacyFieldData,
      id: 'converted-field-1',
      dataType: 'STRING', // The API should receive STRING instead of TEXT
      createdAt: '2023-01-05T00:00:00Z',
      updatedAt: '2023-01-05T00:00:00Z',
      campingOptionId: '1'
    };
    
    // Mock the API call and capture the passed parameters
    let capturedData: Record<string, unknown> = {};
    (campingOptions.createField as unknown as ReturnType<typeof vi.fn>).mockImplementation((id, data) => {
      capturedData = data as Record<string, unknown>;
      return Promise.resolve(convertedField);
    });
    
    // Render the hook
    const { result } = renderHook(() => useCampingOptions());
    
    // Call create with legacy dataType
    await act(async () => {
      await result.current.createCampingOptionField('1', legacyFieldData);
    });
    
    // Verify the conversion happened before API call
    expect(capturedData.dataType).toBe('STRING');
    
    // Also test with SELECT type
    const legacySelectData = {
      displayName: 'Legacy Select Field',
      description: 'Uses old SELECT type',
      dataType: 'SELECT' as unknown as CampingOptionField['dataType'], // Cast to supported type
      required: false
    };
    
    // Call create with another legacy dataType
    await act(async () => {
      await result.current.createCampingOptionField('1', legacySelectData);
    });
    
    // Verify this conversion also worked
    expect(capturedData.dataType).toBe('STRING');
  });
}); 
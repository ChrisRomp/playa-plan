import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../utils/test-utils';
import AdminCampingOptionFieldsPage from './AdminCampingOptionFieldsPage';
import { useCampingOptions } from '../hooks/useCampingOptions';
import { vi } from 'vitest';
import axios from 'axios';

// Mock the useCampingOptions hook
vi.mock('../hooks/useCampingOptions');

// Mock the router params
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({
      optionId: 'test-option-id'
    }),
    useNavigate: () => vi.fn()
  };
});

const mockCampingOption = {
  id: 'test-option-id',
  name: 'Test Camping Option',
  description: 'A test camping option',
  enabled: true,
  workShiftsRequired: 2,
  participantDues: 100,
  staffDues: 50,
  maxSignups: 20,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  campId: 'test-camp-id',
  jobCategoryIds: [],
  currentRegistrations: 0
};

const mockFields = [
  {
    id: 'field-1',
    displayName: 'Test Field 1',
    description: 'A test field',
    dataType: 'TEXT',
    required: true,
    maxLength: 100,
    minValue: null,
    maxValue: null,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    campingOptionId: 'test-option-id'
  },
  {
    id: 'field-2',
    displayName: 'Test Field 2',
    description: 'Another test field',
    dataType: 'NUMBER',
    required: false,
    maxLength: null,
    minValue: 0,
    maxValue: 10,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    campingOptionId: 'test-option-id'
  }
];

describe('AdminCampingOptionFieldsPage', () => {
  const mockLoadCampingOption = vi.fn();
  const mockLoadCampingOptionFields = vi.fn();
  const mockCreateCampingOptionField = vi.fn();
  const mockUpdateCampingOptionField = vi.fn();
  const mockDeleteCampingOptionField = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementation
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: mockCampingOption,
      fields: mockFields,
      loading: false,
      error: null,
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: mockCreateCampingOptionField,
      updateCampingOptionField: mockUpdateCampingOptionField,
      deleteCampingOptionField: mockDeleteCampingOptionField
    });
  });

  it('should render the page title with the camping option name', () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    expect(screen.getByText(/Fields for Test Camping Option/i)).toBeInTheDocument();
  });

  it('should load the camping option and fields on mount', () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    expect(mockLoadCampingOption).toHaveBeenCalledWith('test-option-id');
    expect(mockLoadCampingOptionFields).toHaveBeenCalledWith('test-option-id');
  });

  it('should display a loading state when loading', () => {
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: null,
      fields: [],
      loading: true,
      error: null,
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: mockCreateCampingOptionField,
      updateCampingOptionField: mockUpdateCampingOptionField,
      deleteCampingOptionField: mockDeleteCampingOptionField
    });

    renderWithRouter(<AdminCampingOptionFieldsPage />);
    expect(screen.getByText(/Loading fields/i)).toBeInTheDocument();
  });

  it('should display an error message when there is an error', () => {
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: null,
      fields: [],
      loading: false,
      error: 'Error loading fields',
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: mockCreateCampingOptionField,
      updateCampingOptionField: mockUpdateCampingOptionField,
      deleteCampingOptionField: mockDeleteCampingOptionField
    });

    renderWithRouter(<AdminCampingOptionFieldsPage />);
    expect(screen.getByText(/Error loading fields/i)).toBeInTheDocument();
  });

  it('should display a message when no fields are found', () => {
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: mockCampingOption,
      fields: [],
      loading: false,
      error: null,
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: mockCreateCampingOptionField,
      updateCampingOptionField: mockUpdateCampingOptionField,
      deleteCampingOptionField: mockDeleteCampingOptionField
    });

    renderWithRouter(<AdminCampingOptionFieldsPage />);
    expect(screen.getByText(/No custom fields found/i)).toBeInTheDocument();
  });

  it('should render the list of fields', () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    expect(screen.getByText('Test Field 1')).toBeInTheDocument();
    expect(screen.getByText('Test Field 2')).toBeInTheDocument();
    expect(screen.getByText('TEXT')).toBeInTheDocument();
    expect(screen.getByText('NUMBER')).toBeInTheDocument();
  });

  it('should open the modal when Add Custom Field button is clicked', () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Click the Add Custom Field button
    fireEvent.click(screen.getByText('Add Custom Field', { selector: 'button.bg-blue-500' }));
    
    // Check if the modal is open
    expect(screen.getByText('Add Custom Field', { selector: 'h3' })).toBeInTheDocument();
  });

  it('should open the edit modal with field data when Edit button is clicked', () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Find and click the first Edit button
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    
    // Check if the modal is open with the correct field data
    expect(screen.getByText('Edit Field')).toBeInTheDocument();
    expect((screen.getByLabelText(/Field Name/i) as HTMLInputElement).value).toBe('Test Field 1');
  });

  it('should call createCampingOptionField when saving a new field', async () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Open the add field modal
    fireEvent.click(screen.getByText('Add Custom Field'));
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/Field Name/i), { target: { value: 'New Field' } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'A new field description' } });
    
    // Submit the form
    fireEvent.click(screen.getByText('Save'));
    
    // Verify the function was called with correct arguments
    await waitFor(() => {
      expect(mockCreateCampingOptionField).toHaveBeenCalledWith('test-option-id', expect.objectContaining({
        displayName: 'New Field',
        description: 'A new field description',
        dataType: 'STRING',
        required: false
      }));
    });
  });

  it('should call updateCampingOptionField when updating an existing field', async () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Find and click the first Edit button
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    
    // Modify the field
    fireEvent.change(screen.getByLabelText(/Field Name/i), { target: { value: 'Updated Field Name' } });
    
    // Submit the form
    fireEvent.click(screen.getByText('Save'));
    
    // Verify the function was called with correct arguments
    await waitFor(() => {
      expect(mockUpdateCampingOptionField).toHaveBeenCalledWith(
        'test-option-id',
        'field-1',
        expect.objectContaining({
          displayName: 'Updated Field Name'
        })
      );
    });
  });

  it('should open delete confirmation modal and call deleteCampingOptionField when confirmed', async () => {
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Find and click the first Delete button
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    // Check if confirmation modal is open
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    
    // Confirm deletion
    fireEvent.click(screen.getByText('Delete', { selector: 'button.bg-red-500' }));
    
    // Verify the function was called with correct arguments
    await waitFor(() => {
      expect(mockDeleteCampingOptionField).toHaveBeenCalledWith('test-option-id', 'field-1');
    });
  });

  it('should display an error message when field creation fails', async () => {
    // Mock createCampingOptionField to throw an error
    const mockError = {
      isAxiosError: true,
      response: {
        data: {
          message: ['Validation error: Field name is required'],
          error: 'Bad Request',
          statusCode: 400
        }
      },
      message: 'Request failed with status code 400'
    };
    
    const createFieldWithError = vi.fn().mockRejectedValue(mockError);
    
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: mockCampingOption,
      fields: mockFields,
      loading: false,
      error: null,
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: createFieldWithError,
      updateCampingOptionField: mockUpdateCampingOptionField,
      deleteCampingOptionField: mockDeleteCampingOptionField
    });
    
    // Spy on axios.isAxiosError
    vi.spyOn(axios, 'isAxiosError').mockImplementation(() => true);
    
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Open the add field modal
    fireEvent.click(screen.getByText('Add Custom Field'));
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/Field Name/i), { target: { value: 'New Field' } });
    
    // Submit the form
    fireEvent.click(screen.getByText('Save'));
    
    // Verify the error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Validation error: Field name is required')).toBeInTheDocument();
    });
    
    // Cleanup
    vi.mocked(axios.isAxiosError).mockRestore();
  });

  it('should display an error message when field update fails', async () => {
    // Mock updateCampingOptionField to throw an error
    const mockError = {
      isAxiosError: true,
      response: {
        data: {
          message: 'Field with this name already exists',
          error: 'Bad Request',
          statusCode: 400
        }
      },
      message: 'Request failed with status code 400'
    };
    
    const updateFieldWithError = vi.fn().mockRejectedValue(mockError);
    
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: mockCampingOption,
      fields: mockFields,
      loading: false,
      error: null,
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: mockCreateCampingOptionField,
      updateCampingOptionField: updateFieldWithError,
      deleteCampingOptionField: mockDeleteCampingOptionField
    });
    
    // Spy on axios.isAxiosError
    vi.spyOn(axios, 'isAxiosError').mockImplementation(() => true);
    
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Find and click the first Edit button
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    
    // Modify the field
    fireEvent.change(screen.getByLabelText(/Field Name/i), { target: { value: 'Updated Field Name' } });
    
    // Submit the form
    fireEvent.click(screen.getByText('Save'));
    
    // Verify the error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Field with this name already exists')).toBeInTheDocument();
    });
    
    // Cleanup
    vi.mocked(axios.isAxiosError).mockRestore();
  });

  it('should display an error message when field deletion fails', async () => {
    // Mock deleteCampingOptionField to throw an error
    const mockError = {
      isAxiosError: true,
      response: {
        data: {
          message: 'Cannot delete field - it is in use',
          error: 'Bad Request',
          statusCode: 400
        }
      },
      message: 'Request failed with status code 400'
    };
    
    const deleteFieldWithError = vi.fn().mockRejectedValue(mockError);
    
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: mockCampingOption,
      fields: mockFields,
      loading: false,
      error: null,
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: mockCreateCampingOptionField,
      updateCampingOptionField: mockUpdateCampingOptionField,
      deleteCampingOptionField: deleteFieldWithError
    });
    
    // Spy on axios.isAxiosError
    vi.spyOn(axios, 'isAxiosError').mockImplementation(() => true);
    
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Find and click the first Delete button
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    // Check if confirmation modal is open
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    
    // Confirm deletion
    fireEvent.click(screen.getByText('Delete', { selector: 'button.bg-red-500' }));
    
    // Verify the error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Cannot delete field - it is in use')).toBeInTheDocument();
    });
    
    // Cleanup
    vi.mocked(axios.isAxiosError).mockRestore();
  });

  it('should handle network errors during API operations', async () => {
    // Mock createCampingOptionField to throw a network error
    const mockError = {
      isAxiosError: true,
      message: 'Network Error',
      response: undefined
    };
    
    const createFieldWithError = vi.fn().mockRejectedValue(mockError);
    
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      selectedOption: mockCampingOption,
      fields: mockFields,
      loading: false,
      error: null,
      loadCampingOption: mockLoadCampingOption,
      loadCampingOptionFields: mockLoadCampingOptionFields,
      createCampingOptionField: createFieldWithError,
      updateCampingOptionField: mockUpdateCampingOptionField,
      deleteCampingOptionField: mockDeleteCampingOptionField
    });
    
    // Spy on axios.isAxiosError
    vi.spyOn(axios, 'isAxiosError').mockImplementation(() => true);
    
    renderWithRouter(<AdminCampingOptionFieldsPage />);
    
    // Open the add field modal
    fireEvent.click(screen.getByText('Add Custom Field'));
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/Field Name/i), { target: { value: 'New Field' } });
    
    // Submit the form
    fireEvent.click(screen.getByText('Save'));
    
    // Verify the error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Network error occurred. Please try again.')).toBeInTheDocument();
    });
    
    // Cleanup
    vi.mocked(axios.isAxiosError).mockRestore();
  });
}); 
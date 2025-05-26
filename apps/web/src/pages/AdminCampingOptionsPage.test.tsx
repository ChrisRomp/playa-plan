import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminCampingOptionsPage from './AdminCampingOptionsPage';
import { useCampingOptions } from '../hooks/useCampingOptions';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the useCampingOptions hook
vi.mock('../hooks/useCampingOptions');

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

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

// Mock implementation for the deleteCampingOption function
const mockDeleteCampingOption = vi.fn();
// Mock implementation for the createCampingOption and updateCampingOption functions
const mockCreateCampingOption = vi.fn();
const mockUpdateCampingOption = vi.fn();

const renderWithRouter = (ui: React.ReactElement) => {
  return render(ui, { wrapper: MemoryRouter });
};

describe('AdminCampingOptionsPage', () => {
  const mockLoadCampingOptions = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the hook implementation with all required functions
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      options: mockCampingOptions,
      loading: false,
      error: null,
      loadCampingOptions: mockLoadCampingOptions,
      deleteCampingOption: mockDeleteCampingOption,
      createCampingOption: mockCreateCampingOption,
      updateCampingOption: mockUpdateCampingOption,
      selectedOption: null,
      fields: [],
      loadCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn(),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn()
    });
  });
  
  it('renders the camping options page title', () => {
    renderWithRouter(<AdminCampingOptionsPage />);
    expect(screen.getByText('Camping Options')).toBeInTheDocument();
  });
  
  it('loads camping options on mount', () => {
    renderWithRouter(<AdminCampingOptionsPage />);
    expect(mockLoadCampingOptions).toHaveBeenCalledWith(true);
  });
  
  it('renders a table of camping options', () => {
    renderWithRouter(<AdminCampingOptionsPage />);
    
    // Check that option names are displayed
    expect(screen.getByText('Test Option 1')).toBeInTheDocument();
    expect(screen.getByText('Test Option 2')).toBeInTheDocument();
    
    // Check status badges
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    
    // Check pricing information with more specific selectors
    expect(screen.getAllByText(/\$100\.00/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/\$200\.00/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/\$50\.00/)[0]).toBeInTheDocument();
    
    // Check registration counts
    expect(screen.getByText('10 / 50')).toBeInTheDocument();
    expect(screen.getByText('5 / 30')).toBeInTheDocument();
  });
  
  it('shows loading state when loading is true', () => {
    // Override the mock to show loading
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      options: [],
      loading: true,
      error: null,
      loadCampingOptions: mockLoadCampingOptions,
      deleteCampingOption: mockDeleteCampingOption,
      createCampingOption: mockCreateCampingOption,
      updateCampingOption: mockUpdateCampingOption,
      selectedOption: null,
      fields: [],
      loadCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn(),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn()
    });
    
    renderWithRouter(<AdminCampingOptionsPage />);
    expect(screen.getByText('Loading camping options...')).toBeInTheDocument();
  });
  
  it('shows error message when there is an error', () => {
    // Override the mock to show an error
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      options: [],
      loading: false,
      error: 'Failed to load camping options',
      loadCampingOptions: mockLoadCampingOptions,
      deleteCampingOption: mockDeleteCampingOption,
      createCampingOption: mockCreateCampingOption,
      updateCampingOption: mockUpdateCampingOption,
      selectedOption: null,
      fields: [],
      loadCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn(),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn()
    });
    
    renderWithRouter(<AdminCampingOptionsPage />);
    expect(screen.getByText('Failed to load camping options')).toBeInTheDocument();
  });
  
  it('shows empty state when there are no options', () => {
    // Override the mock to return empty options
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      options: [],
      loading: false,
      error: null,
      loadCampingOptions: mockLoadCampingOptions,
      deleteCampingOption: mockDeleteCampingOption,
      createCampingOption: mockCreateCampingOption,
      updateCampingOption: mockUpdateCampingOption,
      selectedOption: null,
      fields: [],
      loadCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn(),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn()
    });
    
    renderWithRouter(<AdminCampingOptionsPage />);
    expect(screen.getByText('No camping options found. Click the button above to create one.')).toBeInTheDocument();
  });
  
  it('opens edit modal when edit button is clicked', () => {
    // First, make the Delete buttons not disabled for testing
    const mockOptionsWithEnabledDelete = mockCampingOptions.map(option => ({
      ...option, 
      currentRegistrations: 0
    }));
  
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      options: mockOptionsWithEnabledDelete,
      loading: false,
      error: null,
      loadCampingOptions: mockLoadCampingOptions,
      deleteCampingOption: mockDeleteCampingOption,
      createCampingOption: mockCreateCampingOption,
      updateCampingOption: mockUpdateCampingOption,
      selectedOption: null,
      fields: [],
      loadCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn(),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn()
    });
    
    renderWithRouter(<AdminCampingOptionsPage />);
    
    // Click the edit button for the first option (using more specific selector)
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    
    // Check that the modal title is displayed
    expect(screen.getByText('Edit Camping Option')).toBeInTheDocument();
  });
  
  it('opens add modal when add button is clicked', () => {
    renderWithRouter(<AdminCampingOptionsPage />);
    
    // Click the add button - be more specific with role
    const addButton = screen.getByRole('button', { name: 'Add Option' });
    fireEvent.click(addButton);
    
    // Check that the modal title is displayed using a more specific selector (h3 element)
    expect(screen.getByRole('heading', { name: 'Add Camping Option' })).toBeInTheDocument();
  });
  
  it('opens delete confirmation modal when delete button is clicked', () => {
    // First, make the Delete buttons not disabled for testing
    const mockOptionsWithEnabledDelete = mockCampingOptions.map(option => ({
      ...option, 
      currentRegistrations: 0
    }));
  
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      options: mockOptionsWithEnabledDelete,
      loading: false,
      error: null,
      loadCampingOptions: mockLoadCampingOptions,
      deleteCampingOption: mockDeleteCampingOption,
      createCampingOption: mockCreateCampingOption,
      updateCampingOption: mockUpdateCampingOption,
      selectedOption: null,
      fields: [],
      loadCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn(),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn()
    });
    
    renderWithRouter(<AdminCampingOptionsPage />);
    
    // Click the delete button for the first option
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    // Check that the confirmation modal is displayed
    expect(screen.getByRole('heading', { name: 'Confirm Deletion' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete this camping option/)).toBeInTheDocument();
  });
  
  it('calls deleteCampingOption when delete is confirmed', async () => {
    // First, make the Delete buttons not disabled for testing
    const mockOptionsWithEnabledDelete = mockCampingOptions.map(option => ({
      ...option, 
      currentRegistrations: 0
    }));
  
    (useCampingOptions as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      options: mockOptionsWithEnabledDelete,
      loading: false,
      error: null,
      loadCampingOptions: mockLoadCampingOptions,
      deleteCampingOption: mockDeleteCampingOption,
      createCampingOption: mockCreateCampingOption,
      updateCampingOption: mockUpdateCampingOption,
      selectedOption: null,
      fields: [],
      loadCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn(),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn()
    });
    
    renderWithRouter(<AdminCampingOptionsPage />);
    
    // Click the delete button for the first option
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    // Find the confirm button in the modal with a more specific approach
    // Use a more specific selector that targets the delete button in the confirmation modal
    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    // The modal confirm button is likely the last one (has a different class)
    const confirmDeleteButton = confirmButtons.find(button => 
      button.classList.contains('bg-red-500')
    );
    expect(confirmDeleteButton).not.toBeUndefined();
    
    if (confirmDeleteButton) {
      fireEvent.click(confirmDeleteButton);
    }
    
    // Check that the delete function was called with the correct ID
    await waitFor(() => {
      expect(mockDeleteCampingOption).toHaveBeenCalledWith('1');
    });
  });
}); 
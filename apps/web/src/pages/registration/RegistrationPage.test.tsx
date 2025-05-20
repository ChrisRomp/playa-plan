import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RegistrationPage from './RegistrationPage';
import { AuthContext } from '../../store/authUtils';
import * as useRegistrationModule from '../../hooks/useRegistration';
import * as useCampingOptionsModule from '../../hooks/useCampingOptions';

// Mock modules
vi.mock('../../hooks/useRegistration');
vi.mock('../../hooks/useCampingOptions');

describe('RegistrationPage', () => {
  // Mock user
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    role: 'user' as const,
    isAuthenticated: true,
    isEarlyRegistrationEnabled: false,
    hasRegisteredForCurrentYear: false,
  };

  // Mock camping options
  const mockCampingOptions = [
    {
      id: 'option1',
      name: 'Standard Camping',
      description: 'Basic camping option',
      enabled: true,
      shiftsRequired: 2,
      participantDues: 100,
      staffDues: 50,
      maxSignups: 10,
      currentSignups: 5,
    },
    {
      id: 'option2',
      name: 'Premium Camping',
      description: 'Premium camping with extras',
      enabled: true,
      shiftsRequired: 3,
      participantDues: 200,
      staffDues: 100,
      maxSignups: 5,
      currentSignups: 3,
    },
  ];

  // Mock job categories
  const mockJobCategories = [
    {
      id: 'cat1',
      name: 'Kitchen',
      description: 'Kitchen duties',
      alwaysRequired: true,
    },
    {
      id: 'cat2',
      name: 'Cleaning',
      description: 'Cleaning duties',
      alwaysRequired: false,
    },
  ];

  // Mock jobs
  const mockJobs = [
    {
      id: 'job1',
      name: 'Cook',
      description: 'Cooking meals',
      categoryId: 'cat1',
      shiftId: 'shift1',
      category: { id: 'cat1', name: 'Kitchen' },
      maxRegistrations: 5,
      currentRegistrations: 2,
    },
    {
      id: 'job2',
      name: 'Cleaning',
      description: 'Cleaning common areas',
      categoryId: 'cat2',
      shiftId: 'shift2',
      category: { id: 'cat2', name: 'Cleaning' },
      maxRegistrations: 10,
      currentRegistrations: 3,
    },
  ];

  // Mock shifts
  const mockShifts = [
    {
      id: 'shift1',
      dayOfWeek: 'MONDAY',
      startTime: '2025-05-20T09:00:00Z',
      endTime: '2025-05-20T12:00:00Z',
    },
    {
      id: 'shift2',
      dayOfWeek: 'TUESDAY',
      startTime: '2025-05-21T13:00:00Z',
      endTime: '2025-05-21T17:00:00Z',
    },
  ];

  // Mock custom fields
  const mockFields = [
    {
      id: 'field1',
      displayName: 'Arrival Date',
      description: 'When do you plan to arrive?',
      dataType: 'DATE',
      required: true,
      campingOptionId: 'option1',
    },
    {
      id: 'field2',
      displayName: 'Special Needs',
      description: 'Any special requirements?',
      dataType: 'STRING',
      required: false,
      maxLength: 200,
      campingOptionId: 'option1',
    },
  ];

  // Setup mocks before each test
  beforeEach(() => {
    // Mock useRegistration hook
    vi.spyOn(useRegistrationModule, 'useRegistration').mockReturnValue({
      campingOptions: mockCampingOptions,
      jobCategories: mockJobCategories,
      jobs: mockJobs,
      shifts: mockShifts,
      loading: false,
      error: null,
      fetchCampingOptions: vi.fn(),
      fetchJobCategories: vi.fn(),
      fetchShifts: vi.fn(),
      fetchJobs: vi.fn(),
      submitRegistration: vi.fn().mockResolvedValue({}),
    });

    // Mock useCampingOptions hook
    vi.spyOn(useCampingOptionsModule, 'useCampingOptions').mockReturnValue({
      options: [],
      selectedOption: null,
      fields: mockFields,
      loading: false,
      error: null,
      loadCampingOptions: vi.fn(),
      loadCampingOption: vi.fn(),
      createCampingOption: vi.fn(),
      updateCampingOption: vi.fn(),
      deleteCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn().mockResolvedValue(mockFields),
      createCampingOptionField: vi.fn(),
      updateCampingOptionField: vi.fn(),
      deleteCampingOptionField: vi.fn(),
    });
  });

  // Helper function to render component with context
  const renderWithAuth = (isAuthenticated = true, user = mockUser) => {
    return render(
      <BrowserRouter>
        <AuthContext.Provider 
          value={{ 
            user: isAuthenticated ? user : null, 
            requestVerificationCode: vi.fn(), 
            verifyCode: vi.fn(), 
            logout: vi.fn(), 
            isLoading: false, 
            error: null, 
            isAuthenticated 
          }}
        >
          <RegistrationPage />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  it('renders the registration page with profile confirmation step when authenticated', () => {
    renderWithAuth();
    
    // Check that profile confirmation step is shown
    expect(screen.getByText('Confirm Your Profile Information')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('shows login message when not authenticated', () => {
    renderWithAuth(false);
    
    expect(screen.getByText('You must be logged in to register.')).toBeInTheDocument();
    expect(screen.getByText('Go to Login')).toBeInTheDocument();
  });

  it('allows navigating to camping options step after confirming profile', async () => {
    renderWithAuth();
    
    // Confirm profile
    const checkbox = screen.getByLabelText('I confirm that my profile information is correct and up to date');
    fireEvent.click(checkbox);
    
    // Click continue
    const continueButton = screen.getByText('Continue');
    fireEvent.click(continueButton);
    
    // Should now be on camping options step
    await waitFor(() => {
      expect(screen.getByText('Select Camping Options')).toBeInTheDocument();
    });
    
    // Check camping options are displayed
    expect(screen.getByText('Standard Camping')).toBeInTheDocument();
    expect(screen.getByText('Premium Camping')).toBeInTheDocument();
  });

  it('disables the continue button when profile is not confirmed', () => {
    renderWithAuth();
    
    // Continue button should be disabled
    const continueButton = screen.getByText('Continue');
    expect(continueButton).toBeDisabled();
    
    // When we check the confirmation box
    const checkbox = screen.getByLabelText('I confirm that my profile information is correct and up to date');
    fireEvent.click(checkbox);
    
    // Button should now be enabled
    expect(continueButton).not.toBeDisabled();
  });

  // Add more tests as needed for other steps in the registration flow
});

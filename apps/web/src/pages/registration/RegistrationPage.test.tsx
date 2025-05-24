import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RegistrationPage from './RegistrationPage';
import { AuthContext } from '../../store/authUtils';
import * as useRegistrationModule from '../../hooks/useRegistration';
import * as useCampingOptionsModule from '../../hooks/useCampingOptions';
import * as useProfileModule from '../../hooks/useProfile';

// Mock modules
vi.mock('../../hooks/useRegistration');
vi.mock('../../hooks/useCampingOptions');
vi.mock('../../hooks/useProfile');

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

  // Mock profile
  const mockProfile = {
    id: '123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    playaName: '',
    phone: '',
    city: '',
    stateProvince: '',
    country: '',
    emergencyContact: '',
    role: 'PARTICIPANT' as const,
    isEmailVerified: true,
    createdAt: '2025-05-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    isProfileComplete: true,
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
      staffOnly: false,
    },
    {
      id: 'cat2',
      name: 'Cleaning',
      description: 'Cleaning duties',
      alwaysRequired: false,
      staffOnly: false,
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
      category: { 
        id: 'cat1', 
        name: 'Kitchen',
        description: 'Kitchen duties',
        staffOnly: false,
        alwaysRequired: true 
      },
      maxRegistrations: 5,
      currentRegistrations: 2,
      location: 'Kitchen Area',
    },
    {
      id: 'job2',
      name: 'Cleaning',
      description: 'Cleaning common areas',
      categoryId: 'cat2',
      shiftId: 'shift2',
      category: { 
        id: 'cat2', 
        name: 'Cleaning',
        description: 'Cleaning duties',
        staffOnly: false,
        alwaysRequired: false
      },
      maxRegistrations: 10,
      currentRegistrations: 3,
      location: 'Common Areas',
    },
  ];

  // Mock shifts
  const mockShifts = [
    {
      id: 'shift1',
      name: 'Morning Shift',
      description: 'Morning work period',
      dayOfWeek: 'MONDAY',
      startTime: '2025-05-20T09:00:00Z',
      endTime: '2025-05-20T12:00:00Z',
    },
    {
      id: 'shift2',
      name: 'Afternoon Shift',
      description: 'Afternoon work period',
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
      dataType: 'DATE' as const,
      required: true,
      campingOptionId: 'option1',
      createdAt: '2025-05-01T00:00:00Z',
      updatedAt: '2025-05-01T00:00:00Z',
      minValue: null,
      maxValue: null,
    },
    {
      id: 'field2',
      displayName: 'Special Needs',
      description: 'Any special requirements?',
      dataType: 'STRING' as const,
      required: false,
      maxLength: 200,
      campingOptionId: 'option1',
      createdAt: '2025-05-01T00:00:00Z',
      updatedAt: '2025-05-01T00:00:00Z',
      minValue: null,
      maxValue: null,
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

    // Mock useProfile hook
    vi.spyOn(useProfileModule, 'useProfile').mockReturnValue({
      profile: mockProfile,
      updateProfile: vi.fn().mockResolvedValue({}),
      isLoading: false,
      error: null,
      isProfileComplete: true,
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

  it('renders the registration page with profile form step when authenticated', () => {
    renderWithAuth();
    
    // Check that profile form step is shown
    expect(screen.getByText('Your Profile Information')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name*')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name*')).toBeInTheDocument();
    expect(screen.getByLabelText('Email*')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number*')).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency Contact(s)*')).toBeInTheDocument();
  });

  it('shows login message when not authenticated', () => {
    renderWithAuth(false);
    
    expect(screen.getByText('You must be logged in to register.')).toBeInTheDocument();
    expect(screen.getByText('Go to Login')).toBeInTheDocument();
  });

  it('allows navigating to camping options step after filling profile form', async () => {
    renderWithAuth();
    
    // Fill required profile fields
    const firstNameInput = screen.getByLabelText('First Name*');
    const lastNameInput = screen.getByLabelText('Last Name*');
    const phoneInput = screen.getByLabelText('Phone Number*');
    const emergencyContactInput = screen.getByLabelText('Emergency Contact(s)*');
    
    fireEvent.change(firstNameInput, { target: { value: 'Test' } });
    fireEvent.change(lastNameInput, { target: { value: 'User' } });
    fireEvent.change(phoneInput, { target: { value: '555-1234' } });
    fireEvent.change(emergencyContactInput, { target: { value: 'Emergency Contact' } });
    
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

  it('allows continuing when profile form has required fields filled', () => {
    renderWithAuth();
    
    // Continue button should be enabled (no longer disabled by default)
    const continueButton = screen.getByText('Continue');
    expect(continueButton).not.toBeDisabled();
    
    // Verify required fields are present
    expect(screen.getByLabelText('First Name*')).toBeInTheDocument();
    expect(screen.getByLabelText('Last Name*')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number*')).toBeInTheDocument();
    expect(screen.getByLabelText('Emergency Contact(s)*')).toBeInTheDocument();
  });

  // Add more tests as needed for other steps in the registration flow
});

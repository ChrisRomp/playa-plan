import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RegistrationPage from './RegistrationPage';
import { AuthContext } from '../../store/authUtils';
import * as useRegistrationModule from '../../hooks/useRegistration';
import * as useCampingOptionsModule from '../../hooks/useCampingOptions';
import * as useProfileModule from '../../hooks/useProfile';
import * as useCampRegistrationModule from '../../hooks/useCampRegistration';
import * as useConfigModule from '../../store/ConfigContext';

// Mock modules
vi.mock('../../hooks/useRegistration');
vi.mock('../../hooks/useCampingOptions');
vi.mock('../../hooks/useProfile');
vi.mock('../../hooks/useCampRegistration');
vi.mock('../../store/ConfigContext');

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
      workShiftsRequired: 2,
      participantDues: 100,
      staffDues: 50,
      maxSignups: 10,
      currentRegistrations: 5,
      createdAt: '2025-05-01T00:00:00Z',
      updatedAt: '2025-05-01T00:00:00Z',
      jobCategoryIds: ['cat1', 'cat2'],
    },
    {
      id: 'option2',
      name: 'Premium Camping',
      description: 'Premium camping with extras',
      enabled: true,
      workShiftsRequired: 3,
      participantDues: 200,
      staffDues: 100,
      maxSignups: 5,
      currentRegistrations: 3,
      createdAt: '2025-05-01T00:00:00Z',
      updatedAt: '2025-05-01T00:00:00Z',
      jobCategoryIds: ['cat1'],
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
    // Clear all mocks to ensure test isolation
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
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

    // Mock useCampRegistration hook
    vi.spyOn(useCampRegistrationModule, 'useCampRegistration').mockReturnValue({
      campRegistration: {
        campingOptions: [],
        customFieldValues: [],
        jobRegistrations: [],
        hasRegistration: false,
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    // Mock useConfig hook
    vi.spyOn(useConfigModule, 'useConfig').mockReturnValue({
      config: {
        name: 'Test Camp',
        description: 'Test Description',
        homePageBlurb: 'Welcome!',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2025,
      },
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
    });
  });

  // Cleanup after each test
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
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

  describe('Job Selection Validation', () => {
    // Mock data for job validation tests
    const mockSkydivingOption = {
      id: 'skydiving',
      name: 'Skydiving',
      description: 'Skydiving camping option',
      enabled: true,
      workShiftsRequired: 1, // Requires 1 camping job
      participantDues: 600,
      staffDues: 600,
      maxSignups: 60,
      currentRegistrations: 10,
      createdAt: '2025-05-01T00:00:00Z',
      updatedAt: '2025-05-01T00:00:00Z',
      jobCategoryIds: ['artCar', 'manifest'],
    };

    const mockTeardownCategory = {
      id: 'teardown',
      name: 'Teardown',
      description: 'Help with camp breakdown and mooping',
      alwaysRequired: true, // Always required
      staffOnly: false,
    };

    const mockArtCarCategory = {
      id: 'artCar',
      name: 'Art Car Driver',
      description: 'Driving the art car',
      alwaysRequired: false,
      staffOnly: false,
    };

    const mockManifestCategory = {
      id: 'manifest',
      name: 'Manifest Assistant',
      description: 'Working at manifest',
      alwaysRequired: false,
      staffOnly: false,
    };

    const mockTeardownJob1 = {
      id: 'teardown1',
      name: 'Teardown Team 1',
      categoryId: 'teardown',
      shiftId: 'shift1',
      category: mockTeardownCategory,
      maxRegistrations: 50,
      currentRegistrations: 10,
      location: 'Entire Camp',
    };

    const mockTeardownJob2 = {
      id: 'teardown2',
      name: 'Teardown Team 2',
      categoryId: 'teardown',
      shiftId: 'shift2',
      category: mockTeardownCategory,
      maxRegistrations: 20,
      currentRegistrations: 5,
      location: 'Entire Camp',
    };

    const mockArtCarJob = {
      id: 'artcar1',
      name: 'Art Car Driver - Wednesday AM',
      categoryId: 'artCar',
      shiftId: 'shift1',
      category: mockArtCarCategory,
      maxRegistrations: 2,
      currentRegistrations: 0,
      location: 'Between Camp and Airport',
    };

    const mockManifestJob = {
      id: 'manifest1',
      name: 'Manifest Assistant - Wednesday AM',
      categoryId: 'manifest',
      shiftId: 'shift1',
      category: mockManifestCategory,
      maxRegistrations: 3,
      currentRegistrations: 1,
      location: 'Manifest',
    };

    beforeEach(() => {
      // Override mocks for job validation tests
      vi.spyOn(useRegistrationModule, 'useRegistration').mockReturnValue({
        campingOptions: [mockSkydivingOption],
        jobCategories: [mockTeardownCategory, mockArtCarCategory, mockManifestCategory],
        jobs: [mockTeardownJob1, mockTeardownJob2, mockArtCarJob, mockManifestJob],
        shifts: mockShifts,
        loading: false,
        error: null,
        fetchCampingOptions: vi.fn(),
        fetchJobCategories: vi.fn(),
        fetchShifts: vi.fn(),
        fetchJobs: vi.fn(),
        submitRegistration: vi.fn().mockResolvedValue({}),
      });
      
      // Mock useCampingOptions to return no custom fields for easier testing
      vi.spyOn(useCampingOptionsModule, 'useCampingOptions').mockReturnValue({
        options: [],
        selectedOption: null,
        fields: [], // No custom fields for job validation tests
        loading: false,
        error: null,
        loadCampingOptions: vi.fn(),
        loadCampingOption: vi.fn(),
        createCampingOption: vi.fn(),
        updateCampingOption: vi.fn(),
        deleteCampingOption: vi.fn(),
        loadCampingOptionFields: vi.fn().mockResolvedValue([]), // Return empty array
        createCampingOptionField: vi.fn(),
        updateCampingOptionField: vi.fn(),
        deleteCampingOptionField: vi.fn(),
      });
    });

    const navigateToJobsStep = async () => {
      renderWithAuth();
      
      // Step 1: Fill profile form
      fireEvent.change(screen.getByLabelText('First Name*'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Last Name*'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Phone Number*'), { target: { value: '555-1234' } });
      fireEvent.change(screen.getByLabelText('Emergency Contact(s)*'), { target: { value: 'Emergency Contact' } });
      fireEvent.click(screen.getByText('Continue'));
      
      // Step 2: Select camping option
      await waitFor(() => {
        expect(screen.getByText('Select Camping Options')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByLabelText(/Skydiving/));
      fireEvent.click(screen.getByText('Continue'));
      
      // Step 3: Handle custom fields step (should show "No additional information" since we mocked no fields)
      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
      });
      
      // Should show "No additional information is required" message
      expect(screen.getByText('No additional information is required for your selected camping options.')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Continue'));
      
      // Step 4: Now on jobs step
      await waitFor(() => {
        expect(screen.getByText('Select Work Shifts')).toBeInTheDocument();
      });
    };

    it('should enforce both camping option jobs and always required jobs separately', async () => {
      await navigateToJobsStep();
      
      // Should see both camping option jobs and always required jobs
      expect(screen.getByText('Camp Shifts: 1 required')).toBeInTheDocument();
      expect(screen.getByText('Additional Shifts: 1 required')).toBeInTheDocument();
      
      // Try to continue without selecting any jobs
      fireEvent.click(screen.getByText('Continue'));
      
      // Should show validation errors
      await waitFor(() => {
        expect(screen.getAllByText('You need to select at least 2 shifts')).toHaveLength(2);
        expect(screen.getAllByText('You must select at least 1 Skydiving work shift')).toHaveLength(2);
        expect(screen.getAllByText('You must select at least one Teardown shift')).toHaveLength(2);
      });
    });

    it('should reject selection of only teardown jobs when camping jobs are required', async () => {
      await navigateToJobsStep();
      
      // Select two teardown jobs but no camping jobs
      fireEvent.click(screen.getByLabelText(/Teardown Team 1/));
      fireEvent.click(screen.getByLabelText(/Teardown Team 2/));
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should show camping job validation error
      await waitFor(() => {
        expect(screen.getAllByText('You must select at least 1 Skydiving work shift')).toHaveLength(2);
      });
      
      // Should NOT show teardown error (since we selected teardown jobs)
      expect(screen.queryByText('You must select at least one Teardown shift')).not.toBeInTheDocument();
    });

    it('should reject selection of only camping jobs when teardown is required', async () => {
      await navigateToJobsStep();
      
      // First expand the Art Car Driver category to make jobs visible
      const allButtons = screen.getAllByRole('button');
      const artCarButton = allButtons.find(button => button.textContent?.includes('Art Car Driver'));
      
      expect(artCarButton).toBeDefined();
      
      // Expand Art Car Driver category
      fireEvent.click(artCarButton!);
      await waitFor(() => {
        expect(screen.getByLabelText(/Art Car Driver/)).toBeInTheDocument();
      });
      
      // Select one camping job but no teardown jobs (sufficient to test the validation)
      fireEvent.click(screen.getByLabelText(/Art Car Driver/));
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should show teardown validation error
      await waitFor(() => {
        expect(screen.getAllByText('You must select at least one Teardown shift')).toHaveLength(2);
      });
      
      // Should NOT show camping job error (since we selected enough camping jobs)
      expect(screen.queryByText('You must select at least 1 Skydiving work shift')).not.toBeInTheDocument();
    });

    it('should accept valid selection of both camping and teardown jobs', async () => {
      await navigateToJobsStep();
      
      // Expand the Art Car Driver category to select camping job (Teardown should auto-expand)
      const allButtons = screen.getAllByRole('button');
      const artCarButton = allButtons.find(button => button.textContent?.includes('Art Car Driver'));
      expect(artCarButton).toBeDefined();
      fireEvent.click(artCarButton!);
      
      // Wait for the categories to expand and jobs to be visible (Teardown auto-expands as always-required)
      await waitFor(() => {
        expect(screen.getByLabelText(/Art Car Driver/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Teardown Team 1/)).toBeInTheDocument();
      });
      
      // Select one camping job and one teardown job
      fireEvent.click(screen.getByLabelText(/Art Car Driver/));
      fireEvent.click(screen.getByLabelText(/Teardown Team 1/));
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should proceed to next step without validation errors
      await waitFor(() => {
        expect(screen.getByText('Review & Accept Terms')).toBeInTheDocument();
      });
      
      // Should not show any job validation errors
      expect(screen.queryByText('You must select at least 1 Skydiving work shift')).not.toBeInTheDocument();
      expect(screen.queryByText('You must select at least one Teardown shift')).not.toBeInTheDocument();
    });

    it('should handle camping options with multiple work shifts required', async () => {
      // Mock camping option that requires 2 work shifts
      const multiShiftOption = {
        ...mockSkydivingOption,
        workShiftsRequired: 2,
      };
      
      vi.spyOn(useRegistrationModule, 'useRegistration').mockReturnValue({
        campingOptions: [multiShiftOption],
        jobCategories: [mockTeardownCategory, mockArtCarCategory, mockManifestCategory],
        jobs: [mockTeardownJob1, mockTeardownJob2, mockArtCarJob, mockManifestJob],
        shifts: mockShifts,
        loading: false,
        error: null,
        fetchCampingOptions: vi.fn(),
        fetchJobCategories: vi.fn(),
        fetchShifts: vi.fn(),
        fetchJobs: vi.fn(),
        submitRegistration: vi.fn().mockResolvedValue({}),
      });
      
      await navigateToJobsStep();
      
      // Should show updated requirement
      expect(screen.getByText('Camp Shifts: 2 required')).toBeInTheDocument();
      
      // Expand camping job categories (teardown should auto-expand as always-required)
      const allButtons = screen.getAllByRole('button');
      const artCarButton = allButtons.find(button => button.textContent?.includes('Art Car Driver'));
      const manifestButton = allButtons.find(button => button.textContent?.includes('Manifest Assistant'));
      
      expect(artCarButton).toBeDefined();
      expect(manifestButton).toBeDefined();
      
      fireEvent.click(artCarButton!);
      fireEvent.click(manifestButton!);
      
      // Wait for jobs to be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/Art Car Driver/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Teardown Team 1/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Manifest Assistant/)).toBeInTheDocument();
      });
      
      // Select only one camping job and one teardown job
      fireEvent.click(screen.getByLabelText(/Art Car Driver/));
      fireEvent.click(screen.getByLabelText(/Teardown Team 1/));
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should show camping job validation error for insufficient camping jobs
      await waitFor(() => {
        expect(screen.getAllByText('You must select at least 2 Skydiving work shifts')).toHaveLength(2);
      });
      
              // First need to expand the Manifest Assistant category
        const buttons = screen.getAllByRole('button');
        const manifestBtn = buttons.find(button => button.textContent?.includes('Manifest Assistant'));
        expect(manifestBtn).toBeDefined();
        fireEvent.click(manifestBtn!);
      
      // Wait for the category to expand
      await waitFor(() => {
        expect(screen.getByLabelText(/Manifest Assistant/)).toBeInTheDocument();
      });
      
      // Add another camping job
      fireEvent.click(screen.getByLabelText(/Manifest Assistant/));
      
      // Try to continue again
      fireEvent.click(screen.getByText('Continue'));
      
      // Should now proceed successfully
      await waitFor(() => {
        expect(screen.getByText('Review & Accept Terms')).toBeInTheDocument();
      });
    });

    it('should handle multiple always required categories', async () => {
      // Add another always required category
      const mockSecondRequiredCategory = {
        id: 'security',
        name: 'Security',
        description: 'Security duties',
        alwaysRequired: true,
        staffOnly: false,
      };
      
      const mockSecurityJob = {
        id: 'security1',
        name: 'Security Patrol',
        categoryId: 'security',
        shiftId: 'shift1',
        category: mockSecondRequiredCategory,
        maxRegistrations: 5,
        currentRegistrations: 2,
        location: 'Camp Perimeter',
      };
      
      vi.spyOn(useRegistrationModule, 'useRegistration').mockReturnValue({
        campingOptions: [mockSkydivingOption],
        jobCategories: [mockTeardownCategory, mockSecondRequiredCategory, mockArtCarCategory, mockManifestCategory],
        jobs: [mockTeardownJob1, mockTeardownJob2, mockSecurityJob, mockArtCarJob, mockManifestJob],
        shifts: mockShifts,
        loading: false,
        error: null,
        fetchCampingOptions: vi.fn(),
        fetchJobCategories: vi.fn(),
        fetchShifts: vi.fn(),
        fetchJobs: vi.fn(),
        submitRegistration: vi.fn().mockResolvedValue({}),
      });
      
      await navigateToJobsStep();
      
      // Should show 2 required additional shifts
      expect(screen.getByText('Additional Shifts: 2 required')).toBeInTheDocument();
      
      // Expand camping job categories (teardown and security should auto-expand as always-required)
      const allButtons = screen.getAllByRole('button');
      const artCarButton = allButtons.find(button => button.textContent?.includes('Art Car Driver'));
      
      expect(artCarButton).toBeDefined();
      
      fireEvent.click(artCarButton!);
      
      // Wait for jobs to be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/Art Car Driver/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Teardown Team 1/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Security Patrol/)).toBeInTheDocument();
      });
      
      // Select camping job and only one required job
      fireEvent.click(screen.getByLabelText(/Art Car Driver/));
      fireEvent.click(screen.getByLabelText(/Teardown Team 1/));
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should show validation error for missing security job
      await waitFor(() => {
        expect(screen.getAllByText('You must select at least one Security shift')).toHaveLength(2);
      });
      
      // Add security job
      fireEvent.click(screen.getByLabelText(/Security Patrol/));
      
      // Try to continue again
      fireEvent.click(screen.getByText('Continue'));
      
      // Should now proceed successfully
      await waitFor(() => {
        expect(screen.getByText('Review & Accept Terms')).toBeInTheDocument();
      });
    });

    it('should handle multiple camping options with different work shift requirements', async () => {
      // Mock multiple camping options with different requirements
      const multipleOptions = [
        {
          ...mockSkydivingOption,
          id: 'skydiving',
          name: 'Skydiving',
          workShiftsRequired: 1,
        },
        {
          ...mockSkydivingOption,
          id: 'premium',
          name: 'Premium Camping',
          workShiftsRequired: 2,
        }
      ];
      
      vi.spyOn(useRegistrationModule, 'useRegistration').mockReturnValue({
        campingOptions: multipleOptions,
        jobCategories: [mockTeardownCategory, mockArtCarCategory, mockManifestCategory],
        jobs: [mockTeardownJob1, mockTeardownJob2, mockArtCarJob, mockManifestJob],
        shifts: mockShifts,
        loading: false,
        error: null,
        fetchCampingOptions: vi.fn(),
        fetchJobCategories: vi.fn(),
        fetchShifts: vi.fn(),
        fetchJobs: vi.fn(),
        submitRegistration: vi.fn().mockResolvedValue({}),
      });
      
      renderWithAuth();
      
      // Step 1: Fill profile form
      fireEvent.change(screen.getByLabelText('First Name*'), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText('Last Name*'), { target: { value: 'User' } });
      fireEvent.change(screen.getByLabelText('Phone Number*'), { target: { value: '555-1234' } });
      fireEvent.change(screen.getByLabelText('Emergency Contact(s)*'), { target: { value: 'Emergency Contact' } });
      fireEvent.click(screen.getByText('Continue'));
      
      // Step 2: Select both camping options
      await waitFor(() => {
        expect(screen.getByText('Select Camping Options')).toBeInTheDocument();
      });
      
      // Get all checkboxes and select the first two (Skydiving and Premium Camping)
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Skydiving
      fireEvent.click(checkboxes[1]); // Premium Camping
      fireEvent.click(screen.getByText('Continue'));
      
      // Step 3: Handle custom fields step
      await waitFor(() => {
        expect(screen.getByText('Additional Information')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Continue'));
      
      // Step 4: Now on jobs step
      await waitFor(() => {
        expect(screen.getByText('Select Work Shifts')).toBeInTheDocument();
      });
      
      // Should show updated requirement (1 + 2 = 3 camping shifts required)
      expect(screen.getByText('Camp Shifts: 3 required')).toBeInTheDocument();
      
      // Expand the camping job categories (teardown should auto-expand as always-required)
      const allButtons = screen.getAllByRole('button');
      const artCarButton = allButtons.find(button => button.textContent?.includes('Art Car Driver'));
      const manifestButton = allButtons.find(button => button.textContent?.includes('Manifest Assistant'));
      
      expect(artCarButton).toBeDefined();
      expect(manifestButton).toBeDefined();
      
      // Click camping job category buttons to expand them
      await act(async () => {
        fireEvent.click(artCarButton!);
      });
      
      await act(async () => {
        fireEvent.click(manifestButton!);
      });
      
      // Wait for jobs to be visible (Teardown should already be expanded due to auto-expansion)
      await waitFor(() => {
        expect(screen.getByLabelText(/Art Car Driver/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Teardown Team 1/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Manifest Assistant/)).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Select only teardown job but no camping jobs
      fireEvent.click(screen.getByLabelText(/Teardown Team 1/));
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should show detailed camping job validation error for multiple options
      await waitFor(() => {
        expect(screen.getAllByText('You must select at least 1 Skydiving work shift and 2 Premium Camping work shifts')).toHaveLength(2);
      });
    });
  });
});

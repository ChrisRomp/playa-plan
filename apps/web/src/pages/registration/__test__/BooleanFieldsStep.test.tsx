import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RegistrationPage from '../RegistrationPage';
import { AuthContext } from '../../../store/authUtils';
import * as useRegistrationModule from '../../../hooks/useRegistration';
import * as useCampingOptionsModule from '../../../hooks/useCampingOptions';
import * as useProfileModule from '../../../hooks/useProfile';
import * as useCampRegistrationModule from '../../../hooks/useCampRegistration';
import * as useConfigModule from '../../../hooks/useConfig';

// Mock modules
vi.mock('../../../hooks/useRegistration');
vi.mock('../../../hooks/useCampingOptions');
vi.mock('../../../hooks/useProfile');
vi.mock('../../../hooks/useCampRegistration');
vi.mock('../../../store/ConfigContext');

describe('Boolean Fields Step', () => {
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

  // Mock camping option
  const mockCampingOption = {
    id: 'option1',
    name: 'Standard Camping',
    description: 'Basic camping option',
    enabled: true,
    workShiftsRequired: 0,
    participantDues: 100,
    staffDues: 50,
    maxSignups: 10,
    currentRegistrations: 5,
    createdAt: '2025-05-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    jobCategoryIds: [],
  };

  // Mock boolean custom fields
  const mockRequiredBooleanField = {
    id: 'field1',
    displayName: 'Agree to Terms',
    description: 'Do you agree to our special terms?',
    dataType: 'BOOLEAN' as const,
    required: true,
    campingOptionId: 'option1',
    createdAt: '2025-05-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    minValue: null,
    maxValue: null,
    maxLength: null,
    order: 1,
  };

  const mockOptionalBooleanField = {
    id: 'field2',
    displayName: 'Newsletter Subscription',
    description: 'Would you like to receive our newsletter?',
    dataType: 'BOOLEAN' as const,
    required: false,
    campingOptionId: 'option1',
    createdAt: '2025-05-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    minValue: null,
    maxValue: null,
    maxLength: null,
    order: 2,
  };

  // Setup mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // Mock useRegistration hook
    vi.spyOn(useRegistrationModule, 'useRegistration').mockReturnValue({
      campingOptions: [mockCampingOption],
      jobCategories: [],
      jobs: [],
      shifts: [],
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
      fields: [mockRequiredBooleanField, mockOptionalBooleanField],
      loading: false,
      error: null,
      loadCampingOptions: vi.fn(),
      loadCampingOption: vi.fn(),
      createCampingOption: vi.fn(),
      updateCampingOption: vi.fn(),
      deleteCampingOption: vi.fn(),
      loadCampingOptionFields: vi.fn().mockResolvedValue([mockRequiredBooleanField, mockOptionalBooleanField]),
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
        registrationTerms: '<p>These are the test terms and conditions.</p>',
      },
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
      isConnecting: false,
      isConnected: true,
      connectionError: null,
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
            isAuthenticated,
            isConnecting: false,
            isConnected: true,
            connectionError: null,
          }}
        >
          <RegistrationPage />
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  const navigateToCustomFieldsStep = async () => {
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
    
    const campingCheckboxes = screen.getAllByRole('checkbox');
    if (campingCheckboxes.length > 0) {
      fireEvent.click(campingCheckboxes[0]);
    }
    fireEvent.click(screen.getByText('Continue'));
    
    // Step 3: Now on custom fields step
    await waitFor(() => {
      expect(screen.getByText('Additional Information')).toBeInTheDocument();
    });
  };

  describe('Boolean Field Rendering', () => {
    it('should render boolean fields as radio buttons for Yes/No choice', async () => {
      await navigateToCustomFieldsStep();

      // Check that both boolean fields are present
      expect(screen.getByText('Agree to Terms')).toBeInTheDocument();
      expect(screen.getByText('Newsletter Subscription')).toBeInTheDocument();
      
      // Check for required field indicator
      expect(screen.getByText('*')).toBeInTheDocument();
      
      // Check for descriptions
      expect(screen.getByText('Do you agree to our special terms?')).toBeInTheDocument();
      expect(screen.getByText('Would you like to receive our newsletter?')).toBeInTheDocument();

      // For each boolean field, there should be Yes/No radio buttons
      const yesRadios = screen.getAllByLabelText(/Yes/);
      const noRadios = screen.getAllByLabelText(/No/);
      
      expect(yesRadios).toHaveLength(2); // One for each boolean field
      expect(noRadios).toHaveLength(2);   // One for each boolean field
      
      // Check that radio buttons are grouped by field (same name attribute)
      expect(yesRadios[0]).toHaveAttribute('name', 'field_field1');
      expect(noRadios[0]).toHaveAttribute('name', 'field_field1');
      expect(yesRadios[1]).toHaveAttribute('name', 'field_field2');
      expect(noRadios[1]).toHaveAttribute('name', 'field_field2');
    });

    it('should not have any radio button selected by default', async () => {
      await navigateToCustomFieldsStep();

      const yesRadios = screen.getAllByLabelText(/Yes/);
      const noRadios = screen.getAllByLabelText(/No/);
      
      // None should be checked initially
      yesRadios.forEach(radio => expect(radio).not.toBeChecked());
      noRadios.forEach(radio => expect(radio).not.toBeChecked());
    });

    it('should allow selecting Yes or No for each field independently', async () => {
      await navigateToCustomFieldsStep();

      const yesRadios = screen.getAllByLabelText(/Yes/);
      const noRadios = screen.getAllByLabelText(/No/);
      
      // Select Yes for first field, No for second field
      fireEvent.click(yesRadios[0]);
      fireEvent.click(noRadios[1]);
      
      // Check selections
      expect(yesRadios[0]).toBeChecked();
      expect(noRadios[0]).not.toBeChecked();
      expect(yesRadios[1]).not.toBeChecked();
      expect(noRadios[1]).toBeChecked();
    });

    it('should allow changing selection within the same field', async () => {
      await navigateToCustomFieldsStep();

      const yesRadios = screen.getAllByLabelText(/Yes/);
      const noRadios = screen.getAllByLabelText(/No/);
      
      // Select Yes for first field
      fireEvent.click(yesRadios[0]);
      expect(yesRadios[0]).toBeChecked();
      expect(noRadios[0]).not.toBeChecked();
      
      // Change to No for first field
      fireEvent.click(noRadios[0]);
      expect(yesRadios[0]).not.toBeChecked();
      expect(noRadios[0]).toBeChecked();
    });
  });

  describe('Boolean Field Validation', () => {
    it('should show validation error for required boolean field when not selected', async () => {
      await navigateToCustomFieldsStep();

      // Try to continue without selecting required boolean field
      fireEvent.click(screen.getByText('Continue'));
      
      await waitFor(() => {
        expect(screen.getByText('Agree to Terms is required')).toBeInTheDocument();
      });
    });

    it('should not show validation error for optional boolean field when not selected', async () => {
      await navigateToCustomFieldsStep();

      const yesRadios = screen.getAllByLabelText(/Yes/);
      
      // Select required field but leave optional field unselected
      fireEvent.click(yesRadios[0]); // Required field
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should not show error for optional field, should proceed
      await waitFor(() => {
        expect(screen.getByText('Select Work Shifts')).toBeInTheDocument();
      });
    });

    it('should allow proceeding when required boolean field is selected', async () => {
      await navigateToCustomFieldsStep();

      const yesRadios = screen.getAllByLabelText(/Yes/);
      
      // Select required field
      fireEvent.click(yesRadios[0]);
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should proceed to next step
      await waitFor(() => {
        expect(screen.getByText('Select Work Shifts')).toBeInTheDocument();
      });
    });

    it('should allow proceeding when required boolean field is selected as No', async () => {
      await navigateToCustomFieldsStep();

      const noRadios = screen.getAllByLabelText(/No/);
      
      // Select No for required field (this should be valid)
      fireEvent.click(noRadios[0]);
      
      // Try to continue
      fireEvent.click(screen.getByText('Continue'));
      
      // Should proceed to next step
      await waitFor(() => {
        expect(screen.getByText('Select Work Shifts')).toBeInTheDocument();
      });
    });
  });
});
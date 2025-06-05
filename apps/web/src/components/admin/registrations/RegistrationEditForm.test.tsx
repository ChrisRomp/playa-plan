import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegistrationEditForm from './RegistrationEditForm';

// Mock dependencies
vi.mock('../../common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>
}));

describe('RegistrationEditForm', () => {
  const mockRegistration = {
    id: 'reg-1',
    year: 2024,
    status: 'CONFIRMED' as const,
    createdAt: '2024-01-01T10:00:00Z',
    user: {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      playaName: 'JohnnyPlaya',
      role: 'participant',
    },
    jobs: [
      {
        id: 'reg-job-1',
        job: {
          id: 'job-1',
          name: 'Kitchen Helper',
          category: {
            name: 'Kitchen',
          },
          shift: {
            name: 'Morning Shift',
            startTime: '09:00',
            endTime: '13:00',
            dayOfWeek: 'Monday',
          },
        },
      },
    ],
    campingOptions: [
      {
        id: 'camp-reg-1',
        campingOption: {
          id: 'camp-1',
          name: 'Basic Camping',
          description: 'Basic camping spot',
          pricePerPerson: 100,
        },
      },
    ],
  };

  const mockAvailableJobs = [
    {
      id: 'job-1',
      name: 'Kitchen Helper',
      category: {
        name: 'Kitchen',
      },
      shift: {
        name: 'Morning Shift',
        startTime: '09:00',
        endTime: '13:00',
        dayOfWeek: 'Monday',
      },
      description: 'Help in the kitchen',
    },
    {
      id: 'job-2',
      name: 'Cleanup Crew',
      category: {
        name: 'Maintenance',
      },
      shift: {
        name: 'Evening Shift',
        startTime: '18:00',
        endTime: '22:00',
        dayOfWeek: 'Tuesday',
      },
      description: 'Help with cleanup',
    },
  ];

  const mockAvailableCampingOptions = [
    {
      id: 'camp-1',
      name: 'Basic Camping',
      description: 'Basic camping spot',
      enabled: true,
      workShiftsRequired: 2,
      participantDues: 100,
      staffDues: 50,
      maxSignups: 50,
      currentRegistrations: 20,
      availabilityStatus: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'camp-2',
      name: 'Premium Camping',
      description: 'Premium camping with amenities',
      enabled: true,
      workShiftsRequired: 1,
      participantDues: 200,
      staffDues: 100,
      maxSignups: 25,
      currentRegistrations: 10,
      availabilityStatus: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const defaultProps = {
    registration: mockRegistration,
    availableJobs: mockAvailableJobs,
    availableCampingOptions: mockAvailableCampingOptions,
    loading: false,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render correctly with current registration data', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      // Check header
      expect(screen.getByText('Edit Registration')).toBeInTheDocument();
      expect(screen.getByText('John Doe (test@example.com)')).toBeInTheDocument();

      // Check status section
      expect(screen.getByText('Registration Status')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CONFIRMED')).toBeChecked();

      // Check work shifts section
      expect(screen.getByText('Work Shifts')).toBeInTheDocument();
      expect(screen.getByLabelText(/Kitchen Helper/)).toBeChecked();

      // Check camping options section
      expect(screen.getByText('Camping Options')).toBeInTheDocument();
      expect(screen.getByLabelText(/Basic Camping/)).toBeChecked();

      // Check notification toggle
      expect(screen.getByLabelText(/Send notification email to user about these changes/)).not.toBeChecked();
    });

    it('should show cancelled registration message for cancelled registrations', () => {
      const cancelledRegistration = {
        ...mockRegistration,
        status: 'CANCELLED' as const,
      };

      render(<RegistrationEditForm {...defaultProps} registration={cancelledRegistration} />);

      expect(screen.getByText('Cannot Edit Registration')).toBeInTheDocument();
      expect(screen.getByText('This registration has been cancelled and cannot be edited.')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('should show loading spinner when loading is true', () => {
      render(<RegistrationEditForm {...defaultProps} loading={true} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show no jobs available message when availableJobs is empty', () => {
      render(<RegistrationEditForm {...defaultProps} availableJobs={[]} />);

      expect(screen.getByText('No jobs available')).toBeInTheDocument();
    });

    it('should show no camping options available message when availableCampingOptions is empty', () => {
      render(<RegistrationEditForm {...defaultProps} availableCampingOptions={[]} />);

      expect(screen.getByText('No camping options available')).toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('should handle status changes', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const pendingRadio = screen.getByDisplayValue('PENDING');
      fireEvent.click(pendingRadio);

      expect(pendingRadio).toBeChecked();
      expect(screen.getByDisplayValue('CONFIRMED')).not.toBeChecked();
    });

    it('should handle job selection changes', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const cleanupJobCheckbox = screen.getByLabelText(/Cleanup Crew/);
      fireEvent.click(cleanupJobCheckbox);

      expect(cleanupJobCheckbox).toBeChecked();

      // Should show both selected jobs - use getAllByText to handle multiple instances
      const kitchenHelperElements = screen.getAllByText('Kitchen Helper');
      expect(kitchenHelperElements.length).toBeGreaterThan(0);
      const cleanupCrewElements = screen.getAllByText('Cleanup Crew');
      expect(cleanupCrewElements.length).toBeGreaterThan(0);
    });

    it('should handle job deselection', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const kitchenJobCheckbox = screen.getByLabelText(/Kitchen Helper/);
      fireEvent.click(kitchenJobCheckbox);

      expect(kitchenJobCheckbox).not.toBeChecked();
    });

    it('should handle camping option changes', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const premiumCampingCheckbox = screen.getByLabelText(/Premium Camping/);
      fireEvent.click(premiumCampingCheckbox);

      expect(premiumCampingCheckbox).toBeChecked();

      // Should show both selected camping options - use getAllByText to handle multiple instances
      const basicCampingElements = screen.getAllByText('Basic Camping');
      expect(basicCampingElements.length).toBeGreaterThan(0);
      const premiumCampingElements = screen.getAllByText('Premium Camping');
      expect(premiumCampingElements.length).toBeGreaterThan(0);
    });

    it('should handle camping option deselection', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const basicCampingCheckbox = screen.getByLabelText(/Basic Camping/);
      fireEvent.click(basicCampingCheckbox);

      expect(basicCampingCheckbox).not.toBeChecked();
    });

    it('should handle notification toggle', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const notificationCheckbox = screen.getByLabelText(/Send notification email to user about these changes/);
      fireEvent.click(notificationCheckbox);

      expect(notificationCheckbox).toBeChecked();
    });

    it('should handle notes input', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const notesTextarea = screen.getByLabelText(/Notes/);
      fireEvent.change(notesTextarea, { target: { value: 'Test notes' } });

      expect(notesTextarea).toHaveValue('Test notes');
    });

    it('should handle close button click', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      // Find the X button by looking for the button in the header section
      const header = screen.getByText('Edit Registration').closest('.flex');
      const closeButton = header?.querySelector('button[type="button"]');
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation', () => {
    it('should show error when no changes are made', async () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('No changes made')).toBeInTheDocument();
      });

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('should handle CANCELLED status properly (not available in edit form)', () => {
      // CANCELLED status is not available as an option in the form
      render(<RegistrationEditForm {...defaultProps} />);

      // Should only have PENDING, CONFIRMED, WAITLISTED
      expect(screen.getByDisplayValue('PENDING')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CONFIRMED')).toBeInTheDocument();
      expect(screen.getByDisplayValue('WAITLISTED')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('CANCELLED')).not.toBeInTheDocument();
    });

    it('should enable save button when changes are made', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).toBeDisabled();

      // Make a change
      const pendingRadio = screen.getByDisplayValue('PENDING');
      fireEvent.click(pendingRadio);

      expect(saveButton).toBeEnabled();
    });
  });

  describe('Form Submission', () => {
    it('should submit form with correct data when valid changes are made', async () => {
      render(<RegistrationEditForm {...defaultProps} />);

      // Make changes
      const pendingRadio = screen.getByDisplayValue('PENDING');
      fireEvent.click(pendingRadio);

      const cleanupJobCheckbox = screen.getByLabelText(/Cleanup Crew/);
      fireEvent.click(cleanupJobCheckbox);

      const premiumCampingCheckbox = screen.getByLabelText(/Premium Camping/);
      fireEvent.click(premiumCampingCheckbox);

      const notificationCheckbox = screen.getByLabelText(/Send notification email to user about these changes/);
      fireEvent.click(notificationCheckbox);

      const notesTextarea = screen.getByLabelText(/Notes/);
      fireEvent.change(notesTextarea, { target: { value: 'Updated by admin' } });

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
          status: 'PENDING',
          jobIds: ['job-1', 'job-2'],
          campingOptionIds: ['camp-1', 'camp-2'],
          notes: 'Updated by admin',
          sendNotification: true,
        });
      });
    });

    it('should show loading state during submission', () => {
      render(<RegistrationEditForm {...defaultProps} loading={true} />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeDisabled();
    });

    it('should handle job removal via chip close button', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      // First add another job to see the chips
      const cleanupJobCheckbox = screen.getByLabelText(/Cleanup Crew/);
      fireEvent.click(cleanupJobCheckbox);

      // Find the selected chips area and locate the Kitchen Helper chip specifically
      const selectedShiftsSection = screen.getByText('Selected shifts:').parentElement;
      const kitchenChips = selectedShiftsSection?.querySelectorAll('.inline-flex');
      const kitchenChip = Array.from(kitchenChips || []).find(chip => 
        chip.textContent?.includes('Kitchen Helper')
      );
      const closeButton = kitchenChip?.querySelector('button');
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      // Kitchen Helper should no longer be checked
      expect(screen.getByLabelText(/Kitchen Helper/)).not.toBeChecked();
    });

    it('should handle camping option removal via chip close button', () => {
      render(<RegistrationEditForm {...defaultProps} />);

      // First add another camping option to see the chips
      const premiumCampingCheckbox = screen.getByLabelText(/Premium Camping/);
      fireEvent.click(premiumCampingCheckbox);

      // Find the selected options area and locate the Basic Camping chip specifically
      const selectedOptionsSection = screen.getByText('Selected options:').parentElement;
      const campingChips = selectedOptionsSection?.querySelectorAll('.inline-flex');
      const basicChip = Array.from(campingChips || []).find(chip => 
        chip.textContent?.includes('Basic Camping')
      );
      const closeButton = basicChip?.querySelector('button');
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      // Basic Camping should no longer be checked
      expect(screen.getByLabelText(/Basic Camping/)).not.toBeChecked();
    });
  });

  describe('Edge Cases', () => {
    it('should handle registration without camping options', () => {
      const registrationWithoutCamping = {
        ...mockRegistration,
        campingOptions: [],
      };

      render(<RegistrationEditForm {...defaultProps} registration={registrationWithoutCamping} />);

      expect(screen.getByText('Camping Options')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Basic Camping/)).not.toBeChecked();
    });

    it('should handle registration without jobs', () => {
      const registrationWithoutJobs = {
        ...mockRegistration,
        jobs: [],
      };

      render(<RegistrationEditForm {...defaultProps} registration={registrationWithoutJobs} />);

      expect(screen.getByText('Work Shifts')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Kitchen Helper/)).not.toBeChecked();
    });

    it('should handle incomplete job data gracefully', () => {
      const jobsWithIncompleteData = [
        {
          id: 'job-3',
          name: 'Simple Job',
          description: 'Job without category or shift',
        },
      ];

      render(<RegistrationEditForm {...defaultProps} availableJobs={jobsWithIncompleteData} />);

      expect(screen.getByLabelText(/Simple Job/)).toBeInTheDocument();
    });

    it('should handle incomplete camping option data gracefully', () => {
      const campingWithIncompleteData = [
        {
          id: 'camp-3',
          name: 'Simple Camp',
          description: null,
          enabled: true,
          workShiftsRequired: 1,
          participantDues: 50,
          staffDues: 25,
          maxSignups: 20,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      render(<RegistrationEditForm {...defaultProps} availableCampingOptions={campingWithIncompleteData} />);

      expect(screen.getByLabelText(/Simple Camp/)).toBeInTheDocument();
    });
  });
}); 
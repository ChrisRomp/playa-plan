import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRegistrationManagement } from './useRegistrationManagement';
import * as adminRegistrationsApi from '../lib/api/admin-registrations';

// Mock the API
vi.mock('../lib/api/admin-registrations', () => ({
  adminRegistrationsApi: {
    editRegistration: vi.fn(),
    cancelRegistration: vi.fn(),
  },
}));

describe('useRegistrationManagement', () => {
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
    payments: [
      {
        id: 'payment-1',
        amount: 150,
        status: 'COMPLETED',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      expect(result.current.state).toEqual({
        editModalOpen: false,
        cancelModalOpen: false,
        auditTrailModalOpen: false,
        selectedRegistration: null,
        editLoading: false,
        cancelLoading: false,
        lastSuccessMessage: null,
        lastErrorMessage: null,
      });
    });
  });

  describe('Modal Management', () => {
    it('should open edit modal with registration data', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      expect(result.current.state.editModalOpen).toBe(true);
      expect(result.current.state.selectedRegistration).toEqual(mockRegistration);
      expect(result.current.state.lastSuccessMessage).toBe(null);
      expect(result.current.state.lastErrorMessage).toBe(null);
    });

    it('should open cancel modal with registration data', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      expect(result.current.state.cancelModalOpen).toBe(true);
      expect(result.current.state.selectedRegistration).toEqual(mockRegistration);
      expect(result.current.state.lastSuccessMessage).toBe(null);
      expect(result.current.state.lastErrorMessage).toBe(null);
    });

    it('should open audit trail modal with registration data', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      act(() => {
        result.current.openAuditTrailModal(mockRegistration);
      });

      expect(result.current.state.auditTrailModalOpen).toBe(true);
      expect(result.current.state.selectedRegistration).toEqual(mockRegistration);
      expect(result.current.state.lastSuccessMessage).toBe(null);
      expect(result.current.state.lastErrorMessage).toBe(null);
    });

    it('should close all modals and reset state', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      // First open a modal
      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      expect(result.current.state.editModalOpen).toBe(true);
      expect(result.current.state.selectedRegistration).not.toBe(null);

      // Then close all modals
      act(() => {
        result.current.closeAllModals();
      });

      expect(result.current.state.editModalOpen).toBe(false);
      expect(result.current.state.cancelModalOpen).toBe(false);
      expect(result.current.state.auditTrailModalOpen).toBe(false);
      expect(result.current.state.selectedRegistration).toBe(null);
      expect(result.current.state.editLoading).toBe(false);
      expect(result.current.state.cancelLoading).toBe(false);
    });

    it('should clear messages when opening modals', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      // Set some messages first
      act(() => {
        result.current.clearMessages();
      });

      // Open modal should clear messages
      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      expect(result.current.state.lastSuccessMessage).toBe(null);
      expect(result.current.state.lastErrorMessage).toBe(null);
    });
  });

  describe('Registration Edit Operations', () => {
    it('should handle successful registration edit', async () => {
      const mockEditRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.editRegistration);
      mockEditRegistration.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRegistrationManagement());

      // Set a selected registration first
      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      const editData = {
        status: 'PENDING' as const,
        jobIds: ['job-1', 'job-2'],
        campingOptionIds: ['camp-1'],
        notes: 'Updated by admin',
        sendNotification: true,
      };

      await act(async () => {
        await result.current.editRegistration(editData);
      });

      expect(mockEditRegistration).toHaveBeenCalledWith('reg-1', editData);
      expect(result.current.state.editLoading).toBe(false);
      expect(result.current.state.editModalOpen).toBe(false);
      expect(result.current.state.selectedRegistration).toBe(null);
      expect(result.current.state.lastSuccessMessage).toBe(
        'Registration for John Doe has been updated successfully.'
      );
      expect(result.current.state.lastErrorMessage).toBe(null);
    });

    it('should handle registration edit failure', async () => {
      const mockEditRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.editRegistration);
      mockEditRegistration.mockRejectedValue(new Error('Failed to update registration'));

      const { result } = renderHook(() => useRegistrationManagement());

      // Set a selected registration first
      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      const editData = {
        status: 'PENDING' as const,
        jobIds: ['job-1'],
        campingOptionIds: ['camp-1'],
        notes: 'Test notes',
        sendNotification: false,
      };

      await act(async () => {
        await result.current.editRegistration(editData);
      });

      expect(result.current.state.editLoading).toBe(false);
      expect(result.current.state.editModalOpen).toBe(true); // Should remain open on error
      expect(result.current.state.lastErrorMessage).toBe('Failed to update registration');
      expect(result.current.state.lastSuccessMessage).toBe(null);
    });

    it('should show loading state during edit operation', async () => {
      const mockEditRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.editRegistration);
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockEditRegistration.mockReturnValue(promise);

      const { result } = renderHook(() => useRegistrationManagement());

      // Set a selected registration first
      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      const editData = {
        status: 'PENDING' as const,
        jobIds: ['job-1'],
        campingOptionIds: ['camp-1'],
        notes: 'Test notes',
        sendNotification: false,
      };

      // Start the edit operation
      act(() => {
        result.current.editRegistration(editData);
      });

      expect(result.current.state.editLoading).toBe(true);
      expect(result.current.state.lastErrorMessage).toBe(null);

      // Resolve the promise
      await act(async () => {
        resolvePromise();
        await promise;
      });

      expect(result.current.state.editLoading).toBe(false);
    });

    it('should not edit when no registration is selected', async () => {
      const mockEditRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.editRegistration);

      const { result } = renderHook(() => useRegistrationManagement());

      const editData = {
        status: 'PENDING' as const,
        jobIds: ['job-1'],
        campingOptionIds: ['camp-1'],
        notes: 'Test notes',
        sendNotification: false,
      };

      await act(async () => {
        await result.current.editRegistration(editData);
      });

      expect(mockEditRegistration).not.toHaveBeenCalled();
    });
  });

  describe('Registration Cancel Operations', () => {
    it('should handle successful registration cancellation', async () => {
      const mockCancelRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.cancelRegistration);
      mockCancelRegistration.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRegistrationManagement());

      // Set a selected registration first
      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      const cancelData = {
        reason: 'User requested cancellation',
        processRefund: true,
        sendNotification: true,
      };

      await act(async () => {
        await result.current.cancelRegistration(cancelData);
      });

      expect(mockCancelRegistration).toHaveBeenCalledWith('reg-1', cancelData);
      expect(result.current.state.cancelLoading).toBe(false);
      expect(result.current.state.cancelModalOpen).toBe(false);
      expect(result.current.state.selectedRegistration).toBe(null);
      expect(result.current.state.lastSuccessMessage).toBe(
        'Registration for John Doe has been cancelled. A refund has been processed. The user has been notified.'
      );
      expect(result.current.state.lastErrorMessage).toBe(null);
    });

    it('should handle cancellation without refund or notification', async () => {
      const mockCancelRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.cancelRegistration);
      mockCancelRegistration.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRegistrationManagement());

      // Set a selected registration first
      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      const cancelData = {
        reason: 'Admin cancellation',
        processRefund: false,
        sendNotification: false,
      };

      await act(async () => {
        await result.current.cancelRegistration(cancelData);
      });

      expect(result.current.state.lastSuccessMessage).toBe(
        'Registration for John Doe has been cancelled.'
      );
    });

    it('should handle registration cancellation failure', async () => {
      const mockCancelRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.cancelRegistration);
      mockCancelRegistration.mockRejectedValue(new Error('Failed to cancel registration'));

      const { result } = renderHook(() => useRegistrationManagement());

      // Set a selected registration first
      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      const cancelData = {
        reason: 'Test cancellation',
        processRefund: false,
        sendNotification: false,
      };

      await act(async () => {
        await result.current.cancelRegistration(cancelData);
      });

      expect(result.current.state.cancelLoading).toBe(false);
      expect(result.current.state.cancelModalOpen).toBe(true); // Should remain open on error
      expect(result.current.state.lastErrorMessage).toBe('Failed to cancel registration');
      expect(result.current.state.lastSuccessMessage).toBe(null);
    });

    it('should show loading state during cancel operation', async () => {
      const mockCancelRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.cancelRegistration);
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockCancelRegistration.mockReturnValue(promise);

      const { result } = renderHook(() => useRegistrationManagement());

      // Set a selected registration first
      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      const cancelData = {
        reason: 'Test cancellation',
        processRefund: false,
        sendNotification: false,
      };

      // Start the cancel operation
      act(() => {
        result.current.cancelRegistration(cancelData);
      });

      expect(result.current.state.cancelLoading).toBe(true);
      expect(result.current.state.lastErrorMessage).toBe(null);

      // Resolve the promise
      await act(async () => {
        resolvePromise();
        await promise;
      });

      expect(result.current.state.cancelLoading).toBe(false);
    });

    it('should not cancel when no registration is selected', async () => {
      const mockCancelRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.cancelRegistration);

      const { result } = renderHook(() => useRegistrationManagement());

      const cancelData = {
        reason: 'Test cancellation',
        processRefund: false,
        sendNotification: false,
      };

      await act(async () => {
        await result.current.cancelRegistration(cancelData);
      });

      expect(mockCancelRegistration).not.toHaveBeenCalled();
    });
  });

  describe('Message Management', () => {
    it('should clear success and error messages', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      // Simulate having some messages (this would normally be set by operations)
      // For testing, we'll trigger an error first
      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      // Clear messages
      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.state.lastSuccessMessage).toBe(null);
      expect(result.current.state.lastErrorMessage).toBe(null);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-Error objects in edit operation', async () => {
      const mockEditRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.editRegistration);
      mockEditRegistration.mockRejectedValue('String error');

      const { result } = renderHook(() => useRegistrationManagement());

      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      const editData = {
        status: 'PENDING' as const,
        jobIds: ['job-1'],
        campingOptionIds: ['camp-1'],
        notes: 'Test notes',
        sendNotification: false,
      };

      await act(async () => {
        await result.current.editRegistration(editData);
      });

      expect(result.current.state.lastErrorMessage).toBe('Failed to update registration');
    });

    it('should handle non-Error objects in cancel operation', async () => {
      const mockCancelRegistration = vi.mocked(adminRegistrationsApi.adminRegistrationsApi.cancelRegistration);
      mockCancelRegistration.mockRejectedValue('String error');

      const { result } = renderHook(() => useRegistrationManagement());

      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      const cancelData = {
        reason: 'Test cancellation',
        processRefund: false,
        sendNotification: false,
      };

      await act(async () => {
        await result.current.cancelRegistration(cancelData);
      });

      expect(result.current.state.lastErrorMessage).toBe('Failed to cancel registration');
    });
  });

  describe('State Isolation', () => {
    it('should maintain separate loading states for edit and cancel', async () => {
      const { result } = renderHook(() => useRegistrationManagement());

      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      expect(result.current.state.editLoading).toBe(false);
      expect(result.current.state.cancelLoading).toBe(false);

      // Opening cancel modal shouldn't affect edit loading state
      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      expect(result.current.state.editLoading).toBe(false);
      expect(result.current.state.cancelLoading).toBe(false);
    });

    it('should not mix edit and cancel modal states', () => {
      const { result } = renderHook(() => useRegistrationManagement());

      act(() => {
        result.current.openEditModal(mockRegistration);
      });

      expect(result.current.state.editModalOpen).toBe(true);
      expect(result.current.state.cancelModalOpen).toBe(false);
      expect(result.current.state.auditTrailModalOpen).toBe(false);

      act(() => {
        result.current.openCancelModal(mockRegistration);
      });

      expect(result.current.state.editModalOpen).toBe(false);
      expect(result.current.state.cancelModalOpen).toBe(true);
      expect(result.current.state.auditTrailModalOpen).toBe(false);

      act(() => {
        result.current.openAuditTrailModal(mockRegistration);
      });

      expect(result.current.state.editModalOpen).toBe(false);
      expect(result.current.state.cancelModalOpen).toBe(false);
      expect(result.current.state.auditTrailModalOpen).toBe(true);
    });
  });
}); 
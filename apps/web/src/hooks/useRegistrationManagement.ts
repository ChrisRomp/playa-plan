import { useState, useCallback } from 'react';
import { adminRegistrationsApi } from '../lib/api/admin-registrations';

// TODO: Replace with actual API types when implemented
interface Registration {
  id: string;
  year: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    playaName?: string;
    role: string;
  };
  jobs: Array<{
    id: string;
    job: {
      id: string;
      name: string;
      category?: {
        name: string;
      };
    };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
  }>;
}

interface RegistrationEditData {
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
  jobIds: string[];
  campingOptionIds: string[];
  notes: string;
  sendNotification: boolean;
}

interface RegistrationCancelData {
  reason: string;
  sendNotification: boolean;
  processRefund: boolean;
}

interface RegistrationManagementState {
  // Modal states
  editModalOpen: boolean;
  cancelModalOpen: boolean;
  auditTrailModalOpen: boolean;
  
  // Current registration being operated on
  selectedRegistration: Registration | null;
  
  // Loading states
  editLoading: boolean;
  cancelLoading: boolean;
  
  // Success/error states
  lastSuccessMessage: string | null;
  lastErrorMessage: string | null;
}

interface UseRegistrationManagementReturn {
  // State
  state: RegistrationManagementState;
  
  // Modal actions
  openEditModal: (registration: Registration) => void;
  openCancelModal: (registration: Registration) => void;
  openAuditTrailModal: (registration: Registration) => void;
  closeAllModals: () => void;
  
  // Registration actions
  editRegistration: (data: RegistrationEditData) => Promise<void>;
  cancelRegistration: (data: RegistrationCancelData) => Promise<void>;
  
  // Message actions
  clearMessages: () => void;
}

/**
 * Custom hook for managing registration operations
 * Handles modal states, API calls, and success/error messaging
 */
export function useRegistrationManagement(): UseRegistrationManagementReturn {
  const [state, setState] = useState<RegistrationManagementState>({
    editModalOpen: false,
    cancelModalOpen: false,
    auditTrailModalOpen: false,
    selectedRegistration: null,
    editLoading: false,
    cancelLoading: false,
    lastSuccessMessage: null,
    lastErrorMessage: null,
  });

  // Modal management
  const openEditModal = useCallback((registration: Registration) => {
    setState(prev => ({
      ...prev,
      selectedRegistration: registration,
      editModalOpen: true,
      lastSuccessMessage: null,
      lastErrorMessage: null,
    }));
  }, []);

  const openCancelModal = useCallback((registration: Registration) => {
    setState(prev => ({
      ...prev,
      selectedRegistration: registration,
      cancelModalOpen: true,
      lastSuccessMessage: null,
      lastErrorMessage: null,
    }));
  }, []);

  const openAuditTrailModal = useCallback((registration: Registration) => {
    setState(prev => ({
      ...prev,
      selectedRegistration: registration,
      auditTrailModalOpen: true,
      lastSuccessMessage: null,
      lastErrorMessage: null,
    }));
  }, []);

  const closeAllModals = useCallback(() => {
    setState(prev => ({
      ...prev,
      editModalOpen: false,
      cancelModalOpen: false,
      auditTrailModalOpen: false,
      selectedRegistration: null,
      editLoading: false,
      cancelLoading: false,
    }));
  }, []);

  // Registration operations
  const editRegistration = useCallback(async (data: RegistrationEditData) => {
    if (!state.selectedRegistration) return;

    setState(prev => ({ ...prev, editLoading: true, lastErrorMessage: null }));

    try {
      await adminRegistrationsApi.editRegistration(state.selectedRegistration.id, data);
      
      setState(prev => ({
        ...prev,
        editLoading: false,
        lastSuccessMessage: `Registration for ${state.selectedRegistration?.user.firstName} ${state.selectedRegistration?.user.lastName} has been updated successfully.`,
        editModalOpen: false,
        selectedRegistration: null,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update registration';
      setState(prev => ({
        ...prev,
        editLoading: false,
        lastErrorMessage: errorMessage,
      }));
    }
  }, [state.selectedRegistration]);

  const cancelRegistration = useCallback(async (data: RegistrationCancelData) => {
    if (!state.selectedRegistration) return;

    setState(prev => ({ ...prev, cancelLoading: true, lastErrorMessage: null }));

    try {
      await adminRegistrationsApi.cancelRegistration(state.selectedRegistration.id, data);
      
      const refundMessage = data.processRefund 
        ? ' A refund has been processed.' 
        : '';
      const notificationMessage = data.sendNotification 
        ? ' The user has been notified.' 
        : '';

      setState(prev => ({
        ...prev,
        cancelLoading: false,
        lastSuccessMessage: `Registration for ${state.selectedRegistration?.user.firstName} ${state.selectedRegistration?.user.lastName} has been cancelled.${refundMessage}${notificationMessage}`,
        cancelModalOpen: false,
        selectedRegistration: null,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel registration';
      setState(prev => ({
        ...prev,
        cancelLoading: false,
        lastErrorMessage: errorMessage,
      }));
    }
  }, [state.selectedRegistration]);

  // Message management
  const clearMessages = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastSuccessMessage: null,
      lastErrorMessage: null,
    }));
  }, []);

  return {
    state,
    openEditModal,
    openCancelModal,
    openAuditTrailModal,
    closeAllModals,
    editRegistration,
    cancelRegistration,
    clearMessages,
  };
}

export default useRegistrationManagement; 
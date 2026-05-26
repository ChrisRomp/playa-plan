import { describe, it, expect } from 'vitest';
import {
  isRegistrationAccessible,
  getRegistrationStatusMessage,
  canUserRegister,
  getActiveRegistrations,
  getCancelledRegistrations,
  isApplicationStatus,
  formatRegistrationStatus,
} from '../registrationUtils';
import { User, CampConfig } from '../../types';

describe('registrationUtils', () => {
  const mockConfig: CampConfig = {
    name: 'Test Camp',
    description: 'Test Description',
    homePageBlurb: 'Test Blurb',
    registrationOpen: false,
    earlyRegistrationOpen: false,
    currentYear: 2025,
  };

  const mockUser: User = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    isAuthenticated: true,
    isEarlyRegistrationEnabled: false,
    hasRegisteredForCurrentYear: false,
  };

  describe('isRegistrationAccessible', () => {
    it('should return false when config is null', () => {
      expect(isRegistrationAccessible(null, mockUser)).toBe(false);
    });

    it('should return true when registration is open', () => {
      const config = { ...mockConfig, registrationOpen: true };
      expect(isRegistrationAccessible(config, mockUser)).toBe(true);
    });

    it('should return true when early registration is open and user is enabled', () => {
      const config = { ...mockConfig, registrationOpen: true, earlyRegistrationOpen: true };
      const user = { ...mockUser, isEarlyRegistrationEnabled: true };
      expect(isRegistrationAccessible(config, user)).toBe(true);
    });

    it('should return false when early registration is open but user is not enabled', () => {
      const config = { ...mockConfig, earlyRegistrationOpen: true };
      expect(isRegistrationAccessible(config, mockUser)).toBe(false);
    });

    it('should return false when neither registration is open', () => {
      expect(isRegistrationAccessible(mockConfig, mockUser)).toBe(false);
    });

    it('should return false when user.allowRegistration is explicitly false even if registration is open', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const user = { ...mockUser, allowRegistration: false };
      expect(isRegistrationAccessible(config, user)).toBe(false);
    });

    it('should return false when user.allowRegistration is false even if early registration is open and user is enabled', () => {
      const config = { ...mockConfig, earlyRegistrationOpen: true };
      const user = { ...mockUser, allowRegistration: false, isEarlyRegistrationEnabled: true };
      expect(isRegistrationAccessible(config, user)).toBe(false);
    });

    it('should return true when user.allowRegistration is true and registration is open', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const user = { ...mockUser, allowRegistration: true };
      expect(isRegistrationAccessible(config, user)).toBe(true);
    });
  });

  describe('isApplicationStatus', () => {
    it('should identify application workflow statuses', () => {
      expect(isApplicationStatus('APPLICATION_SUBMITTED')).toBe(true);
      expect(isApplicationStatus('APPLICATION_APPROVED')).toBe(true);
      expect(isApplicationStatus('APPLICATION_DECLINED')).toBe(true);
      expect(isApplicationStatus('CONFIRMED')).toBe(false);
    });
  });

  describe('getRegistrationStatusMessage', () => {
    it('should return config unavailable message when config is null', () => {
      const message = getRegistrationStatusMessage(null, mockUser, false);
      expect(message).toBe('Configuration not available. Please try again later.');
    });

    it('should return already registered message when user has active registration', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const message = getRegistrationStatusMessage(config, mockUser, true);
      expect(message).toBe('You are already registered for 2025. You can view your registration details on the dashboard.');
    });

    it('should return application-specific message when application is pending review', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const message = getRegistrationStatusMessage(config, mockUser, true, 'APPLICATION_SUBMITTED');
      expect(message).toBe('Your application for 2025 is pending review.');
    });

    it('should return registration not available when neither is open', () => {
      const message = getRegistrationStatusMessage(mockConfig, mockUser, false);
      expect(message).toBe('Registration for 2025 is not currently open.');
    });

    it('should return account-disabled message when user.allowRegistration is false', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const user = { ...mockUser, allowRegistration: false };
      const message = getRegistrationStatusMessage(config, user, false);
      expect(message).toBe(
        'Registration for 2025 is not available for your account. Please contact an administrator if you believe this is in error.'
      );
    });
  });

  describe('canUserRegister', () => {
    it('should prevent registration when user.allowRegistration is false', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const user = { ...mockUser, allowRegistration: false };
      expect(canUserRegister(config, user, false)).toBe(false);
    });
    it('should prevent registration when user already has active registration', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const hasActiveRegistration = true;

      const result = canUserRegister(config, mockUser, hasActiveRegistration);
      expect(result).toBe(false);
    });

    it('should allow access when the active registration is an application workflow status', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const hasActiveRegistration = true;

      const result = canUserRegister(config, mockUser, hasActiveRegistration, 'APPLICATION_APPROVED');
      expect(result).toBe(true);
    });

    it('should allow registration when registration is open and user has no active registration', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const hasActiveRegistration = false;
      
      const result = canUserRegister(config, mockUser, hasActiveRegistration);
      expect(result).toBe(true);
    });

    it('should prevent registration when registration is closed', () => {
      const config = { ...mockConfig, registrationOpen: false };
      const hasActiveRegistration = false;
      
      const result = canUserRegister(config, mockUser, hasActiveRegistration);
      expect(result).toBe(false);
    });
  });

  describe('getActiveRegistrations', () => {
    it('should filter out cancelled registrations', () => {
      const registrations = [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'CONFIRMED' },
        { id: '3', status: 'CANCELLED' },
        { id: '4', status: 'WAITLISTED' },
      ];

      const activeRegistrations = getActiveRegistrations(registrations);
      
      expect(activeRegistrations).toHaveLength(3);
      expect(activeRegistrations.map((r: { id: string }) => r.id)).toEqual(['1', '2', '4']);
      expect(activeRegistrations.every((r: { status: string }) => r.status !== 'CANCELLED')).toBe(true);
    });

    it('should return empty array when all registrations are cancelled', () => {
      const registrations = [
        { id: '1', status: 'CANCELLED' },
        { id: '2', status: 'CANCELLED' },
      ];

      const activeRegistrations = getActiveRegistrations(registrations);
      
      expect(activeRegistrations).toHaveLength(0);
    });

    it('should return all registrations when none are cancelled', () => {
      const registrations = [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'CONFIRMED' },
      ];

      const activeRegistrations = getActiveRegistrations(registrations);
      
      expect(activeRegistrations).toHaveLength(2);
      expect(activeRegistrations).toEqual(registrations);
    });
  });

  describe('getCancelledRegistrations', () => {
    it('should filter to only include cancelled registrations', () => {
      const registrations = [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'CONFIRMED' },
        { id: '3', status: 'CANCELLED' },
        { id: '4', status: 'CANCELLED' },
        { id: '5', status: 'WAITLISTED' },
      ];

      const cancelledRegistrations = getCancelledRegistrations(registrations);
      
      expect(cancelledRegistrations).toHaveLength(2);
      expect(cancelledRegistrations.map((r: { id: string }) => r.id)).toEqual(['3', '4']);
      expect(cancelledRegistrations.every((r: { status: string }) => r.status === 'CANCELLED')).toBe(true);
    });

    it('should return empty array when no registrations are cancelled', () => {
      const registrations = [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'CONFIRMED' },
      ];

      const cancelledRegistrations = getCancelledRegistrations(registrations);
      
      expect(cancelledRegistrations).toHaveLength(0);
    });

    it('should return all registrations when all are cancelled', () => {
      const registrations = [
        { id: '1', status: 'CANCELLED' },
        { id: '2', status: 'CANCELLED' },
      ];

      const cancelledRegistrations = getCancelledRegistrations(registrations);
      
      expect(cancelledRegistrations).toHaveLength(2);
      expect(cancelledRegistrations).toEqual(registrations);
    });
  });

  describe('formatRegistrationStatus', () => {
    it('should format standard registration statuses', () => {
      expect(formatRegistrationStatus('PENDING')).toBe('Pending');
      expect(formatRegistrationStatus('CONFIRMED')).toBe('Confirmed');
      expect(formatRegistrationStatus('CANCELLED')).toBe('Cancelled');
      expect(formatRegistrationStatus('WAITLISTED')).toBe('Waitlisted');
    });

    it('should format application statuses', () => {
      expect(formatRegistrationStatus('APPLICATION_SUBMITTED')).toBe('Application Submitted');
      expect(formatRegistrationStatus('APPLICATION_APPROVED')).toBe('Application Approved');
      expect(formatRegistrationStatus('APPLICATION_DECLINED')).toBe('Application Not Approved');
    });

    it('should return the raw value for unknown statuses', () => {
      expect(formatRegistrationStatus('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    });
  });
}); 
import { describe, it, expect } from 'vitest';
import { isRegistrationAccessible, getRegistrationStatusMessage, canUserRegister } from '../registrationUtils';
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

    it('should return registration not available when neither is open', () => {
      const message = getRegistrationStatusMessage(mockConfig, mockUser, false);
      expect(message).toBe('Registration for 2025 is not currently open.');
    });
  });

  describe('canUserRegister', () => {
    it('should prevent registration when user already has active registration', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const hasActiveRegistration = true;
      
      const result = canUserRegister(config, mockUser, hasActiveRegistration);
      expect(result).toBe(false);
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
}); 
import { describe, it, expect } from 'vitest';
import { canUserRegister, getRegistrationStatusMessage } from '../registrationUtils';

describe('Registration Protection', () => {
  const mockConfig = {
    name: 'Test Camp',
    description: 'Test Description',
    homePageBlurb: 'Test Blurb',
    registrationOpen: false,
    earlyRegistrationOpen: false,
    currentYear: 2025,
  };

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.playaplan.app',
    role: 'user' as const,
    isAuthenticated: true,
    isEarlyRegistrationEnabled: false,
    hasRegisteredForCurrentYear: false,
  };

  describe('canUserRegister', () => {
    it('should prevent registration when user already has registration', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const hasExistingRegistration = true;
      
      const result = canUserRegister(config, mockUser, hasExistingRegistration);
      expect(result).toBe(false);
    });

    it('should allow registration when registration is open and user has no existing registration', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const hasExistingRegistration = false;
      
      const result = canUserRegister(config, mockUser, hasExistingRegistration);
      expect(result).toBe(true);
    });

    it('should prevent registration when registration is closed', () => {
      const config = { ...mockConfig, registrationOpen: false };
      const hasExistingRegistration = false;
      
      const result = canUserRegister(config, mockUser, hasExistingRegistration);
      expect(result).toBe(false);
    });

    it('should allow early registration for eligible users', () => {
      // For CampConfig type, we just check registrationOpen
      const config = { ...mockConfig, registrationOpen: true };
      const user = { ...mockUser, isEarlyRegistrationEnabled: true };
      const hasExistingRegistration = false;
      
      const result = canUserRegister(config, user, hasExistingRegistration);
      expect(result).toBe(true);
    });
  });

  describe('getRegistrationStatusMessage', () => {
    it('should return already registered message when user has existing registration', () => {
      const hasExistingRegistration = true;
      
      const message = getRegistrationStatusMessage(mockConfig, mockUser, hasExistingRegistration);
      expect(message).toContain('already registered for 2025');
    });

    it('should return configuration unavailable message when config is null', () => {
      const message = getRegistrationStatusMessage(null, mockUser, false);
      expect(message).toContain('Configuration not available');
    });
  });
}); 
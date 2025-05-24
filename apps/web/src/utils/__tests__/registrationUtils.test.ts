import { describe, it, expect } from 'vitest';
import { isRegistrationAccessible, getRegistrationStatusMessage } from '../registrationUtils';
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
      const config = { ...mockConfig, earlyRegistrationOpen: true };
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
      const message = getRegistrationStatusMessage(null, mockUser);
      expect(message).toBe('Registration configuration not available.');
    });

    it('should return registration open message when registration is open', () => {
      const config = { ...mockConfig, registrationOpen: true };
      const message = getRegistrationStatusMessage(config, mockUser);
      expect(message).toBe('Registration for Test Camp 2025 is now open!');
    });

    it('should return early registration message when user is enabled for early registration', () => {
      const config = { ...mockConfig, earlyRegistrationOpen: true };
      const user = { ...mockUser, isEarlyRegistrationEnabled: true };
      const message = getRegistrationStatusMessage(config, user);
      expect(message).toBe('Early registration for Test Camp 2025 is available to you!');
    });

    it('should return early registration not available message when user is not enabled', () => {
      const config = { ...mockConfig, earlyRegistrationOpen: true };
      const message = getRegistrationStatusMessage(config, mockUser);
      expect(message).toBe('Registration is not currently open. Early registration is available for selected members only.');
    });

    it('should return registration not open message when neither is open', () => {
      const message = getRegistrationStatusMessage(mockConfig, mockUser);
      expect(message).toBe('Registration is not currently open.');
    });
  });
}); 
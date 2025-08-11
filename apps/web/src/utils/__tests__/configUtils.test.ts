import { describe, it, expect } from 'vitest';
import { mapApiConfigToFrontend, fallbackConfig } from '../configUtils';
import { CoreConfig } from '../../lib/api';

describe('configUtils', () => {
  describe('mapApiConfigToFrontend', () => {
    it('should map all required fields from API config to frontend config', () => {
      const apiConfig: CoreConfig = {
        id: 'test-id',
        campName: 'Test Camp',
        campDescription: 'A test camp',
        homePageBlurb: 'Welcome to test camp',
        campBannerUrl: '/banner.png',
        campBannerAltText: 'Banner alt text',
        campIconUrl: '/icon.png',
        campIconAltText: 'Icon alt text',
        registrationYear: 2024,
        earlyRegistrationOpen: true,
        registrationOpen: true,
        registrationTerms: 'Test terms',
        allowDeferredDuesPayment: false,
        stripeEnabled: true,
        stripePublicKey: 'pk_test_123',
        paypalEnabled: false,
        paypalClientId: '',
        paypalMode: 'sandbox',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const frontendConfig = mapApiConfigToFrontend(apiConfig);

      // Check basic fields
      expect(frontendConfig.name).toBe('Test Camp');
      expect(frontendConfig.description).toBe('A test camp');
      expect(frontendConfig.homePageBlurb).toBe('Welcome to test camp');
      expect(frontendConfig.registrationOpen).toBe(true);
      expect(frontendConfig.earlyRegistrationOpen).toBe(true);
      expect(frontendConfig.currentYear).toBe(2024);

      // Check payment fields - this is the key fix
      expect(frontendConfig.stripeEnabled).toBe(true);
      expect(frontendConfig.stripePublicKey).toBe('pk_test_123');
      expect(frontendConfig.paypalEnabled).toBe(false);
      expect(frontendConfig.paypalClientId).toBe('');
      expect(frontendConfig.paypalMode).toBe('sandbox');
      expect(frontendConfig.allowDeferredDuesPayment).toBe(false);
    });

    it('should handle null/undefined payment fields gracefully', () => {
      const apiConfig: CoreConfig = {
        id: 'test-id',
        campName: 'Test Camp',
        campDescription: null,
        homePageBlurb: null,
        campBannerUrl: null,
        campBannerAltText: null,
        campIconUrl: null,
        campIconAltText: null,
        registrationYear: 2024,
        earlyRegistrationOpen: false,
        registrationOpen: false,
        registrationTerms: null,
        allowDeferredDuesPayment: false,
        stripeEnabled: false,
        stripePublicKey: null,
        paypalEnabled: false,
        paypalClientId: null,
        paypalMode: 'sandbox',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const frontendConfig = mapApiConfigToFrontend(apiConfig);

      expect(frontendConfig.stripeEnabled).toBe(false);
      expect(frontendConfig.stripePublicKey).toBeUndefined();
      expect(frontendConfig.paypalEnabled).toBe(false);
      expect(frontendConfig.paypalClientId).toBeUndefined();
      expect(frontendConfig.paypalMode).toBe('sandbox');
      expect(frontendConfig.allowDeferredDuesPayment).toBe(false);
    });
  });

  describe('fallbackConfig', () => {
    it('should have reasonable defaults for payment fields', () => {
      expect(fallbackConfig.stripeEnabled).toBe(false);
      expect(fallbackConfig.stripePublicKey).toBeUndefined();
      expect(fallbackConfig.paypalEnabled).toBe(false);
      expect(fallbackConfig.paypalClientId).toBeUndefined();
      expect(fallbackConfig.paypalMode).toBe('sandbox');
      expect(fallbackConfig.allowDeferredDuesPayment).toBe(false);
    });

    it('should have all required frontend config fields', () => {
      expect(fallbackConfig.name).toBeDefined();
      expect(fallbackConfig.description).toBeDefined();
      expect(fallbackConfig.homePageBlurb).toBeDefined();
      expect(fallbackConfig.registrationOpen).toBeDefined();
      expect(fallbackConfig.earlyRegistrationOpen).toBeDefined();
      expect(fallbackConfig.currentYear).toBeDefined();
    });
  });
}); 
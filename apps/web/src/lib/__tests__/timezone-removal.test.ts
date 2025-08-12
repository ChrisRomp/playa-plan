import { describe, it, expect } from 'vitest';
import { CoreConfigSchema } from '../api';

describe('CoreConfig Schema - Timezone Removal', () => {
  it('should not include timeZone field in the schema', () => {
    const mockData = {
      id: '1',
      campName: 'Test Camp',
      campDescription: 'Test description',
      homePageBlurb: 'Test blurb',
      campBannerUrl: 'https://example.com/banner.jpg',
      campBannerAltText: 'Banner alt text',
      campIconUrl: 'https://example.com/icon.png',
      campIconAltText: 'Icon alt text',
      registrationYear: 2024,
      earlyRegistrationOpen: false,
      registrationOpen: true,
      registrationTerms: 'Test terms',
      allowDeferredDuesPayment: false,
      stripeEnabled: true,
      stripePublicKey: 'pk_test_123',
      paypalEnabled: false,
      paypalClientId: null,
      paypalMode: 'sandbox',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    // This should parse successfully without timeZone field
    const result = CoreConfigSchema.parse(mockData);
    expect(result).toBeDefined();
    expect(result.campName).toBe('Test Camp');
    
    // Verify timeZone field is not in the parsed result
    expect('timeZone' in result).toBe(false);
  });

  it('should ignore timeZone field if provided and not include it in result', () => {
    const dataWithTimeZone: Record<string, unknown> = {
      id: '1',
      campName: 'Test Camp',
      registrationYear: 2024,
      earlyRegistrationOpen: false,
      registrationOpen: true,
      allowDeferredDuesPayment: false,
      stripeEnabled: false,
      paypalEnabled: false,
      paypalMode: 'sandbox',
      timeZone: 'America/Los_Angeles', // This should be ignored
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    // This should succeed but timeZone should not be in the result
    const result = CoreConfigSchema.parse(dataWithTimeZone);
    expect(result).toBeDefined();
    expect('timeZone' in result).toBe(false);
    expect(result.campName).toBe('Test Camp');
  });
});
/**
 * Utilities for working with configuration data
 * @module configUtils
 */
import { CoreConfig } from '../lib/api';
import { CampConfig } from '../types';

// Explicitly export types for better TypeScript integration
export type { CoreConfig } from '../lib/api';
export type { CampConfig } from '../types';

/**
 * Maps the CoreConfig API response to the frontend CampConfig type
 * @param apiConfig The configuration from the API
 * @returns CampConfig formatted for the frontend
 */
export const mapApiConfigToFrontend = (apiConfig: CoreConfig): CampConfig => {
  return {
    name: apiConfig.campName,
    description: apiConfig.campDescription ?? '',
    bannerUrl: apiConfig.campBannerUrl ?? undefined,
    bannerAltText: apiConfig.campBannerAltText ?? undefined,
    iconUrl: apiConfig.campIconUrl ?? undefined,
    iconAltText: apiConfig.campIconAltText ?? undefined,
    homePageBlurb: apiConfig.homePageBlurb ?? '<h2>Welcome to PlayaPlan.</h2><p>Please log in as an admin and configure your site.</p>',
    registrationOpen: apiConfig.registrationOpen,
    earlyRegistrationOpen: apiConfig.earlyRegistrationOpen,
    currentYear: apiConfig.registrationYear,
    registrationTerms: apiConfig.registrationTerms ?? undefined,
    // Payment configuration
    stripeEnabled: apiConfig.stripeEnabled,
    stripePublicKey: apiConfig.stripePublicKey ?? undefined,
    paypalEnabled: apiConfig.paypalEnabled,
    paypalClientId: apiConfig.paypalClientId ?? undefined,
    paypalMode: apiConfig.paypalMode ?? undefined,
    allowDeferredDuesPayment: apiConfig.allowDeferredDuesPayment
  };
};

/**
 * Fallback configuration used when API calls fail
 * Provides reasonable defaults for the application to function
 */
export const fallbackConfig: CampConfig = {
  name: "PlayaPlan",
  description: "A Burning Man camp registration and planning tool",
  bannerUrl: "/images/playa-plan-banner.png",
  bannerAltText: "Desert landscape at sunset with art installations",
  iconUrl: "/icons/playa-plan-icon.png",
  iconAltText: "PlayaPlan camp icon",
  homePageBlurb: "<h2>Welcome to PlayaPlan.</h2><p>Please log in as an admin and configure your site.</p>",
  registrationOpen: false,
  earlyRegistrationOpen: false,
  currentYear: new Date().getFullYear(),
  registrationTerms: undefined,
  // Payment configuration defaults
  stripeEnabled: false,
  stripePublicKey: undefined,
  paypalEnabled: false,
  paypalClientId: undefined,
  paypalMode: 'sandbox',
  allowDeferredDuesPayment: false
};

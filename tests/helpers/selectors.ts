/**
 * Centralized data-testid map. Specs should reference these constants instead of
 * hard-coding strings, so renames stay in one place. Add new ids here as we wire
 * data-testid into the React components.
 */
export const TID = {
  // Auth / login
  loginEmailInput: 'login-email',
  loginSendCodeBtn: 'login-send-code',
  loginCodeInput: 'login-code',
  loginSubmitBtn: 'login-submit',

  // Layout
  signOutBtn: 'sign-out',
  navAdminPanel: 'nav-admin-panel',
  navManageRegistrations: 'nav-manage-registrations',

  // Registration multi-step
  regStep: (n: number) => `registration-step-${n}`,
  regNextBtn: 'registration-next',
  regBackBtn: 'registration-back',
  regSubmitBtn: 'registration-submit',
  regCampingOption: (id: string) => `camping-option-${id}`,
  regJob: (id: string) => `job-option-${id}`,
  regAcceptTerms: 'registration-accept-terms',

  // Payment
  paymentButton: 'payment-button',
  paymentIframeWrapper: 'payment-iframe-wrapper',

  // Admin tables
  adminUserRow: (id: string) => `admin-user-row-${id}`,
  adminRegistrationRow: (id: string) => `admin-registration-row-${id}`,
  auditTrailRow: 'audit-trail-row',
} as const;

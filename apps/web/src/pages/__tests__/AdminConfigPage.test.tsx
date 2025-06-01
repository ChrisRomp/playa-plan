import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminConfigPage from '../AdminConfigPage';
import { ConfigContext, type ConfigContextType } from '../../store/ConfigContextDefinition';
import { CampConfig } from '../../types';
import * as api from '../../lib/api';

// Mock react-router-dom's useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

// Mock the API module
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn()
  },
  config: {
    get: vi.fn(),
    update: vi.fn()
  }
}));

// Type the mocked API functions
const mockApiGet = api.api.get as ReturnType<typeof vi.fn>;
const mockApiPatch = api.api.patch as ReturnType<typeof vi.fn>;
const mockApiPost = api.api.post as ReturnType<typeof vi.fn>;

// Mock console methods to capture debug logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock config data that matches the API response structure
const mockConfig: Record<string, unknown> = {
  campName: 'PlayaPlan 2024',
  campDescription: 'A test camp',
  homePageBlurb: 'Welcome to our test camp',
  registrationOpen: true,
  earlyRegistrationOpen: false,
  registrationYear: 2024,
  stripeEnabled: true,
  stripePublicKey: 'pk_test_123',
  paypalEnabled: false,
  paypalClientId: '',
  emailEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  senderEmail: '',
  senderName: '',
  smtpUseSsl: false,
  // Note: Sensitive fields are excluded from API responses
  // stripeApiKey, paypalClientSecret, smtpPassword are not included
};

const renderWithProviders = (component: React.ReactElement) => {
  const mockConfigContext: ConfigContextType = {
    config: {
      name: mockConfig.campName,
      description: mockConfig.campDescription,
      homePageBlurb: mockConfig.homePageBlurb,
      registrationOpen: mockConfig.registrationOpen,
      earlyRegistrationOpen: mockConfig.earlyRegistrationOpen,
      currentYear: mockConfig.registrationYear,
      stripeEnabled: mockConfig.stripeEnabled,
      stripePublicKey: mockConfig.stripePublicKey,
      paypalEnabled: mockConfig.paypalEnabled,
      paypalClientId: mockConfig.paypalClientId,
      allowDeferredDuesPayment: false,
    } as CampConfig,
    isLoading: false,
    error: null,
    refreshConfig: vi.fn()
  };

  return render(
    <BrowserRouter>
      <ConfigContext.Provider value={mockConfigContext}>
        {component}
      </ConfigContext.Provider>
    </BrowserRouter>
  );
};

describe('AdminConfigPage - Secure Field Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  it('should load configuration without setting sensitive fields to empty strings', async () => {
    // Mock API response that excludes sensitive fields (as in real API)
    mockApiGet.mockResolvedValue({
      data: mockConfig
    });

    renderWithProviders(<AdminConfigPage />);

    // Wait for the config to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Check that sensitive field inputs are empty and have proper placeholders
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    const paypalClientSecretInput = screen.getByLabelText(/PayPal Client Secret/i);
    const smtpPasswordInput = screen.getByLabelText(/SMTP Password/i);

    expect(stripeApiKeyInput).toHaveValue('');
    expect(paypalClientSecretInput).toHaveValue('');
    expect(smtpPasswordInput).toHaveValue('');

    // Verify placeholders exist for guidance
    expect(stripeApiKeyInput).toHaveAttribute('placeholder', 'Leave blank to keep existing key');
    expect(paypalClientSecretInput).toHaveAttribute('placeholder', 'Leave blank to keep existing secret');
    expect(smtpPasswordInput).toHaveAttribute('placeholder', 'Leave blank to keep existing password');
  });

  it('should exclude empty sensitive fields from API payload when saving', async () => {
    mockApiGet.mockResolvedValue({ data: mockConfig });
    mockApiPatch.mockResolvedValue({ status: 200, data: mockConfig });

    renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in some non-sensitive fields
    const campNameInput = screen.getByLabelText(/Camp Name/i);
    fireEvent.change(campNameInput, { target: { value: 'Updated Camp Name' } });

    // Leave sensitive fields empty (they should be excluded from payload)
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = mockApiPatch.mock.calls[0];
    const payload = patchCall?.[1] as Record<string, unknown>;

    // Verify sensitive fields are NOT in the payload
    expect(payload).not.toHaveProperty('stripeApiKey');
    expect(payload).not.toHaveProperty('stripeWebhookSecret');
    expect(payload).not.toHaveProperty('paypalClientSecret');
    expect(payload).not.toHaveProperty('smtpPassword');

    // Verify non-sensitive fields are included
    expect(payload).toHaveProperty('campName', 'Updated Camp Name');
    expect(payload).toHaveProperty('stripePublicKey', 'pk_test_123');

    // Verify debug log shows no sensitive fields included
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'Sensitive fields included in payload:',
      'none'
    );
  });

  it('should include sensitive fields in payload only when they have values', async () => {
    mockApiGet.mockResolvedValue({ data: mockConfig });
    mockApiPatch.mockResolvedValue({ status: 200, data: mockConfig });

    const { container } = renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in some sensitive fields with actual values
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    const smtpPasswordInput = screen.getByLabelText(/SMTP Password/i);
    
    fireEvent.change(stripeApiKeyInput, { target: { value: 'sk_test_new_key' } });
    fireEvent.change(smtpPasswordInput, { target: { value: 'new_password123' } });

    // Submit the form using querySelector since there's no explicit form role
    const form = container.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      // Fallback: trigger form submission via button click
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = mockApiPatch.mock.calls[0];
    const payload = patchCall?.[1] as Record<string, unknown>;

    // Verify only the filled sensitive fields are in the payload
    expect(payload).toHaveProperty('stripeApiKey', 'sk_test_new_key');
    expect(payload).toHaveProperty('smtpPassword', 'new_password123');
    
    // Verify empty sensitive fields are NOT in the payload
    expect(payload).not.toHaveProperty('stripeWebhookSecret');
    expect(payload).not.toHaveProperty('paypalClientSecret');

    // Verify debug log shows which sensitive fields were included
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'Sensitive fields included in payload:',
      ['stripeApiKey', 'smtpPassword']
    );
  });

  it('should trim whitespace from sensitive fields and exclude if only whitespace', async () => {
    mockApiGet.mockResolvedValue({ data: mockConfig });
    mockApiPatch.mockResolvedValue({ status: 200, data: mockConfig });

    const { container } = renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill sensitive fields with only whitespace
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    
    fireEvent.change(stripeApiKeyInput, { target: { value: '   ' } }); // Only spaces

    // Submit the form using querySelector since there's no explicit form role
    const form = container.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      // Fallback: trigger form submission via button click
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = mockApiPatch.mock.calls[0];
    const payload = patchCall?.[1] as Record<string, unknown>;

    // Verify whitespace-only fields are NOT in the payload
    expect(payload).not.toHaveProperty('stripeApiKey');

    // Verify debug log shows no sensitive fields included
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'Sensitive fields included in payload:',
      'none'
    );
  });

  it('should handle API errors gracefully when saving with sensitive fields', async () => {
    mockApiGet.mockResolvedValue({ data: mockConfig });
    mockApiPatch.mockRejectedValue(new Error('API Error'));

    const { container } = renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in a sensitive field
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    fireEvent.change(stripeApiKeyInput, { target: { value: 'sk_test_key' } });

    // Submit the form using querySelector since there's no explicit form role
    const form = container.querySelector('form');
    if (form) {
      fireEvent.submit(form);
    } else {
      // Fallback: trigger form submission via button click
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      fireEvent.click(saveButton);
    }

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });

    // Verify error is handled and logged
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Error saving configuration:',
      expect.any(Error)
    );

    // Verify the field value is still preserved in the form
    expect(stripeApiKeyInput).toHaveValue('sk_test_key');
  });

  it('should provide helpful guidance text for sensitive fields', async () => {
    mockApiGet.mockResolvedValue({ data: mockConfig });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Check that help text exists for sensitive fields (there are multiple instances)
    const helpTexts = screen.getAllByText(/Leave blank to keep the existing/i);
    expect(helpTexts).toHaveLength(3); // One for each sensitive field
    
    // Check that each sensitive field section has appropriate guidance
    const stripeSection = screen.getByText(/Stripe Secret Key/i).closest('div');
    const paypalSection = screen.getByText(/PayPal Client Secret/i).closest('div');
    const smtpSection = screen.getByText(/SMTP Password/i).closest('div');

    [stripeSection, paypalSection, smtpSection].forEach(section => {
      expect(section).toBeInTheDocument();
    });
  });
});

describe('AdminConfigPage - Email Toggle Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  const mockConfigWithEmail = {
    ...mockConfig,
    emailEnabled: true,
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpUsername: 'test@example.com',
    senderEmail: 'noreply@example.com',
    senderName: 'Test Camp',
    smtpUseSsl: false
  };

  it('should load email configuration and show emailEnabled checkbox', async () => {
    mockApiGet.mockResolvedValue({
      data: mockConfigWithEmail
    });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Check that emailEnabled checkbox exists and is checked
    const emailEnabledCheckbox = screen.getByLabelText(/Enable Email Notifications/i);
    expect(emailEnabledCheckbox).toBeInTheDocument();
    expect(emailEnabledCheckbox).toBeChecked();

    // Check that SMTP fields are visible and enabled
    const smtpHostInput = screen.getByLabelText(/SMTP Host/i);
    const smtpPortInput = screen.getByLabelText(/SMTP Port/i);
    const senderEmailInput = screen.getByLabelText(/Sender Email/i);
    const senderNameInput = screen.getByLabelText(/Sender Name/i);

    expect(smtpHostInput).toBeEnabled();
    expect(smtpPortInput).toBeEnabled();
    expect(senderEmailInput).toBeEnabled();
    expect(senderNameInput).toBeEnabled();

    // Check that values are loaded correctly
    expect(smtpHostInput).toHaveValue('smtp.example.com');
    expect(smtpPortInput).toHaveValue(587);
    expect(senderEmailInput).toHaveValue('noreply@example.com');
    expect(senderNameInput).toHaveValue('Test Camp');
  });

  it('should disable SMTP fields when emailEnabled is unchecked', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...mockConfigWithEmail, emailEnabled: false }
    });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Check that emailEnabled checkbox exists and is unchecked
    const emailEnabledCheckbox = screen.getByLabelText(/Enable Email Notifications/i);
    expect(emailEnabledCheckbox).not.toBeChecked();

    // Check that SMTP fields are disabled
    const smtpHostInput = screen.getByLabelText(/SMTP Host/i);
    const smtpPortInput = screen.getByLabelText(/SMTP Port/i);
    const smtpUsernameInput = screen.getByLabelText(/SMTP Username/i);
    const smtpPasswordInput = screen.getByLabelText(/SMTP Password/i);
    const smtpUseSslCheckbox = screen.getByLabelText(/Use SSL for SMTP/i);
    const senderEmailInput = screen.getByLabelText(/Sender Email/i);
    const senderNameInput = screen.getByLabelText(/Sender Name/i);

    expect(smtpHostInput).toBeDisabled();
    expect(smtpPortInput).toBeDisabled();
    expect(smtpUsernameInput).toBeDisabled();
    expect(smtpPasswordInput).toBeDisabled();
    expect(smtpUseSslCheckbox).toBeDisabled();
    expect(senderEmailInput).toBeDisabled();
    expect(senderNameInput).toBeDisabled();

    // Check that visual styling indicates disabled state
    expect(smtpHostInput).toHaveClass('disabled:bg-gray-100');
  });

  it('should toggle SMTP fields when emailEnabled checkbox is clicked', async () => {
    mockApiGet.mockResolvedValue({
      data: mockConfigWithEmail
    });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    const emailEnabledCheckbox = screen.getByLabelText(/Enable Email Notifications/i);
    const smtpHostInput = screen.getByLabelText(/SMTP Host/i);

    // Initially enabled
    expect(emailEnabledCheckbox).toBeChecked();
    expect(smtpHostInput).toBeEnabled();

    // Uncheck the email enabled checkbox
    fireEvent.click(emailEnabledCheckbox);

    // Check that SMTP fields are now disabled
    expect(emailEnabledCheckbox).not.toBeChecked();
    expect(smtpHostInput).toBeDisabled();

    // Check the checkbox again
    fireEvent.click(emailEnabledCheckbox);

    // Check that SMTP fields are enabled again
    expect(emailEnabledCheckbox).toBeChecked();
    expect(smtpHostInput).toBeEnabled();
  });

  it('should include emailEnabled field in form submission', async () => {
    mockApiGet.mockResolvedValue({ data: mockConfigWithEmail });
    mockApiPatch.mockResolvedValue({ status: 200, data: mockConfigWithEmail });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in required fields to ensure submission
    const campNameInput = screen.getByLabelText(/Camp Name/i);
    fireEvent.change(campNameInput, { target: { value: 'Test Camp' } });

    // Toggle email enabled off
    const emailEnabledCheckbox = screen.getByLabelText(/Enable Email Notifications/i);
    fireEvent.click(emailEnabledCheckbox);

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = mockApiPatch.mock.calls[0];
    const payload = patchCall?.[1] as Record<string, unknown>;

    // Verify emailEnabled field is in the payload with correct value
    expect(payload).toHaveProperty('emailEnabled', false);
  });

  it('should validate required SMTP fields when email is enabled', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...mockConfigWithEmail, smtpHost: '', senderEmail: '', senderName: '' }
    });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Ensure email is enabled
    const emailEnabledCheckbox = screen.getByLabelText(/Enable Email Notifications/i);
    expect(emailEnabledCheckbox).toBeChecked();

    // Fill in required non-email fields to pass basic validation
    const campNameInput = screen.getByLabelText(/Camp Name/i);
    fireEvent.change(campNameInput, { target: { value: 'Test Camp' } });

    // Try to submit with missing required email fields
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    // Check for validation errors - should appear synchronously
    expect(screen.getByText(/Please fix the following errors/i)).toBeInTheDocument();
    expect(screen.getByText(/SMTP Host is required when email notifications are enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Sender Email is required when email notifications are enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/Sender Name is required when email notifications are enabled/i)).toBeInTheDocument();
  });

  it('should not validate SMTP fields when email is disabled', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...mockConfigWithEmail, emailEnabled: false, smtpHost: '', senderEmail: '', senderName: '' }
    });
    mockApiPatch.mockResolvedValue({ status: 200, data: mockConfigWithEmail });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Ensure email is disabled
    const emailEnabledCheckbox = screen.getByLabelText(/Enable Email Notifications/i);
    expect(emailEnabledCheckbox).not.toBeChecked();

    // Fill in required non-email field
    const campNameInput = screen.getByLabelText(/Camp Name/i);
    fireEvent.change(campNameInput, { target: { value: 'Test Camp' } });

    // Submit the form - should not show SMTP validation errors
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });

    // Should not show validation errors for SMTP fields
    expect(screen.queryByText(/SMTP Host is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sender Email is required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sender Name is required/i)).not.toBeInTheDocument();
  });

  it.skip('should validate SMTP port range when email is enabled', async () => {
    mockApiGet.mockResolvedValue({
      data: { ...mockConfigWithEmail, smtpHost: '', senderEmail: '', senderName: '' }
    });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in required fields except for the SMTP port we want to test
    const campNameInput = screen.getByLabelText(/Camp Name/i);
    fireEvent.change(campNameInput, { target: { value: 'Test Camp' } });

    // Fill in required SMTP fields except port
    const smtpHostInput = screen.getByLabelText(/SMTP Host/i);
    const senderEmailInput = screen.getByLabelText(/Sender Email/i);
    const senderNameInput = screen.getByLabelText(/Sender Name/i);
    
    fireEvent.change(smtpHostInput, { target: { value: 'smtp.test.com' } });
    fireEvent.change(senderEmailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(senderNameInput, { target: { value: 'Test Sender' } });

    // Set invalid port number
    const smtpPortInput = screen.getByLabelText(/SMTP Port/i);
    fireEvent.change(smtpPortInput, { target: { value: '0' } });
    
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    // Check that validation prevents submission - verify API is not called
    expect(mockApiPatch).not.toHaveBeenCalled();
    
    // Check for validation errors - should appear synchronously  
    expect(screen.getByText(/Please fix the following errors/i)).toBeInTheDocument();
    expect(screen.getByText(/SMTP Port must be a valid port number \(1-65535\)/i)).toBeInTheDocument();
  });

  it('should preserve existing SMTP password when email toggle is used', async () => {
    mockApiGet.mockResolvedValue({ data: mockConfigWithEmail });
    mockApiPatch.mockResolvedValue({ status: 200, data: mockConfigWithEmail });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in required fields to ensure submission
    const campNameInput = screen.getByLabelText(/Camp Name/i);
    fireEvent.change(campNameInput, { target: { value: 'Test Camp' } });

    // Toggle email off and back on
    const emailEnabledCheckbox = screen.getByLabelText(/Enable Email Notifications/i);
    fireEvent.click(emailEnabledCheckbox); // Disable
    fireEvent.click(emailEnabledCheckbox); // Re-enable

    // Submit without changing SMTP password
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = mockApiPatch.mock.calls[0];
    const payload = patchCall?.[1] as Record<string, unknown>;

    // Verify SMTP password is not included (preserves existing)
    expect(payload).not.toHaveProperty('smtpPassword');
    expect(payload).toHaveProperty('emailEnabled', true);
  });
});

describe('Email Configuration Form Submission', () => {
  beforeEach(() => {
    mockApiGet.mockResolvedValue({
      data: mockConfig,
    });

    mockApiPatch.mockResolvedValue({
      status: 200,
      data: mockConfig,
    });
  });

  it('should submit email configuration changes', async () => {
    // Mock the refreshConfig function to avoid undefined errors
    const mockRefreshConfig = vi.fn().mockResolvedValue(undefined);
    
    // Use a more complete render without the wrapper since it's causing issues
    render(
      <BrowserRouter>
        <ConfigContext.Provider value={{
          config: {
            name: mockConfig.campName,
            description: mockConfig.campDescription,
            homePageBlurb: mockConfig.homePageBlurb,
            registrationOpen: mockConfig.registrationOpen,
            earlyRegistrationOpen: mockConfig.earlyRegistrationOpen,
            currentYear: mockConfig.registrationYear,
            stripeEnabled: mockConfig.stripeEnabled,
            stripePublicKey: mockConfig.stripePublicKey,
            paypalEnabled: mockConfig.paypalEnabled,
            paypalClientId: mockConfig.paypalClientId,
            allowDeferredDuesPayment: false,
          } as CampConfig,
          isLoading: false,
          error: null,
          refreshConfig: mockRefreshConfig
        }}>
          <AdminConfigPage />
        </ConfigContext.Provider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('PlayaPlan 2024')).toBeInTheDocument();
    });

    // Enable email notifications
    const emailEnabledCheckbox = screen.getByLabelText('Enable Email Notifications');
    fireEvent.click(emailEnabledCheckbox);

    // Fill in SMTP settings
    fireEvent.change(screen.getByLabelText('SMTP Host'), {
      target: { value: 'smtp.test.com' },
    });
    fireEvent.change(screen.getByLabelText('SMTP Port'), {
      target: { value: '587' },
    });
    fireEvent.change(screen.getByLabelText('Sender Email'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Sender Name'), {
      target: { value: 'Test Camp' },
    });

    // Submit form
    fireEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => {
      expect(mockApiPatch).toHaveBeenCalledWith(
        '/core-config/current',
        expect.objectContaining({
          emailEnabled: true,
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          senderEmail: 'test@example.com',
          senderName: 'Test Camp',
        })
      );
    });

    // Verify refreshConfig was called
    expect(mockRefreshConfig).toHaveBeenCalled();
  });
});

describe('Test Email Functionality', () => {
  beforeEach(() => {
    mockApiGet.mockResolvedValue({
      data: {
        ...mockConfig,
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
      },
    });
  });

  describe('Basic Test Email Sending', () => {
    it('should send a basic test email successfully', async () => {
      const mockTestEmailResponse = {
        data: {
          success: true,
          message: 'Test email sent successfully to 1 recipient!',
          auditRecordId: 'audit-123',
          timestamp: '2023-12-01T10:00:00Z',
          recipients: ['test@example.com'],
        },
      };

      mockApiPost.mockResolvedValue(mockTestEmailResponse);

      render(<AdminConfigPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('PlayaPlan 2024')).toBeInTheDocument();
      });

      // Expand the Test Email Configuration section
      const showTestEmailButton = screen.getByText('Show Test Email');
      fireEvent.click(showTestEmailButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/email@example.com/)).toBeInTheDocument();
      });

      // Fill email address
      const emailInput = screen.getByPlaceholderText(/email@example.com/);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      // Click send test email button using a more specific selector
      const sendButton = screen.getByRole('button', { name: 'Send Test Email' });
      fireEvent.click(sendButton);

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/Test email sent successfully/)).toBeInTheDocument();
      });

      // Check that API was called correctly
      expect(mockApiPost).toHaveBeenCalledWith('/notifications/email/test', {
        email: 'test@example.com',
        format: 'html',
        includeSmtpDetails: true,
      });
    });

    it('should handle test email failure gracefully', async () => {
      const mockTestEmailResponse = {
        response: {
          data: {
            message: 'SMTP connection failed',
          },
        },
      };

      mockApiPost.mockRejectedValue(mockTestEmailResponse);

      render(<AdminConfigPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('PlayaPlan 2024')).toBeInTheDocument();
      });

      // Expand the Test Email Configuration section
      const showTestEmailButton = screen.getByText('Show Test Email');
      fireEvent.click(showTestEmailButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/email@example.com/)).toBeInTheDocument();
      });

      // Fill email address
      const emailInput = screen.getByPlaceholderText(/email@example.com/);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      // Click send test email button
      const sendButton = screen.getByRole('button', { name: 'Send Test Email' });
      fireEvent.click(sendButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/SMTP connection failed/)).toBeInTheDocument();
      });

      expect(mockApiPost).toHaveBeenCalledWith('/notifications/email/test', {
        email: 'test@example.com',
        format: 'html',
        includeSmtpDetails: true,
      });
    });

    it('should validate email format before sending', async () => {
      render(<AdminConfigPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('PlayaPlan 2024')).toBeInTheDocument();
      });

      // Expand the Test Email Configuration section
      const showTestEmailButton = screen.getByText('Show Test Email');
      fireEvent.click(showTestEmailButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/email@example.com/)).toBeInTheDocument();
      });

      // Fill invalid email
      const emailInput = screen.getByPlaceholderText(/email@example.com/);
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

      // Try to send
      const sendButton = screen.getByRole('button', { name: 'Send Test Email' });
      fireEvent.click(sendButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Invalid email address/)).toBeInTheDocument();
      });

      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  describe('Advanced Test Email Features', () => {
    it('should handle multiple email recipients', async () => {
      const mockTestEmailResponse = {
        data: {
          success: true,
          message: 'Test email sent successfully to 2 recipients!',
          recipients: ['test1@example.com', 'test2@example.com'],
        },
      };

      mockApiPost.mockResolvedValue(mockTestEmailResponse);

      render(<AdminConfigPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('PlayaPlan 2024')).toBeInTheDocument();
      });

      // Expand the Test Email Configuration section
      const showTestEmailButton = screen.getByText('Show Test Email');
      fireEvent.click(showTestEmailButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/email@example.com/)).toBeInTheDocument();
      });

      // Fill multiple emails
      const emailInput = screen.getByPlaceholderText(/email@example.com/);
      fireEvent.change(emailInput, { target: { value: 'test1@example.com, test2@example.com' } });

      // Send test email
      const sendButton = screen.getByRole('button', { name: 'Send Test Email' });
      fireEvent.click(sendButton);

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/Test email sent successfully to 2 recipients/)).toBeInTheDocument();
      });

      // Check that API was called correctly
      expect(mockApiPost).toHaveBeenCalledWith('/notifications/email/test', {
        email: 'test1@example.com, test2@example.com',
        format: 'html',
        includeSmtpDetails: true,
      });
    });
  });

  describe('SMTP Connection Testing', () => {
    it('should test SMTP connection successfully', async () => {
      const mockConnectionResponse = {
        data: {
          success: true,
          message: 'SMTP connection successful! Your email configuration is working correctly.',
          details: {
            host: 'smtp.test.com',
            port: 587,
            secure: false,
            authenticated: true,
            connectionTime: 234,
          },
        },
      };

      mockApiPost.mockResolvedValue(mockConnectionResponse);

      render(<AdminConfigPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('PlayaPlan 2024')).toBeInTheDocument();
      });

      // Expand the Test Email Configuration section (where SMTP Connection Test is now located)
      const showTestEmailButton = screen.getByText('Show Test Email');
      fireEvent.click(showTestEmailButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Test SMTP Connection' })).toBeInTheDocument();
      });

      // Click test SMTP connection button
      const testButton = screen.getByRole('button', { name: 'Test SMTP Connection' });
      fireEvent.click(testButton);

      // Wait for success result
      await waitFor(() => {
        expect(screen.getByText(/✅ Connection Successful/)).toBeInTheDocument();
      });

      // Check that API was called correctly with form data
      expect(mockApiPost).toHaveBeenCalledWith('/notifications/email/test-connection', {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: '',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
      });

      // Check connection details are displayed
      expect(screen.getByText('smtp.test.com')).toBeInTheDocument();
      expect(screen.getByText('587')).toBeInTheDocument();
      expect(screen.getByText('234ms')).toBeInTheDocument();
    });

    it('should handle SMTP connection failure with detailed error info', async () => {
      const mockConnectionResponse = {
        data: {
          success: false,
          message: 'SMTP connection failed: Connection timeout',
          errorDetails: {
            code: 'ETIMEDOUT',
            errno: -110,
            address: 'smtp.test.com',
            port: 587,
            response: '421 Service not available',
          },
        },
      };

      mockApiPost.mockResolvedValue(mockConnectionResponse);

      render(<AdminConfigPage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('PlayaPlan 2024')).toBeInTheDocument();
      });

      // Expand the Test Email Configuration section (where SMTP Connection Test is now located)
      const showTestEmailButton = screen.getByText('Show Test Email');
      fireEvent.click(showTestEmailButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Test SMTP Connection' })).toBeInTheDocument();
      });

      // Click test SMTP connection button
      const testButton = screen.getByRole('button', { name: 'Test SMTP Connection' });
      fireEvent.click(testButton);

      // Wait for failure result
      await waitFor(() => {
        expect(screen.getByText(/❌ Connection Failed/)).toBeInTheDocument();
      });

      // Check that API was called correctly with form data
      expect(mockApiPost).toHaveBeenCalledWith('/notifications/email/test-connection', {
        emailEnabled: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 587,
        smtpUsername: 'test@example.com',
        smtpPassword: '',
        smtpUseSsl: false,
        senderEmail: 'sender@example.com',
        senderName: 'Test Sender',
      });

      // Check error details are displayed
      const etimedoutElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('ETIMEDOUT') || false;
      });
      expect(etimedoutElements.length).toBeGreaterThan(0);
      
      const responseElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('421 Service not available') || false;
      });
      expect(responseElements.length).toBeGreaterThan(0);
    });
  });
});

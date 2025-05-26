import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminConfigPage from '../AdminConfigPage';
import { ConfigProvider } from '../../store/ConfigContext';
import * as api from '../../lib/api';

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

// Mock console methods to capture debug logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

const mockConfig = {
  id: '1',
  campName: 'Test Camp',
  campDescription: 'A test camp',
  registrationYear: 2024,
  stripeEnabled: true,
  stripePublicKey: 'pk_test_123',
  paypalEnabled: false,
  paypalClientId: '',
  smtpHost: 'smtp.test.com',
  smtpPort: 587,
  smtpUsername: 'test@test.com',
  smtpUseSsl: false,
  // Note: Sensitive fields are excluded from API responses
  // stripeApiKey, stripeWebhookSecret, paypalClientSecret, smtpPassword are not included
};

const renderWithProviders = (component: React.ReactElement) => {
  const mockConfigContext = {
    config: mockConfig,
    publicConfig: mockConfig,
    refreshConfig: vi.fn(),
    isLoading: false
  };

  return render(
    <BrowserRouter>
      <ConfigProvider value={mockConfigContext}>
        {component}
      </ConfigProvider>
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
    (api.api.get as any).mockResolvedValue({
      data: mockConfig
    });

    renderWithProviders(<AdminConfigPage />);

    // Wait for the config to load
    await waitFor(() => {
      expect(api.api.get).toHaveBeenCalledWith('/core-config/current');
    });

    // Check that sensitive field inputs are empty and have proper placeholders
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    const stripeWebhookSecretInput = screen.getByLabelText(/Stripe Webhook Secret/i);
    const paypalClientSecretInput = screen.getByLabelText(/PayPal Client Secret/i);
    const smtpPasswordInput = screen.getByLabelText(/SMTP Password/i);

    expect(stripeApiKeyInput).toHaveValue('');
    expect(stripeWebhookSecretInput).toHaveValue('');
    expect(paypalClientSecretInput).toHaveValue('');
    expect(smtpPasswordInput).toHaveValue('');

    // Verify placeholders exist for guidance
    expect(stripeApiKeyInput).toHaveAttribute('placeholder', 'Leave blank to keep existing key');
    expect(stripeWebhookSecretInput).toHaveAttribute('placeholder', 'Leave blank to keep existing secret');
    expect(paypalClientSecretInput).toHaveAttribute('placeholder', 'Leave blank to keep existing secret');
    expect(smtpPasswordInput).toHaveAttribute('placeholder', 'Leave blank to keep existing password');
  });

  it('should exclude empty sensitive fields from API payload when saving', async () => {
    (api.api.get as any).mockResolvedValue({ data: mockConfig });
    (api.api.patch as any).mockResolvedValue({ status: 200, data: mockConfig });

    renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(api.api.get).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in some non-sensitive fields
    const campNameInput = screen.getByLabelText(/Camp Name/i);
    fireEvent.change(campNameInput, { target: { value: 'Updated Camp Name' } });

    // Leave sensitive fields empty (they should be excluded from payload)
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.api.patch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = (api.api.patch as any).mock.calls[0];
    const payload = patchCall[1];

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
    (api.api.get as any).mockResolvedValue({ data: mockConfig });
    (api.api.patch as any).mockResolvedValue({ status: 200, data: mockConfig });

    renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(api.api.get).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in some sensitive fields with actual values
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    const smtpPasswordInput = screen.getByLabelText(/SMTP Password/i);
    
    fireEvent.change(stripeApiKeyInput, { target: { value: 'sk_test_new_key' } });
    fireEvent.change(smtpPasswordInput, { target: { value: 'new_password123' } });

    // Leave other sensitive fields empty
    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.api.patch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = (api.api.patch as any).mock.calls[0];
    const payload = patchCall[1];

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
    (api.api.get as any).mockResolvedValue({ data: mockConfig });
    (api.api.patch as any).mockResolvedValue({ status: 200, data: mockConfig });

    renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(api.api.get).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill sensitive fields with only whitespace
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    const stripeWebhookSecretInput = screen.getByLabelText(/Stripe Webhook Secret/i);
    
    fireEvent.change(stripeApiKeyInput, { target: { value: '   ' } }); // Only spaces
    fireEvent.change(stripeWebhookSecretInput, { target: { value: '\t\n' } }); // Only tabs/newlines

    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.api.patch).toHaveBeenCalled();
    });

    // Get the payload that was sent
    const patchCall = (api.api.patch as any).mock.calls[0];
    const payload = patchCall[1];

    // Verify whitespace-only fields are NOT in the payload
    expect(payload).not.toHaveProperty('stripeApiKey');
    expect(payload).not.toHaveProperty('stripeWebhookSecret');

    // Verify debug log shows no sensitive fields included
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'Sensitive fields included in payload:',
      'none'
    );
  });

  it('should handle API errors gracefully when saving with sensitive fields', async () => {
    (api.api.get as any).mockResolvedValue({ data: mockConfig });
    (api.api.patch as any).mockRejectedValue(new Error('API Error'));

    renderWithProviders(<AdminConfigPage />);

    // Wait for config to load
    await waitFor(() => {
      expect(api.api.get).toHaveBeenCalledWith('/core-config/current');
    });

    // Fill in a sensitive field
    const stripeApiKeyInput = screen.getByLabelText(/Stripe Secret Key/i);
    fireEvent.change(stripeApiKeyInput, { target: { value: 'sk_test_key' } });

    const saveButton = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(api.api.patch).toHaveBeenCalled();
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
    (api.api.get as any).mockResolvedValue({ data: mockConfig });

    renderWithProviders(<AdminConfigPage />);

    await waitFor(() => {
      expect(api.api.get).toHaveBeenCalledWith('/core-config/current');
    });

    // Check that help text exists for sensitive fields (there are multiple instances)
    const helpTexts = screen.getAllByText(/Leave blank to keep the existing/i);
    expect(helpTexts).toHaveLength(4); // One for each sensitive field
    
    // Check that each sensitive field section has appropriate guidance
    const stripeSection = screen.getByText(/Stripe Secret Key/i).closest('div');
    const webhookSection = screen.getByText(/Stripe Webhook Secret/i).closest('div');
    const paypalSection = screen.getByText(/PayPal Client Secret/i).closest('div');
    const smtpSection = screen.getByText(/SMTP Password/i).closest('div');

    [stripeSection, webhookSection, paypalSection, smtpSection].forEach(section => {
      expect(section).toBeInTheDocument();
    });
  });
});

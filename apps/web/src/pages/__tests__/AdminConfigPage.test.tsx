import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminConfigPage from '../AdminConfigPage';
import { ConfigContext, type ConfigContextType } from '../../store/ConfigContextDefinition';
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

// Type the mocked API functions
const mockApiGet = api.api.get as ReturnType<typeof vi.fn>;
const mockApiPatch = api.api.patch as ReturnType<typeof vi.fn>;

// Mock console methods to capture debug logs
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

const mockConfig = {
  name: 'Test Camp',
  description: 'A test camp',
  homePageBlurb: 'Welcome to our test camp',
  registrationOpen: true,
  earlyRegistrationOpen: false,
  currentYear: 2024,
  stripeEnabled: true,
  stripePublicKey: 'pk_test_123',
  paypalEnabled: false,
  paypalClientId: '',
  // Note: Sensitive fields are excluded from API responses
  // stripeApiKey, paypalClientSecret, smtpPassword are not included
};

const renderWithProviders = (component: React.ReactElement) => {
  const mockConfigContext: ConfigContextType = {
    config: mockConfig,
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

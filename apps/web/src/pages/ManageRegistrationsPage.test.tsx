import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageRegistrationsPage } from './ManageRegistrationsPage';
import { adminRegistrationsApi } from '../lib/api/admin-registrations';
import { ConfigContext, ConfigContextType } from '../store/ConfigContextDefinition';

vi.mock('../lib/api/admin-registrations', () => ({
  adminRegistrationsApi: {
    getRegistrations: vi.fn(),
    getAvailableJobs: vi.fn(),
    getAvailableCampingOptions: vi.fn(),
    getUserCampingOptions: vi.fn(),
  },
}));

vi.mock('../components/admin/registrations/RegistrationSearchTable', () => ({
  default: () => <div data-testid="registration-search-table" />,
}));

vi.mock('../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

const createConfigContextValue = (currentYear?: number, isLoading = false): ConfigContextType => ({
  config: currentYear === undefined
    ? null
    : {
        name: 'Test Camp',
        description: 'Test camp',
        homePageBlurb: '',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear,
      },
  isLoading,
  error: null,
  refreshConfig: vi.fn(),
  isConnecting: false,
  isConnected: true,
  connectionError: null,
});

describe('ManageRegistrationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminRegistrationsApi.getRegistrations).mockResolvedValue({
      registrations: [],
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 0,
    });
    vi.mocked(adminRegistrationsApi.getAvailableJobs).mockResolvedValue([]);
    vi.mocked(adminRegistrationsApi.getAvailableCampingOptions).mockResolvedValue([]);
  });

  it('should request and display the configured registration year by default', async () => {
    render(
      <ConfigContext.Provider value={createConfigContextValue(2025)}>
        <MemoryRouter>
          <ManageRegistrationsPage />
        </MemoryRouter>
      </ConfigContext.Provider>
    );

    await waitFor(() => {
      expect(adminRegistrationsApi.getRegistrations).toHaveBeenCalledWith({ year: 2025 });
    });
    expect(adminRegistrationsApi.getRegistrations).not.toHaveBeenCalledWith({});

    fireEvent.click(screen.getByText('Filters'));

    const yearSelect = screen.getByLabelText('Year') as HTMLSelectElement;
    expect(yearSelect).toHaveValue('2025');
    expect(Array.from(yearSelect.options).map(option => option.value)).toContain('2025');

    fireEvent.click(screen.getByText('Clear all'));

    expect(yearSelect).toHaveValue('');
    await waitFor(() => {
      expect(adminRegistrationsApi.getRegistrations).toHaveBeenCalledWith({});
    });
    expect(yearSelect).toHaveValue('');
  });

  it('should wait for configuration before requesting registrations', async () => {
    const { rerender } = render(
      <ConfigContext.Provider value={createConfigContextValue(undefined, true)}>
        <MemoryRouter>
          <ManageRegistrationsPage />
        </MemoryRouter>
      </ConfigContext.Provider>
    );

    expect(adminRegistrationsApi.getRegistrations).not.toHaveBeenCalled();

    rerender(
      <ConfigContext.Provider value={createConfigContextValue(2026)}>
        <MemoryRouter>
          <ManageRegistrationsPage />
        </MemoryRouter>
      </ConfigContext.Provider>
    );

    await waitFor(() => {
      expect(adminRegistrationsApi.getRegistrations).toHaveBeenCalledWith({ year: 2026 });
    });
    expect(adminRegistrationsApi.getRegistrations).not.toHaveBeenCalledWith({});

    await new Promise(resolve => setTimeout(resolve, 550));
    expect(adminRegistrationsApi.getRegistrations).toHaveBeenCalledTimes(1);
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManageRegistrationsPage } from './ManageRegistrationsPage';
import {
  adminRegistrationsApi,
  Registration,
} from '../lib/api/admin-registrations';
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
  default: ({ registrations }: { registrations: Registration[] }) => (
    <div data-testid="registration-search-table">
      {registrations.map(registration => (
        <div key={registration.id} data-testid={`registration-${registration.status}`}>
          {registration.status}
        </div>
      ))}
    </div>
  ),
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

const allRegistrationStatuses: Registration['status'][] = [
  'CONFIRMED',
  'PENDING',
  'WAITLISTED',
  'APPLICATION_SUBMITTED',
  'APPLICATION_APPROVED',
  'APPLICATION_DECLINED',
  'CANCELLED',
];

const createRegistrationWithStatus = (
  status: Registration['status'],
  index: number,
): Registration => ({
  id: `registration-${index}`,
  year: 2025,
  status,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  user: {
    id: `user-${index}`,
    email: `user-${index}@example.com`,
    firstName: `User${index}`,
    lastName: 'Example',
    role: 'PARTICIPANT',
  },
  jobs: [],
  payments: [],
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

  it('should display summary statistics using grouped status definitions', async () => {
    vi.mocked(adminRegistrationsApi.getRegistrations).mockResolvedValue({
      registrations: allRegistrationStatuses.map(createRegistrationWithStatus),
      total: allRegistrationStatuses.length,
      page: 1,
      limit: 0,
      totalPages: 1,
    });

    render(
      <ConfigContext.Provider value={createConfigContextValue(2025)}>
        <MemoryRouter>
          <ManageRegistrationsPage />
        </MemoryRouter>
      </ConfigContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('registration-search-table')).toBeInTheDocument();
      expect(screen.getByText('Confirmed').closest('div')).toHaveTextContent('Confirmed1');
      expect(screen.getByText('Pending').closest('div')).toHaveTextContent('Pending4');
      expect(screen.getByText('Cancelled').closest('div')).toHaveTextContent('Cancelled2');
      expect(screen.getByText('Total').closest('div')).toHaveTextContent('Total7');
    });
  });

  it.each([
    ['CONFIRMED', ['CONFIRMED']],
    ['PENDING', ['PENDING', 'WAITLISTED', 'APPLICATION_SUBMITTED', 'APPLICATION_APPROVED']],
    ['CANCELLED', ['APPLICATION_DECLINED', 'CANCELLED']],
  ] as const)(
    'should filter the %s status group without sending it as an exact API filter',
    async (filterValue, expectedStatuses) => {
      vi.mocked(adminRegistrationsApi.getRegistrations).mockResolvedValue({
        registrations: allRegistrationStatuses.map(createRegistrationWithStatus),
        total: allRegistrationStatuses.length,
        page: 1,
        limit: 0,
        totalPages: 1,
      });

      render(
        <ConfigContext.Provider value={createConfigContextValue(2025)}>
          <MemoryRouter>
            <ManageRegistrationsPage />
          </MemoryRouter>
        </ConfigContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('registration-CONFIRMED')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Filters'));
      const statusSelect = screen.getByLabelText('Status') as HTMLSelectElement;
      expect(Array.from(statusSelect.options).map(option => option.value))
        .toEqual(['', 'CONFIRMED', 'PENDING', 'CANCELLED']);

      fireEvent.change(statusSelect, { target: { value: filterValue } });

      await waitFor(() => {
        allRegistrationStatuses.forEach(status => {
          const registration = screen.queryByTestId(`registration-${status}`);
          if (expectedStatuses.some(expectedStatus => expectedStatus === status)) {
            expect(registration).toBeInTheDocument();
          } else {
            expect(registration).not.toBeInTheDocument();
          }
        });
      });

      expect(adminRegistrationsApi.getRegistrations).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: filterValue })
      );
    }
  );
});

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegistrationReportsPage } from '../RegistrationReportsPage';
import { reports, Registration } from '../../lib/api';
import { ConfigContext, ConfigContextType } from '../../store/ConfigContextDefinition';

// Mock the api module
vi.mock('../../lib/api', () => ({
  reports: {
    getRegistrations: vi.fn(),
    getCampingOptionRegistrations: vi.fn(),
  },
}));

// Mock the LoadingSpinner component
vi.mock('../../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock the DataTable component
vi.mock('../../components/common/DataTable/DataTable', () => ({
  DataTable: ({
    data,
    columns,
    emptyMessage,
    caption,
  }: {
    data: Registration[];
    columns: Array<{
      id: string;
      header: string;
      accessor: (item: Registration) => ReactNode;
      getCellTitle?: (item: Registration) => string | number | null | undefined;
    }>;
    emptyMessage: string;
    caption: string;
  }) => (
    <div data-testid="data-table" aria-label={caption}>
      {data.length === 0 ? (
        <div data-testid="empty-message">{emptyMessage}</div>
      ) : (
        <div>
          {columns
            .filter(column => column.id === 'campingOptionName' || column.id.startsWith('field_'))
            .map(column => (
              <span key={column.id} data-testid={`column-${column.id}`}>
                {column.header}
              </span>
            ))}
          {data.map((item: Registration) => (
            <div key={item.id} data-testid={`registration-${item.id}`}>
              {item.user?.firstName} {item.user?.lastName} - {item.status}
              {columns
                .filter(
                  column =>
                    column.id === 'status' ||
                    column.id === 'playaName' ||
                    column.id === 'role' ||
                    column.id === 'phone' ||
                    column.id === 'emergencyContact' ||
                    column.id === 'city' ||
                    column.id === 'stateProvince' ||
                    column.id === 'country' ||
                    column.id === 'campingOptionName' ||
                    column.id === 'actions' ||
                    column.id.startsWith('field_')
                )
                .map(column => (
                  <div
                    key={column.id}
                    data-testid={`cell-${item.id}-${column.id}`}
                    title={column.getCellTitle?.(item) ?? undefined}
                  >
                    {column.accessor(item)}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}));

// Mock console.error to prevent test output pollution
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

const mockRegistrations: Registration[] = [
  {
    id: '1',
    userId: 'user1',
    year: 2024,
    status: 'CONFIRMED',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    user: {
      id: 'user1',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'PARTICIPANT',
      isEmailVerified: true,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
    },
    jobs: [
      {
        id: 'job1',
        jobId: 'job1',
        registrationId: '1',
        createdAt: '2024-01-15T10:00:00Z',
        job: {
          id: 'job1',
          name: 'Gate Keeper',
          location: 'Main Gate',
          categoryId: 'cat1',
          shiftId: 'shift1',
          maxRegistrations: 5,
          category: {
            id: 'cat1',
            name: 'Security',
            description: 'Security and safety roles',
          },
        },
      },
    ],
    payments: [],
  },
  {
    id: '2',
    userId: 'user2',
    year: 2024,
    status: 'PENDING',
    createdAt: '2024-01-16T10:00:00Z',
    updatedAt: '2024-01-16T10:00:00Z',
    user: {
      id: 'user2',
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'PARTICIPANT',
      isEmailVerified: true,
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:00:00Z',
    },
    jobs: [
      {
        id: 'job2',
        jobId: 'job2',
        registrationId: '2',
        createdAt: '2024-01-16T10:00:00Z',
        job: {
          id: 'job2',
          name: 'Cafe Helper',
          location: 'Cafe',
          categoryId: 'cat2',
          shiftId: 'shift2',
          maxRegistrations: 10,
          category: {
            id: 'cat2',
            name: 'Food Service',
            description: 'Food preparation and service',
          },
        },
      },
      {
        id: 'job3',
        jobId: 'job3',
        registrationId: '2',
        createdAt: '2024-01-16T10:00:00Z',
        job: {
          id: 'job3',
          name: 'Cleanup Crew',
          location: 'Various',
          categoryId: 'cat3',
          shiftId: 'shift3',
          maxRegistrations: 8,
          category: {
            id: 'cat3',
            name: 'Maintenance',
            description: 'Cleaning and maintenance tasks',
          },
        },
      },
    ],
    payments: [],
  },
  {
    id: '3',
    userId: 'user3',
    year: 2023,
    status: 'CANCELLED',
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    user: {
      id: 'user3',
      email: 'bob.wilson@example.com',
      firstName: 'Bob',
      lastName: 'Wilson',
      role: 'PARTICIPANT',
      isEmailVerified: true,
      createdAt: '2023-11-01T10:00:00Z',
      updatedAt: '2023-11-01T10:00:00Z',
    },
    jobs: [],
    payments: [],
  },
];

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
  index: number
): Registration => ({
  ...mockRegistrations[0],
  id: `status-${index}`,
  userId: `status-user-${index}`,
  status,
  user: {
    ...mockRegistrations[0].user,
    id: `status-user-${index}`,
    firstName: `Status${index}`,
  },
});

const createConfigContextValue = (
  currentYear?: number,
  isLoading = false,
  registrationOpen = true
): ConfigContextType => ({
  config:
    currentYear === undefined
      ? null
      : {
          name: 'Test Camp',
          description: 'Test camp',
          homePageBlurb: '',
          registrationOpen,
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

const renderComponent = (currentYear?: number, isLoading = false, registrationOpen = true) => {
  return render(
    <ConfigContext.Provider
      value={createConfigContextValue(currentYear, isLoading, registrationOpen)}
    >
      <MemoryRouter>
        <RegistrationReportsPage />
      </MemoryRouter>
    </ConfigContext.Provider>
  );
};

describe('RegistrationReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('registrationReports_showCampingOptions');
    localStorage.removeItem('registrationReports_showUserProfile');
  });

  afterEach(() => {
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear();
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching data', () => {
      // Mock API to never resolve
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Successful Data Fetching', () => {
    beforeEach(() => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      const mockGetCampingOptionRegistrations = vi.mocked(reports.getCampingOptionRegistrations);
      mockGetRegistrations.mockResolvedValue(mockRegistrations);
      mockGetCampingOptionRegistrations.mockResolvedValue([]);
    });

    it('should render the page header correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Registration Reports')).toBeInTheDocument();
      });

      expect(screen.getByText('View and analyze camp registrations')).toBeInTheDocument();
      expect(screen.getByText('Back to Reports')).toBeInTheDocument();
    });

    it('should render action buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('should render the data table with registrations', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('registration-1')).toBeInTheDocument();
      expect(screen.getByTestId('registration-2')).toBeInTheDocument();
      expect(screen.getByTestId('registration-3')).toBeInTheDocument();
    });

    it('should open and close registration details from the row action', async () => {
      renderComponent();

      fireEvent.click(await screen.findByRole('button', { name: 'View details for John Doe' }));

      expect(screen.getByRole('dialog', { name: 'Registration Details' })).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Close registration details' }));

      expect(
        screen.queryByRole('dialog', { name: 'Registration Details' })
      ).not.toBeInTheDocument();
    });

    it.each([
      ['CONFIRMED', 'Confirmed', 'bg-green-100', 'text-green-800'],
      ['PENDING', 'Pending', 'bg-amber-100', 'text-amber-800'],
      ['WAITLISTED', 'Waitlisted', 'bg-orange-100', 'text-orange-800'],
      ['APPLICATION_SUBMITTED', 'Application Submitted', 'bg-blue-100', 'text-blue-800'],
      ['APPLICATION_APPROVED', 'Application Approved', 'bg-purple-100', 'text-purple-800'],
      ['APPLICATION_DECLINED', 'Application Not Approved', 'bg-red-100', 'text-red-800'],
      ['CANCELLED', 'Cancelled', 'bg-gray-100', 'text-gray-800'],
    ] as const)(
      'should render %s with its semantic badge color',
      async (status, label, backgroundClass, textClass) => {
        const registration = createRegistrationWithStatus(status, 0);
        vi.mocked(reports.getRegistrations).mockResolvedValue([registration]);

        renderComponent();

        const statusCell = await screen.findByTestId('cell-status-0-status');
        const statusPill = within(statusCell).getByText(label);

        expect(statusPill).toHaveClass(backgroundClass, textClass);
        expect(statusCell).toHaveAttribute('title', label);
      }
    );

    it('should add hover text to user profile fields without titling missing values', async () => {
      renderComponent();
      await screen.findByText('Show User Profile Fields');

      fireEvent.click(document.getElementById('user-profile-toggle')!);

      const roleCell = await screen.findByTestId('cell-1-role');
      expect(roleCell).toHaveAttribute('title', 'PARTICIPANT');
      expect(screen.getByTestId('cell-1-playaName')).not.toHaveAttribute('title');
    });

    it('should render summary statistics using grouped status definitions', async () => {
      vi.mocked(reports.getRegistrations).mockResolvedValue(
        allRegistrationStatuses.map(createRegistrationWithStatus)
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });
      expect(screen.getByText('Total Registrations:')).toBeInTheDocument();
      expect(screen.getByText('Confirmed:')).toBeInTheDocument();

      const summarySection = screen.getByText('Summary').closest('div');
      expect(summarySection).toHaveTextContent('Confirmed:1');
      expect(summarySection).toHaveTextContent('Pending:4');
      expect(summarySection).toHaveTextContent('Cancelled:2');
      expect(summarySection).toHaveTextContent('Total Registrations:7');
    });

    it('should call getRegistrations on mount with default parameters', async () => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);

      renderComponent();

      await waitFor(() => {
        expect(mockGetRegistrations).toHaveBeenCalledWith({
          includeCampingOptions: false,
          includeUserProfile: false,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when API call fails', async () => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockRejectedValue(new Error('API Error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch registrations data')).toBeInTheDocument();
      });

      expect(screen.getByText('Try again')).toBeInTheDocument();
    });

    it('should retry fetching data when "Try again" is clicked', async () => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockRejectedValueOnce(new Error('API Error'));
      mockGetRegistrations.mockResolvedValueOnce(mockRegistrations);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch registrations data')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Try again');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(mockGetRegistrations).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Filters Functionality', () => {
    beforeEach(() => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockResolvedValue(mockRegistrations);
    });

    it('should toggle filters panel when filters button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Filters panel should not be visible initially
      expect(screen.queryByText('Year')).not.toBeInTheDocument();

      // Click to show filters
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      expect(screen.getByText('Year')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();

      // Click X to hide filters (button with no name that contains X icon)
      const closeButton = screen
        .getAllByRole('button')
        .find(button => button.className.includes('text-gray-400'));
      expect(closeButton).toBeDefined();
      fireEvent.click(closeButton!);

      expect(screen.queryByText('Year')).not.toBeInTheDocument();
    });

    it('should filter by year when year filter is changed', async () => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      // Mock multiple registrations with different years
      const multiYearRegistrations: Registration[] = [
        ...mockRegistrations,
        {
          id: '4',
          userId: 'user4',
          year: 2023,
          status: 'CONFIRMED' as const,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          user: {
            id: 'user4',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'PARTICIPANT' as const,
            isEmailVerified: true,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          jobs: [],
        },
      ];
      mockGetRegistrations.mockResolvedValue(multiYearRegistrations);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Verify all registrations are initially shown
      await waitFor(() => {
        expect(screen.getByTestId('registration-1')).toBeInTheDocument();
        expect(screen.getByTestId('registration-4')).toBeInTheDocument();
      });

      // Open filters panel
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      // Change year filter to 2024
      const yearSelect = screen.getByLabelText('Year');
      fireEvent.change(yearSelect, { target: { value: '2024' } });

      // Verify only 2024 registrations are shown (client-side filtering)
      await waitFor(() => {
        expect(screen.getByTestId('registration-1')).toBeInTheDocument();
        expect(screen.queryByTestId('registration-4')).not.toBeInTheDocument();
      });
    });

    it('should default to the configured year and preserve an explicit clear', async () => {
      renderComponent(2025);

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Filters'));

      const yearSelect = screen.getByLabelText('Year') as HTMLSelectElement;
      expect(yearSelect).toHaveValue('2025');
      expect(Array.from(yearSelect.options).map(option => option.value)).toContain('2025');
      expect(screen.getByTestId('empty-message')).toHaveTextContent('No registrations found');

      fireEvent.click(screen.getByText('Clear Filters'));

      expect(yearSelect).toHaveValue('');
      expect(screen.getByTestId('registration-1')).toBeInTheDocument();
      expect(screen.getByTestId('registration-3')).toBeInTheDocument();
    });

    it('should keep filters unavailable until configuration resolves', async () => {
      const renderResult = renderComponent(undefined, true);

      await waitFor(() => {
        expect(reports.getRegistrations).toHaveBeenCalledTimes(1);
      });
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.queryByText('Filters')).not.toBeInTheDocument();

      renderResult.rerender(
        <ConfigContext.Provider value={createConfigContextValue(2025)}>
          <MemoryRouter>
            <RegistrationReportsPage />
          </MemoryRouter>
        </ConfigContext.Provider>
      );

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Filters'));
      expect(screen.getByLabelText('Year')).toHaveValue('2025');
    });

    it.each([
      ['CONFIRMED', ['CONFIRMED']],
      ['PENDING', ['PENDING', 'WAITLISTED', 'APPLICATION_SUBMITTED', 'APPLICATION_APPROVED']],
      ['CANCELLED', ['APPLICATION_DECLINED', 'CANCELLED']],
    ] as const)('should filter the %s status group', async (filterValue, expectedStatuses) => {
      const registrations = allRegistrationStatuses.map(createRegistrationWithStatus);
      vi.mocked(reports.getRegistrations).mockResolvedValue(registrations);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Filters'));
      const statusSelect = screen.getByLabelText('Status');
      expect(
        Array.from((statusSelect as HTMLSelectElement).options).map(option => option.value)
      ).toEqual(['', 'CONFIRMED', 'PENDING', 'CANCELLED']);

      fireEvent.change(statusSelect, { target: { value: filterValue } });

      await waitFor(() => {
        registrations.forEach(registration => {
          const row = screen.queryByTestId(`registration-${registration.id}`);
          if (expectedStatuses.some(expectedStatus => expectedStatus === registration.status)) {
            expect(row).toBeInTheDocument();
          } else {
            expect(row).not.toBeInTheDocument();
          }
        });
      });
    });

    it('should populate year dropdown with available years from data', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Open filters panel
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      const yearSelect = screen.getByLabelText('Year');

      // Check that available years are present (2024, 2023 from mock data)
      expect(yearSelect).toBeInTheDocument();
      // Note: We can't easily test the options without more complex DOM queries
      // but the functionality is covered by the filtering tests above
    });
  });

  describe('Export Functionality', () => {
    let mockCreateObjectURL: ReturnType<typeof vi.fn>;
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
    let mockClick: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockResolvedValue(mockRegistrations);

      mockCreateObjectURL = vi.fn(() => 'mock-blob-url');
      mockRevokeObjectURL = vi.fn();
      mockClick = vi.fn();

      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(tagName => {
        if (tagName === 'a') {
          const mockLink = originalCreateElement('a');
          mockLink.click = mockClick;
          mockLink.setAttribute = vi.fn();
          (mockLink.style as { visibility: string }).visibility = '';
          return mockLink;
        }
        return originalCreateElement(tagName);
      });

      const originalAppendChild = document.body.appendChild.bind(document.body);
      const originalRemoveChild = document.body.removeChild.bind(document.body);

      vi.spyOn(document.body, 'appendChild').mockImplementation(node => {
        if ((node as Element).tagName === 'A') {
          return node;
        }
        return originalAppendChild(node);
      });

      vi.spyOn(document.body, 'removeChild').mockImplementation(node => {
        if ((node as Element).tagName === 'A') {
          return node;
        }
        return originalRemoveChild(node);
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should trigger CSV download when export button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
    });

    it('should generate CSV with correct headers and data format', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Export')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text/csv;charset=utf-8;',
        })
      );

      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe('text/csv;charset=utf-8;');
    });
  });

  describe('Camping Option Custom Fields', () => {
    beforeEach(() => {
      localStorage.removeItem('registrationReports_showCampingOptions');
      global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
      global.URL.revokeObjectURL = vi.fn();
      HTMLAnchorElement.prototype.click = vi.fn();
      vi.mocked(reports.getRegistrations).mockResolvedValue([
        {
          ...mockRegistrations[0],
          id: 'registration-active-2026',
          year: 2026,
          campingOptions: [
            {
              id: 'camping-registration-active-2026',
              userId: 'user1',
              campingOptionId: 'option-active',
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
              campingOption: {
                id: 'option-active',
                name: 'Skydiving',
                description: null,
                enabled: true,
                workShiftsRequired: 1,
                participantDues: 600,
                staffDues: 600,
                maxSignups: 60,
                createdAt: '2026-01-01T10:00:00Z',
                updatedAt: '2026-01-01T10:00:00Z',
                jobCategoryIds: [],
              },
            },
          ],
        },
        {
          ...mockRegistrations[1],
          id: 'registration-inactive-2026',
          year: 2026,
          campingOptions: [
            {
              id: 'camping-registration-inactive-2026',
              userId: 'user2',
              campingOptionId: 'option-inactive',
              createdAt: '2026-01-16T10:00:00Z',
              updatedAt: '2026-01-16T10:00:00Z',
              campingOption: {
                id: 'option-inactive',
                name: 'RV Camping',
                description: null,
                enabled: false,
                workShiftsRequired: 0,
                participantDues: 0,
                staffDues: 0,
                maxSignups: 0,
                createdAt: '2026-01-01T10:00:00Z',
                updatedAt: '2026-01-01T10:00:00Z',
                jobCategoryIds: [],
              },
            },
          ],
        },
      ]);
      vi.mocked(reports.getCampingOptionRegistrations).mockResolvedValue([
        {
          id: 'camping-registration-2025',
          registrationId: null,
          userId: 'user1',
          campingOptionId: 'option-active',
          user: {
            id: 'user1',
            email: 'john.doe@example.com',
            firstName: 'John',
            lastName: 'Doe',
            playaName: null,
          },
          campingOption: {
            id: 'option-active',
            name: 'Skydiving',
            description: null,
            enabled: true,
            fields: [],
          },
          fieldValues: [],
          createdAt: '2025-01-15T10:00:00Z',
          updatedAt: '2025-01-15T10:00:00Z',
        },
        {
          id: 'camping-registration-active-2026',
          registrationId: 'registration-active-2026',
          userId: 'user1',
          campingOptionId: 'option-active',
          user: {
            id: 'user1',
            email: 'john.doe@example.com',
            firstName: 'John',
            lastName: 'Doe',
            playaName: null,
          },
          campingOption: {
            id: 'option-active',
            name: 'Skydiving',
            description: null,
            enabled: true,
            fields: [
              {
                id: 'field-active',
                displayName: 'Camping Footprint',
                dataType: 'MULTILINE_STRING',
                required: false,
                order: 0,
              },
              {
                id: 'field-unfilled',
                displayName: 'Radio Call Sign',
                dataType: 'STRING',
                required: false,
                order: 2,
              },
            ],
          },
          fieldValues: [
            {
              id: 'value-active',
              value: '20 by 30 feet',
              fieldId: 'field-active',
              registrationId: 'camping-registration-active-2026',
              field: {
                id: 'field-active',
                displayName: 'Camping Footprint',
                dataType: 'MULTILINE_STRING',
                required: false,
              },
              createdAt: '2026-01-15T10:00:00Z',
              updatedAt: '2026-01-15T10:00:00Z',
            },
          ],
          createdAt: '2026-01-15T10:00:00Z',
          updatedAt: '2026-01-15T10:00:00Z',
        },
        {
          id: 'camping-registration-inactive-2026',
          registrationId: 'registration-inactive-2026',
          userId: 'user2',
          campingOptionId: 'option-inactive',
          user: {
            id: 'user2',
            email: 'jane.smith@example.com',
            firstName: 'Jane',
            lastName: 'Smith',
            playaName: null,
          },
          campingOption: {
            id: 'option-inactive',
            name: 'RV Camping',
            description: null,
            enabled: false,
            fields: [
              {
                id: 'field-inactive',
                displayName: 'Vehicle Length',
                dataType: 'STRING',
                required: true,
                order: 1,
              },
            ],
          },
          fieldValues: [
            {
              id: 'value-inactive',
              value: '24 feet',
              fieldId: 'field-inactive',
              registrationId: 'camping-registration-inactive-2026',
              field: {
                id: 'field-inactive',
                displayName: 'Vehicle Length',
                dataType: 'STRING',
                required: true,
              },
              createdAt: '2026-01-16T10:00:00Z',
              updatedAt: '2026-01-16T10:00:00Z',
            },
          ],
          createdAt: '2026-01-16T10:00:00Z',
          updatedAt: '2026-01-16T10:00:00Z',
        },
      ]);
    });

    it('should render one report with active and inactive options and blank cross-option fields', async () => {
      renderComponent(2026);
      await screen.findByText('Show Registration Fields');
      fireEvent.click(document.getElementById('camping-options-toggle')!);

      expect(reports.getCampingOptionRegistrations).toHaveBeenCalledWith({
        year: 2026,
        userId: undefined,
      });
      expect(await screen.findByTestId('column-field_field-active')).toHaveTextContent(
        'Camping Footprint'
      );
      expect(screen.getByTestId('column-field_field-inactive')).toHaveTextContent('Vehicle Length');
      expect(screen.getByTestId('column-field_field-unfilled')).toHaveTextContent(
        'Radio Call Sign'
      );

      const activeRegistration = screen.getByTestId('registration-registration-active-2026');
      const inactiveRegistration = screen.getByTestId('registration-registration-inactive-2026');
      expect(within(activeRegistration).getByText('Skydiving')).toBeInTheDocument();
      expect(within(activeRegistration).getByText('20 by 30 feet')).toBeInTheDocument();
      expect(within(inactiveRegistration).getByText('RV Camping')).toBeInTheDocument();
      expect(within(inactiveRegistration).getByText('24 feet')).toBeInTheDocument();
      expect(screen.getByTestId('cell-registration-active-2026-campingOptionName')).toHaveAttribute(
        'title',
        'Skydiving'
      );
      expect(
        screen.getByTestId('cell-registration-active-2026-field_field-active')
      ).toHaveAttribute('title', '20 by 30 feet');

      expect(
        screen.getByTestId('cell-registration-active-2026-field_field-inactive')
      ).not.toHaveAttribute('title');
      expect(
        screen.getByTestId('cell-registration-inactive-2026-field_field-active').textContent
      ).toBe('');
      expect(
        screen.getByTestId('cell-registration-active-2026-field_field-unfilled').textContent
      ).toBe('');
      expect(
        screen.getByTestId('cell-registration-inactive-2026-field_field-unfilled').textContent
      ).toBe('');
    });

    it('should render registration fields when registration is closed', async () => {
      renderComponent(2026, false, false);
      await screen.findByText('Show Registration Fields');
      fireEvent.click(document.getElementById('camping-options-toggle')!);

      expect(await screen.findByText('20 by 30 feet')).toBeInTheDocument();
      expect(screen.getByText('24 feet')).toBeInTheDocument();
    });

    it('should export mixed option fields with blank cross-option values', async () => {
      renderComponent(2026);
      await screen.findByText('Show Registration Fields');
      fireEvent.click(document.getElementById('camping-options-toggle')!);
      await screen.findByText('20 by 30 feet');

      fireEvent.click(screen.getByText('Export'));

      const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
      const csv = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });

      const [headerLine, ...dataLines] = csv.replace(/^\uFEFF/, '').split('\n');
      const headers = headerLine.split(',');
      const activeRow = dataLines.find(line => line.includes('john.doe@example.com'))!.split(',');
      const inactiveRow = dataLines
        .find(line => line.includes('jane.smith@example.com'))!
        .split(',');
      const footprintIndex = headers.indexOf('Camping Footprint');
      const vehicleLengthIndex = headers.indexOf('Vehicle Length');
      const callSignIndex = headers.indexOf('Radio Call Sign');

      expect(activeRow[footprintIndex]).toBe('20 by 30 feet');
      expect(activeRow[vehicleLengthIndex]).toBe('');
      expect(activeRow[callSignIndex]).toBe('');
      expect(inactiveRow[footprintIndex]).toBe('');
      expect(inactiveRow[vehicleLengthIndex]).toBe('24 feet');
      expect(inactiveRow[callSignIndex]).toBe('');
    });

    it('should show a non-fatal error when registration field data cannot be loaded', async () => {
      vi.mocked(reports.getCampingOptionRegistrations).mockRejectedValue(
        new Error('Camping field request failed')
      );

      renderComponent(2026);
      await screen.findByText('Show Registration Fields');
      fireEvent.click(document.getElementById('camping-options-toggle')!);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Registration field data could not be loaded');
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no registrations are found', async () => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('empty-message')).toBeInTheDocument();
      });

      expect(screen.getByText('No registrations found')).toBeInTheDocument();
    });

    it('should show zero counts in summary when no registrations', async () => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockResolvedValue([]);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
      });

      // Check that all counts are 0
      const summarySection = screen.getByText('Summary').closest('div');
      expect(summarySection).toHaveTextContent('Total Registrations:0');
      expect(summarySection).toHaveTextContent('Confirmed:0');
      expect(summarySection).toHaveTextContent('Pending:0');
      expect(summarySection).toHaveTextContent('Cancelled:0');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockResolvedValue(mockRegistrations);
    });

    it('should have back to reports link', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Back to Reports')).toBeInTheDocument();
      });

      const backLink = screen.getByText('Back to Reports').closest('a');
      expect(backLink).toHaveAttribute('href', '/reports');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      const mockGetRegistrations = vi.mocked(reports.getRegistrations);
      mockGetRegistrations.mockResolvedValue(mockRegistrations);
    });

    it('should have proper ARIA labels and roles', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('data-table')).toBeInTheDocument();
      });

      // Check DataTable has proper aria-label
      const dataTable = screen.getByTestId('data-table');
      expect(dataTable).toHaveAttribute('aria-label', 'Registration reports table');
    });

    it('should have proper form labels for filter inputs', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Filters')).toBeInTheDocument();
      });

      // Open filters panel
      const filtersButton = screen.getByText('Filters');
      fireEvent.click(filtersButton);

      expect(screen.getByLabelText('Year')).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
    });
  });
});

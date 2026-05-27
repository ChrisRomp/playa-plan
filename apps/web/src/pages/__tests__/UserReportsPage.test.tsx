import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserReportsPage } from '../UserReportsPage';
import { reports, User } from '../../lib/api';

// Mock the api module
vi.mock('../../lib/api', () => ({
  reports: {
    getUsers: vi.fn(),
    getRegistrationYearUsers: vi.fn(),
  },
}));

// Mock the useConfig hook
vi.mock('../../hooks/useConfig', () => ({
  useConfig: vi.fn(),
}));

import { useConfig } from '../../hooks/useConfig';
const mockUseConfig = vi.mocked(useConfig);

// Mock the LoadingSpinner component
vi.mock('../../components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock the DataTable component
vi.mock('../../components/common/DataTable/DataTable', () => ({
  DataTable: ({ data, emptyMessage }: { data: User[]; emptyMessage: string }) => (
    <div data-testid="data-table">
      {data.length === 0 ? (
        <div data-testid="empty-message">{emptyMessage}</div>
      ) : (
        <div>
          {data.map((item: User) => (
            <div key={item.id} data-testid={`user-${item.id}`}>
              {item.firstName} {item.lastName}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}));

// Mock console.error to prevent test output pollution
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

const mockUsers: User[] = [
  {
    id: 'user1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'PARTICIPANT',
    isEmailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user2',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Jones',
    role: 'STAFF',
    isEmailVerified: false,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'user3',
    email: 'carol@example.com',
    firstName: 'Carol',
    lastName: 'Lee',
    role: 'ADMIN',
    isEmailVerified: true,
    createdAt: '2023-06-01T00:00:00Z',
    updatedAt: '2023-06-01T00:00:00Z',
  },
];

const mockRegistrationYearUsers = [
  { year: 2024, userId: 'user1' },
  { year: 2024, userId: 'user2' },
  { year: 2023, userId: 'user1' },
  { year: 2023, userId: 'user3' },
];

describe('UserReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reports.getUsers).mockResolvedValue(mockUsers);
    vi.mocked(reports.getRegistrationYearUsers).mockResolvedValue(mockRegistrationYearUsers);
    mockUseConfig.mockReturnValue({
      config: {
        name: 'Test Camp',
        description: 'Test',
        homePageBlurb: '',
        registrationOpen: true,
        earlyRegistrationOpen: false,
        currentYear: 2024,
      },
      isLoading: false,
      error: null,
      refreshConfig: vi.fn(),
      isConnecting: false,
      isConnected: true,
      connectionError: null,
    });
  });

  afterEach(() => {
    mockConsoleError.mockClear();
  });

  it('applies the default year filter from config', async () => {
    render(
      <MemoryRouter>
        <UserReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // With currentYear=2024, only user1 and user2 have registrations for 2024
    expect(screen.getByTestId('user-user1')).toBeInTheDocument();
    expect(screen.getByTestId('user-user2')).toBeInTheDocument();
    expect(screen.queryByTestId('user-user3')).not.toBeInTheDocument();
  });

  it('derives year options from registration data', async () => {
    render(
      <MemoryRouter>
        <UserReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Open the filters panel
    fireEvent.click(screen.getByLabelText('Toggle filters'));

    const yearSelect = screen.getByLabelText('Year') as HTMLSelectElement;
    const options = Array.from(yearSelect.options).map(o => o.value);
    // Should have All Years (''), 2024, and 2023 (sorted desc)
    expect(options).toEqual(['', '2024', '2023']);
  });

  it('filters users by registrations for the selected year', async () => {
    render(
      <MemoryRouter>
        <UserReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Open filters panel
    fireEvent.click(screen.getByLabelText('Toggle filters'));

    // Change year filter to 2023
    const yearSelect = screen.getByLabelText('Year');
    fireEvent.change(yearSelect, { target: { value: '2023' } });

    // For year 2023, only user1 and user3 have registrations
    await waitFor(() => {
      expect(screen.getByTestId('user-user1')).toBeInTheDocument();
      expect(screen.getByTestId('user-user3')).toBeInTheDocument();
      expect(screen.queryByTestId('user-user2')).not.toBeInTheDocument();
    });
  });

  it('shows all users when year filter is cleared', async () => {
    render(
      <MemoryRouter>
        <UserReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    // Open filters panel
    fireEvent.click(screen.getByLabelText('Toggle filters'));

    // Clear year filter to "All Years"
    const yearSelect = screen.getByLabelText('Year');
    fireEvent.change(yearSelect, { target: { value: '' } });

    // All users should appear
    await waitFor(() => {
      expect(screen.getByTestId('user-user1')).toBeInTheDocument();
      expect(screen.getByTestId('user-user2')).toBeInTheDocument();
      expect(screen.getByTestId('user-user3')).toBeInTheDocument();
    });
  });

  it('displays error state and retry button', async () => {
    vi.mocked(reports.getUsers).mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <UserReportsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch user and registration data')).toBeInTheDocument();
    });

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });
});

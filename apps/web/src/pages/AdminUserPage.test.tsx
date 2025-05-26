import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminUserPage from './AdminUserPage';
import * as useUsersModule from '../hooks/useUsers';
import { User } from '../types/users';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn()
  };
});

// Mock the useUsers hook
vi.mock('../hooks/useUsers', () => {
  const originalModule = vi.importActual('../hooks/useUsers');
  return {
    ...originalModule,
    useUsers: vi.fn()
  };
});

describe('AdminUserPage', () => {
  // Use the exact string literals expected by the User type
  const mockUsers = [
    {
      id: '1',
      email: 'admin@example.playaplan.app',
      firstName: 'Admin',
      lastName: 'User',
      playaName: 'Playa Admin',
      role: 'ADMIN',
      isEmailVerified: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      profilePicture: null,
      allowRegistration: true,
      allowEarlyRegistration: true,
      allowDeferredDuesPayment: true,
      allowNoJob: true,
    },
    {
      id: '2',
      email: 'staff@example.playaplan.app',
      firstName: 'Staff',
      lastName: 'User',
      playaName: null,
      role: 'STAFF',
      isEmailVerified: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z',
      profilePicture: null,
      allowRegistration: true,
      allowEarlyRegistration: false,
      allowDeferredDuesPayment: false,
      allowNoJob: false,
    }
  ] as User[];

  // Mock implementation of useUsers
  const mockUseUsers = () => {
    return {
      users: mockUsers,
      loading: false,
      error: null,
      fetchUsers: vi.fn(),
      getUser: vi.fn(),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      deleteUser: vi.fn(),
      selectedUser: null,
      setSelectedUser: vi.fn(),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useUsersModule, 'useUsers').mockImplementation(mockUseUsers);
  });

  it('renders the user management page', () => {
    render(
      <BrowserRouter>
        <AdminUserPage />
      </BrowserRouter>
    );

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Add User')).toBeInTheDocument();
    expect(screen.getByText('Back to Admin')).toBeInTheDocument();
  });

  it('displays the list of users', () => {
    render(
      <BrowserRouter>
        <AdminUserPage />
      </BrowserRouter>
    );

    // User 1
    expect(screen.getByText('Admin User (Playa Admin)')).toBeInTheDocument();
    expect(screen.getByText('admin@example.playaplan.app')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();

    // User 2
    expect(screen.getByText('Staff User')).toBeInTheDocument();
    expect(screen.getByText('staff@example.playaplan.app')).toBeInTheDocument();
    expect(screen.getByText('STAFF')).toBeInTheDocument();
  });

  it('shows the create user form when add user is clicked', () => {
    render(
      <BrowserRouter>
        <AdminUserPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText('Add User'));
    
    expect(screen.getByText('Create New User')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/)).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Role/)).toBeInTheDocument();
  });

  it('shows the edit user form when a user is selected', async () => {
    render(
      <BrowserRouter>
        <AdminUserPage />
      </BrowserRouter>
    );

    // Click on first user
    fireEvent.click(screen.getByText('Admin User (Playa Admin)'));
    
    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });
  });

  it('displays an error message when there is an error', () => {
    vi.spyOn(useUsersModule, 'useUsers').mockImplementation(() => ({
      ...mockUseUsers(),
      error: 'Failed to fetch users',
    }));

    render(
      <BrowserRouter>
        <AdminUserPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Error: Failed to fetch users')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('displays a loading indicator when loading', () => {
    vi.spyOn(useUsersModule, 'useUsers').mockImplementation(() => ({
      ...mockUseUsers(),
      loading: true,
    }));

    render(
      <BrowserRouter>
        <AdminUserPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
}); 
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import UserDashboard from './UserDashboard';
import { AuthContext } from '../../store/authUtils';
import { ConfigContext } from '../../store/ConfigContext';
import { User, CampConfig } from '../../types';

describe('UserDashboard', () => {
  // Mock user data
  const mockUser: User = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    isAuthenticated: true,
    isEarlyRegistrationEnabled: false,
    hasRegisteredForCurrentYear: false
  };

  // Mock config data
  const mockConfig: CampConfig = {
    name: 'Camp Test',
    description: 'A test camp',
    homePageBlurb: '<p>Welcome to Camp Test!</p>',
    registrationOpen: true,
    earlyRegistrationOpen: false,
    currentYear: 2025
  };

  // Helper function to render component with contexts
  const renderWithContext = (
    user = mockUser, 
    config = mockConfig, 
    hasRegistered = false
  ) => {
    const userWithRegistration = { 
      ...user, 
      hasRegisteredForCurrentYear: hasRegistered 
    };
    
    return render(
      <BrowserRouter>
        <AuthContext.Provider 
          value={{
            user: userWithRegistration,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            requestVerificationCode: vi.fn().mockResolvedValue(true),
            verifyCode: vi.fn().mockResolvedValue(undefined),
            logout: vi.fn().mockResolvedValue(undefined)
          }}
        >
          <ConfigContext.Provider
            value={{
              config,
              isLoading: false,
              error: null,
              refreshConfig: vi.fn().mockResolvedValue(undefined)
            }}
          >
            <UserDashboard />
          </ConfigContext.Provider>
        </AuthContext.Provider>
      </BrowserRouter>
    );
  };

  it('renders the welcome message with user name', () => {
    renderWithContext();
    expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument();
  });

  it('shows registration button when registration is open', () => {
    renderWithContext();
    const registerButton = screen.getByRole('link', { name: /register now/i });
    expect(registerButton).toBeInTheDocument();
    expect(registerButton).toHaveAttribute('href', '/registration');
  });

  it('shows registration closed message when registration is closed', () => {
    const closedConfig = {
      ...mockConfig,
      registrationOpen: false,
      earlyRegistrationOpen: false
    };
    
    renderWithContext(mockUser, closedConfig);
    expect(screen.getByText('Registration is not currently open.')).toBeInTheDocument();
    expect(screen.queryByText('Register Now')).not.toBeInTheDocument();
  });

  it('shows early registration message for non-eligible users', () => {
    const earlyConfig = {
      ...mockConfig,
      registrationOpen: false,
      earlyRegistrationOpen: true
    };
    
    renderWithContext(mockUser, earlyConfig);
    expect(screen.getByText(/Registration is not currently open./)).toBeInTheDocument();
    expect(screen.getByText(/Early registration is available for selected members only./)).toBeInTheDocument();
  });

  it('shows register button for early eligible users', () => {
    const earlyConfig = {
      ...mockConfig,
      registrationOpen: false,
      earlyRegistrationOpen: true
    };
    
    const earlyUser = {
      ...mockUser,
      isEarlyRegistrationEnabled: true
    };
    
    renderWithContext(earlyUser, earlyConfig);
    const registerButton = screen.getByRole('link', { name: /register now/i });
    expect(registerButton).toBeInTheDocument();
    expect(registerButton).toHaveAttribute('href', '/registration');
  });

  it('shows registration details for registered users', () => {
    renderWithContext(mockUser, mockConfig, true);
    
    expect(screen.getByText("You're registered!")).toBeInTheDocument();
    expect(screen.getByText(`Your ${mockConfig.currentYear} registration is confirmed.`)).toBeInTheDocument();
    
    const detailsLink = screen.getByRole('link', { name: /view\/edit registration details/i });
    expect(detailsLink).toBeInTheDocument();
    expect(detailsLink).toHaveAttribute('href', '/registration/details');
  });

  it('shows work shift section for registered users', () => {
    renderWithContext(mockUser, mockConfig, true);
    
    expect(screen.getByText('Your Scheduled Shifts')).toBeInTheDocument();
    expect(screen.getByText("You haven't signed up for any shifts yet")).toBeInTheDocument();
    const shiftsLink = screen.getByRole('link', { name: /sign up for shifts/i });
    expect(shiftsLink).toBeInTheDocument();
    expect(shiftsLink).toHaveAttribute('href', '/shifts');
  });

  it('shows message about work shifts for non-registered users', () => {
    renderWithContext();
    
    expect(screen.getByText('You need to register first before signing up for work shifts.')).toBeInTheDocument();
  });

  it('does not render anything if user or config is null', () => {
    const { container } = render(
      <BrowserRouter>
        <AuthContext.Provider 
          value={{
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            requestVerificationCode: vi.fn(),
            verifyCode: vi.fn(),
            logout: vi.fn()
          }}
        >
          <ConfigContext.Provider
            value={{
              config: mockConfig,
              isLoading: false,
              error: null,
              refreshConfig: vi.fn()
            }}
          >
            <UserDashboard />
          </ConfigContext.Provider>
        </AuthContext.Provider>
      </BrowserRouter>
    );
    
    expect(container.firstChild).toBeNull();
  });
});

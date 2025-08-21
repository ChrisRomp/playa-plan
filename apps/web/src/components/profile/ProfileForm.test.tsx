import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ProfileForm from './ProfileForm';
import { useProfile } from '../../hooks/useProfile';
import { useNavigate } from 'react-router-dom';

// Mock dependencies
vi.mock('../../hooks/useProfile');
vi.mock('react-router-dom');

const mockUseProfile = vi.mocked(useProfile);
const mockUseNavigate = vi.mocked(useNavigate);
const mockNavigate = vi.fn();

describe('ProfileForm', () => {
  beforeEach(() => {
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseProfile.mockReturnValue({
      profile: {
        id: 'test-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        city: 'San Francisco',
        stateProvince: 'CA',
        country: 'United States',
        playaName: 'Dusty',
        emergencyContact: 'Jane Doe, 555-5678, Sister',
        profilePicture: null,
        role: 'PARTICIPANT' as const,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        allowRegistration: true,
        allowEarlyRegistration: false,
        allowDeferredDuesPayment: false,
        allowNoJob: false,
        internalNotes: null,
      },
      updateProfile: vi.fn(),
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should trim whitespace from form fields before submitting', async () => {
    const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
    mockUseProfile.mockReturnValue({
      profile: null,
      updateProfile: mockUpdateProfile,
      isLoading: false,
      error: null,
    });

    render(<ProfileForm />);

    // Fill form with whitespace-padded values
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: '  John  ' }
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: '  Doe  ' }
    });
    fireEvent.change(screen.getByLabelText(/playa name/i), {
      target: { value: '  Dusty  ' }
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '  555-1234  ' }
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: '  San Francisco  ' }
    });
    fireEvent.change(screen.getByLabelText(/state/i), {
      target: { value: '  CA  ' }
    });
    fireEvent.change(screen.getByLabelText(/country/i), {
      target: { value: '  United States  ' }
    });
    fireEvent.change(screen.getByLabelText(/emergency contact/i), {
      target: { value: '  Jane Doe, 555-5678, Sister  ' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    // Verify updateProfile was called with trimmed values
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-1234',
        city: 'San Francisco',
        stateProvince: 'CA',
        country: 'United States',
        playaName: 'Dusty',
        emergencyContact: 'Jane Doe, 555-5678, Sister',
      });
    });
  });

  it('should handle empty strings correctly when trimming', async () => {
    const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
    mockUseProfile.mockReturnValue({
      profile: null,
      updateProfile: mockUpdateProfile,
      isLoading: false,
      error: null,
    });

    render(<ProfileForm />);

    // Fill required fields and leave optional fields as whitespace
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: 'John' }
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: 'Doe' }
    });
    fireEvent.change(screen.getByLabelText(/phone number/i), {
      target: { value: '555-1234' }
    });
    fireEvent.change(screen.getByLabelText(/emergency contact/i), {
      target: { value: 'Jane Doe, 555-5678, Sister' }
    });

    // Set optional fields to whitespace
    fireEvent.change(screen.getByLabelText(/playa name/i), {
      target: { value: '   ' }
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: '   ' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    // Verify updateProfile was called with empty strings for whitespace-only fields
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-1234',
        city: '',
        stateProvince: '',
        country: '',
        playaName: '',
        emergencyContact: 'Jane Doe, 555-5678, Sister',
      });
    });
  });
});
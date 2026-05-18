import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserNotesPanel } from '../UserNotesPanel';
import { userNotes } from '../../../../lib/api';
import { useAuth } from '../../../../store/authUtils';
import type { User } from '../../../../types';
import type { UserNote } from '../../../../types/users';

vi.mock('../../../../lib/api', () => ({
  userNotes: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../../store/authUtils', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUserNotes = vi.mocked(userNotes);

const makeAuthUser = (
  overrides: Partial<User> & { id: string; role: 'admin' | 'staff' | 'user' },
): User => ({
  name: 'Test',
  email: 'test@example.playaplan.app',
  isAuthenticated: true,
  isEarlyRegistrationEnabled: false,
  hasRegisteredForCurrentYear: false,
  ...overrides,
});

const buildAuthValue = (user: User) =>
  ({
    user,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    requestVerificationCode: vi.fn(),
    verifyCode: vi.fn(),
    loginWithPasskey: vi.fn(),
    logout: vi.fn(),
    isConnecting: false,
    isConnected: true,
    connectionError: null,
  }) as unknown as ReturnType<typeof useAuth>;

const makeNote = (overrides: Partial<UserNote> = {}): UserNote => ({
  id: 'note-1',
  userId: 'subject-1',
  authorId: 'staff-1',
  content: 'A note',
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
  author: {
    id: 'staff-1',
    email: 'sara@example.playaplan.app',
    firstName: 'Sara',
    lastName: 'Staff',
  },
  ...overrides,
});

describe('UserNotesPanel — permission-based affordances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows edit and delete for the original author viewing their own note', async () => {
    mockUseAuth.mockReturnValue(
      buildAuthValue(makeAuthUser({ id: 'staff-1', role: 'staff' })),
    );
    mockUserNotes.list.mockResolvedValue([makeNote({ authorId: 'staff-1' })]);

    render(<UserNotesPanel userId="subject-1" />);

    expect(await screen.findByLabelText('Edit note')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete note')).toBeInTheDocument();
  });

  it('shows delete but not edit when an admin views a note authored by someone else', async () => {
    mockUseAuth.mockReturnValue(
      buildAuthValue(makeAuthUser({ id: 'admin-1', role: 'admin' })),
    );
    mockUserNotes.list.mockResolvedValue([makeNote({ authorId: 'staff-1' })]);

    render(<UserNotesPanel userId="subject-1" />);

    await waitFor(() =>
      expect(screen.getByLabelText('Delete note')).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText('Edit note')).not.toBeInTheDocument();
  });

  it('shows edit and delete when an admin views their own note', async () => {
    mockUseAuth.mockReturnValue(
      buildAuthValue(makeAuthUser({ id: 'admin-1', role: 'admin' })),
    );
    mockUserNotes.list.mockResolvedValue([
      makeNote({
        authorId: 'admin-1',
        author: {
          id: 'admin-1',
          email: 'admin@example.playaplan.app',
          firstName: 'Ada',
          lastName: 'Admin',
        },
      }),
    ]);

    render(<UserNotesPanel userId="subject-1" />);

    expect(await screen.findByLabelText('Edit note')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete note')).toBeInTheDocument();
  });

  it('hides edit and delete when a staff user views a note authored by another staff member', async () => {
    mockUseAuth.mockReturnValue(
      buildAuthValue(makeAuthUser({ id: 'staff-2', role: 'staff' })),
    );
    mockUserNotes.list.mockResolvedValue([makeNote({ authorId: 'staff-1' })]);

    render(<UserNotesPanel userId="subject-1" />);

    await waitFor(() =>
      expect(screen.getByText('A note')).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText('Edit note')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete note')).not.toBeInTheDocument();
  });
});

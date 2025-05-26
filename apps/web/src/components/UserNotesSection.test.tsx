import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import UserNotesSection from './UserNotesSection';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { api } from '../lib/api';

// Mock api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('UserNotesSection', () => {
  const mockUserId = 'user-123';
  const mockNotes = [
    {
      id: 'note-1',
      userId: mockUserId,
      note: 'Test note 1',
      createdById: 'admin-1',
      creatorFirstName: 'Admin',
      creatorLastName: 'User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'note-2',
      userId: mockUserId,
      note: 'Test note 2',
      createdById: 'staff-1',
      creatorFirstName: 'Staff',
      creatorLastName: 'User',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    (api.get as any).mockResolvedValue({ data: mockNotes });
  });

  it('renders the notes section correctly', async () => {
    render(<UserNotesSection userId={mockUserId} />);
    
    // Check if the title is rendered
    expect(screen.getByText('Internal Notes')).toBeInTheDocument();
    
    // Wait for notes to load
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/admin/users/${mockUserId}/notes`);
    });
    
    // Check if notes are rendered
    await waitFor(() => {
      expect(screen.getByText('Test note 1')).toBeInTheDocument();
      expect(screen.getByText('Test note 2')).toBeInTheDocument();
    });
  });

  it('adds a new note successfully', async () => {
    const newNote = {
      id: 'new-note',
      userId: mockUserId,
      note: 'New test note',
      createdById: 'admin-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    (api.post as any).mockResolvedValue({ data: newNote });
    
    render(<UserNotesSection userId={mockUserId} />);
    
    // Type in the new note
    const noteInput = await screen.findByPlaceholderText('Add a note about this user...');
    fireEvent.change(noteInput, { target: { value: 'New test note' } });
    
    // Submit the form
    const addButton = screen.getByText('Add Note');
    fireEvent.click(addButton);
    
    // Check if the API was called correctly
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/admin/users/${mockUserId}/notes`, 
        { note: 'New test note' }
      );
    });
  });

  it('deletes a note successfully', async () => {
    (api.delete as any).mockResolvedValue({});
    
    render(<UserNotesSection userId={mockUserId} />);
    
    // Wait for notes to load
    await waitFor(() => {
      expect(screen.getByText('Test note 1')).toBeInTheDocument();
    });
    
    // Find and click the first delete button
    const deleteButtons = await screen.findAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    // Confirm deletion
    const confirmButton = await screen.findByText('Yes, delete');
    fireEvent.click(confirmButton);
    
    // Check if the API was called correctly
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith(`/admin/users/notes/note-1`);
    });
  });

  it('displays an error message when API call fails', async () => {
    (api.get as any).mockRejectedValue(new Error('Failed to fetch'));
    
    render(<UserNotesSection userId={mockUserId} />);
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch user notes')).toBeInTheDocument();
    });
    
    // Check if Try Again button is shown
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });
});
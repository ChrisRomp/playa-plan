import React, { useState, useEffect } from 'react';
import AddNoteForm from './user-notes/AddNoteForm';
import NotesList from './user-notes/NotesList';
import { UserNote } from '../types/userNotes';
import { api } from '../lib/api';

interface UserNotesSectionProps {
  userId: string;
}

/**
 * Main container component for user notes section
 */
const UserNotesSection: React.FC<UserNotesSectionProps> = ({ userId }) => {
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch notes when component mounts or userId changes
  useEffect(() => {
    fetchNotes();
  }, [userId]);

  // Fetch notes from API
  const fetchNotes = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/admin/users/${userId}/notes`);
      setNotes(response.data);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to fetch user notes');
    } finally {
      setLoading(false);
    }
  };

  // Add a new note
  const addNote = async (noteContent: string) => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.post(`/admin/users/${userId}/notes`, { note: noteContent });
      setNotes(prevNotes => [response.data, ...prevNotes]);
      return true;
    } catch (err) {
      console.error('Error adding note:', err);
      setError('Failed to add note');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Delete a note
  const deleteNote = async (noteId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await api.delete(`/admin/users/notes/${noteId}`);
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      return true;
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mt-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Internal Notes</h2>
      
      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
          <p>{error}</p>
          <button 
            onClick={fetchNotes}
            className="mt-1 text-sm font-medium text-red-600 hover:text-red-800"
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Note form */}
      <AddNoteForm onAddNote={addNote} isLoading={loading} />
      
      {/* Notes list */}
      {loading && notes.length === 0 ? (
        <div className="flex justify-center items-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          <span className="ml-2">Loading notes...</span>
        </div>
      ) : (
        <NotesList notes={notes} onDeleteNote={deleteNote} />
      )}
    </div>
  );
};

export default UserNotesSection;
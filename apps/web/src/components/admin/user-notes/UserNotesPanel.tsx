import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { userNotes } from '../../../lib/api';
import { USER_NOTE_MAX_LENGTH, type UserNote } from '../../../types/users';
import { useAuth } from '../../../store/authUtils';

interface UserNotesPanelProps {
  /** ID of the user the notes are about. */
  userId: string;
}

/**
 * Format an ISO date string for display alongside a note.
 */
const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

/**
 * Format the author summary attached to a note.
 */
const formatAuthor = (note: UserNote): string => {
  if (!note.author) return 'Unknown author';
  const { firstName, lastName, email } = note.author;
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || email;
};

/**
 * Internal notes panel for the admin Edit User view.
 *
 * Supports listing all notes for the selected user and creating, editing,
 * and deleting them. Only staff/admin users render this component; the API
 * also enforces role checks server-side.
 */
export function UserNotesPanel({ userId }: UserNotesPanelProps) {
  const { user: currentUser } = useAuth();
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userNotes.list(userId);
      setNotes(data);
    } catch (err) {
      console.error('Failed to load user notes', err);
      setError('Failed to load internal notes.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newContent.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await userNotes.create(userId, trimmed);
      setNotes(prev => [created, ...prev]);
      setNewContent('');
    } catch (err) {
      console.error('Failed to create user note', err);
      setError('Failed to add note.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (note: UserNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (noteId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    try {
      const updated = await userNotes.update(userId, noteId, trimmed);
      setNotes(prev => prev.map(n => (n.id === noteId ? updated : n)));
      cancelEdit();
    } catch (err) {
      console.error('Failed to update user note', err);
      setError('Failed to update note.');
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    try {
      await userNotes.delete(userId, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      if (editingId === noteId) cancelEdit();
    } catch (err) {
      console.error('Failed to delete user note', err);
      setError('Failed to delete note.');
    }
  };

  // Edit is author-only (regardless of role) so attribution is preserved.
  // Delete is allowed for the author or any admin.
  // Server enforces the same rules — these gates are purely UI affordance.
  const canEdit = (note: UserNote): boolean => {
    if (!currentUser) return false;
    return note.authorId === currentUser.id;
  };

  const canDelete = (note: UserNote): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return note.authorId === currentUser.id;
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 pb-2 border-b">Internal Notes</h3>
      <p className="text-sm text-gray-500 mb-4">
        Notes are visible only to staff and administrators. Each entry is
        timestamped and attributed to its author.
      </p>

      <form onSubmit={handleCreate} className="mb-6">
        <label htmlFor="new-user-note" className="block text-gray-700 font-medium mb-2">
          Add a note
        </label>
        <textarea
          id="new-user-note"
          name="new-user-note"
          rows={3}
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          maxLength={USER_NOTE_MAX_LENGTH}
          placeholder="Add an internal note about this user..."
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {newContent.length} / {USER_NOTE_MAX_LENGTH}
          </span>
          <button
            type="submit"
            disabled={!newContent.trim() || submitting}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
          >
            <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
            Add Note
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map(note => {
            const editable = canEdit(note);
            const deletable = canDelete(note);
            const isEditing = editingId === note.id;
            return (
              <li
                key={note.id}
                className="p-3 border border-gray-200 rounded bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium text-gray-800">
                      {formatAuthor(note)}
                    </span>
                    <span className="mx-1">·</span>
                    <time dateTime={note.createdAt}>
                      {formatTimestamp(note.createdAt)}
                    </time>
                    {note.updatedAt !== note.createdAt && (
                      <span className="ml-1 italic">(edited)</span>
                    )}
                  </div>
                  {!isEditing && (editable || deletable) && (
                    <div className="flex items-center gap-1">
                      {editable && (
                        <button
                          type="button"
                          onClick={() => startEdit(note)}
                          className="p-1 text-gray-500 hover:text-blue-600"
                          aria-label="Edit note"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {deletable && (
                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          className="p-1 text-gray-500 hover:text-red-600"
                          aria-label="Delete note"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      rows={3}
                      maxLength={USER_NOTE_MAX_LENGTH}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Edit note content"
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="inline-flex items-center px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        <X className="w-4 h-4 mr-1" aria-hidden="true" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={!editContent.trim()}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:bg-blue-300"
                      >
                        <Check className="w-4 h-4 mr-1" aria-hidden="true" />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default UserNotesPanel;

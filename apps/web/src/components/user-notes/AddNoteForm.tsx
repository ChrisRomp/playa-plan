import React, { useState } from 'react';

interface AddNoteFormProps {
  onAddNote: (note: string) => Promise<boolean>;
  isLoading: boolean;
}

/**
 * Form for adding a new note
 */
const AddNoteForm: React.FC<AddNoteFormProps> = ({ onAddNote, isLoading }) => {
  const [noteContent, setNoteContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    if (!noteContent.trim()) {
      setError('Note cannot be empty');
      return;
    }
    
    if (noteContent.length > 1024) {
      setError('Note must be at most 1024 characters');
      return;
    }
    
    // Clear any previous errors
    setError(null);
    
    // Submit the note
    const success = await onAddNote(noteContent);
    
    // Clear the form if successful
    if (success) {
      setNoteContent('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div>
        <label htmlFor="note" className="sr-only">Add a note</label>
        <textarea
          id="note"
          name="note"
          rows={3}
          value={noteContent}
          onChange={e => setNoteContent(e.target.value)}
          placeholder="Add a note about this user..."
          disabled={isLoading}
          className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        ></textarea>
        
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={isLoading || !noteContent.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Adding...' : 'Add Note'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default AddNoteForm;
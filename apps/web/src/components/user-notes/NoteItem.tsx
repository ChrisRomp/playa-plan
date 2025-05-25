import React, { useState } from 'react';
import { UserNote } from '../../types/userNotes';
import { formatDistanceToNow } from 'date-fns';

interface NoteItemProps {
  note: UserNote;
  onDeleteNote: (id: string) => Promise<boolean>;
}

/**
 * Component for displaying a single note with delete functionality
 */
const NoteItem: React.FC<NoteItemProps> = ({ note, onDeleteNote }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  // Format the date nicely (e.g., "5 minutes ago")
  const formattedDate = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true });
  
  // Creator name to display
  const creatorName = note.creatorFirstName && note.creatorLastName 
    ? `${note.creatorFirstName} ${note.creatorLastName}`
    : 'System';

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    await onDeleteNote(note.id);
    setIsDeleting(false);
    setShowDeleteConfirmation(false);
  };

  return (
    <div className="bg-gray-50 p-4 rounded-md mb-3">
      {/* Note content */}
      <p className="text-gray-800 whitespace-pre-wrap">{note.note}</p>
      
      {/* Meta information */}
      <div className="flex items-center justify-between mt-2 text-sm">
        <div className="text-gray-500">
          <span className="font-medium">{creatorName}</span> • {formattedDate}
        </div>
        
        {/* Delete button */}
        {!showDeleteConfirmation ? (
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-800"
            aria-label="Delete note"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="text-gray-600 text-xs">Confirm delete?</span>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Yes
            </button>
            <button
              onClick={handleCancelDelete}
              disabled={isDeleting}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteItem;
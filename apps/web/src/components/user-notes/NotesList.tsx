import React from 'react';
import NoteItem from './NoteItem';
import { UserNote } from '../../types/userNotes';

interface NotesListProps {
  notes: UserNote[];
  onDeleteNote: (id: string) => Promise<boolean>;
}

/**
 * Component for displaying a list of notes
 */
const NotesList: React.FC<NotesListProps> = ({ notes, onDeleteNote }) => {
  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No notes have been added yet.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {notes.map(note => (
        <NoteItem 
          key={note.id} 
          note={note} 
          onDeleteNote={onDeleteNote} 
        />
      ))}
    </div>
  );
};

export default NotesList;
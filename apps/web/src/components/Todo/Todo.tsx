import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { Button } from '../Button/Button';
import { Input } from '../Input/Input';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoProps {
  title?: string;
  initialItems?: TodoItem[];
  onSave?: (items: TodoItem[]) => void;
  className?: string;
}

/**
 * Todo component for managing a list of tasks with completion status
 */
const Todo: React.FC<TodoProps> = ({
  title = 'Tasks',
  initialItems = [],
  onSave,
  className = '',
}) => {
  const [items, setItems] = useState<TodoItem[]>(initialItems);
  const [newItemText, setNewItemText] = useState('');

  // Notify parent component when items change
  useEffect(() => {
    if (onSave) {
      onSave(items);
    }
  }, [items, onSave]);

  const addItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: TodoItem = {
      id: Date.now().toString(),
      text: newItemText.trim(),
      completed: false,
    };
    
    setItems([...items, newItem]);
    setNewItemText('');
  };

  const toggleItem = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      
      <div className="flex mb-4">
        <Input
          type="text"
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a new task..."
          className="flex-grow mr-2"
        />
        <Button
          onClick={addItem}
          variant="primary"
          className="flex items-center"
          disabled={!newItemText.trim()}
        >
          <FiPlus className="mr-1" /> Add
        </Button>
      </div>
      
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="text-gray-500 italic">No tasks yet</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
            >
              <div className="flex items-center flex-grow">
                <button
                  onClick={() => toggleItem(item.id)}
                  className="text-blue-500 mr-2 focus:outline-none"
                  aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
                >
                  {item.completed ? (
                    <FiCheckSquare className="h-5 w-5" />
                  ) : (
                    <FiSquare className="h-5 w-5" />
                  )}
                </button>
                <span className={`${item.completed ? "line-through text-gray-400" : ""}`}>
                  {item.text}
                </span>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                className="text-red-500 hover:text-red-700 focus:outline-none"
                aria-label="Remove task"
              >
                <FiTrash2 className="h-5 w-5" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default Todo; 
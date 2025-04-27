import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  className = '',
  fullWidth = false,
  error,
  ...props
}) => {
  const baseClasses = 'px-3 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500';
  const widthClasses = fullWidth ? 'w-full' : '';
  const errorClasses = error ? 'border-red-300' : 'border-gray-300';
  
  return (
    <div className="w-full">
      <input
        className={`${baseClasses} ${widthClasses} ${errorClasses} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

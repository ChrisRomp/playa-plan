import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      className = '',
      id,
      startIcon,
      endIcon,
      disabled,
      ...rest
    },
    ref
  ) => {
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).slice(2, 11)}`;
    const hasError = !!error;
    
    const baseClasses = 'block rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm';
    const widthClass = fullWidth ? 'w-full' : 'w-auto';
    const errorClass = hasError
      ? 'border-red-300 text-red-900 placeholder-red-300'
      : 'border-gray-300 placeholder-gray-400';
    const disabledClass = disabled ? 'opacity-50 bg-gray-100 cursor-not-allowed' : '';
    const iconClass = (startIcon || endIcon) ? 'pl-10' : '';
    
    return (
      <div className={`${fullWidth ? 'w-full' : 'w-auto'}`}>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {startIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {startIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`${baseClasses} ${widthClass} ${errorClass} ${disabledClass} ${iconClass} ${className}`}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            disabled={disabled}
            {...rest}
          />
          {endIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {endIcon}
            </div>
          )}
        </div>
        {helperText && !hasError && (
          <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
        {hasError && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input; 
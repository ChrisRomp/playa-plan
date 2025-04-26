import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  rounded?: boolean;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  fullWidth = false,
  isLoading = false,
  disabled,
  leftIcon,
  rightIcon,
  rounded = false,
  ...props
}: ButtonProps) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium focus:outline-none transition-colors duration-200';
  
  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
    secondary: 'bg-secondary-200 text-secondary-800 hover:bg-secondary-300 active:bg-secondary-400 focus:ring-2 focus:ring-secondary-300 focus:ring-offset-2',
    outline: 'bg-transparent border border-primary-600 text-primary-600 hover:bg-primary-50 active:bg-primary-100 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
    ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 active:bg-primary-100 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 focus:ring-2 focus:ring-danger-500 focus:ring-offset-2',
    success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 focus:ring-2 focus:ring-success-500 focus:ring-offset-2',
    warning: 'bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-700 focus:ring-2 focus:ring-warning-500 focus:ring-offset-2',
  };
  
  const sizeStyles = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-2.5 text-lg',
    xl: 'px-6 py-3 text-xl',
  };
  
  const widthStyles = fullWidth ? 'w-full' : '';
  const loadingStyles = isLoading ? 'opacity-70 cursor-not-allowed' : '';
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const roundedStyles = rounded ? 'rounded-full' : 'rounded-md';
  
  return (
    <button
      className={`${baseStyles} ${roundedStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${loadingStyles} ${disabledStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
      {rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
}; 
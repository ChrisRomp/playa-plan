import { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info';
type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  rounded?: boolean;
}

export const Badge = ({
  children,
  variant = 'primary',
  size = 'md',
  outline = false,
  rounded = false,
  className = '',
  ...props
}: BadgeProps) => {
  const variantStyles = {
    primary: outline 
      ? 'bg-transparent text-primary-600 border border-primary-600' 
      : 'bg-primary-100 text-primary-800',
    secondary: outline 
      ? 'bg-transparent text-secondary-600 border border-secondary-600' 
      : 'bg-secondary-100 text-secondary-800',
    success: outline 
      ? 'bg-transparent text-success-600 border border-success-600' 
      : 'bg-success-100 text-success-800',
    danger: outline 
      ? 'bg-transparent text-danger-600 border border-danger-600' 
      : 'bg-danger-100 text-danger-800',
    warning: outline 
      ? 'bg-transparent text-warning-600 border border-warning-600' 
      : 'bg-warning-100 text-warning-800',
    info: outline 
      ? 'bg-transparent text-primary-600 border border-primary-600' 
      : 'bg-primary-100 text-primary-800',
  };

  const sizeStyles = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const roundedStyle = rounded ? 'rounded-full' : 'rounded-md';

  return (
    <span
      className={`inline-block font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${roundedStyle} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

import { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  title?: string;
  titleIcon?: ReactNode;
  footer?: ReactNode;
  bordered?: boolean;
  hoverable?: boolean;
  loading?: boolean;
}

export const Card = ({
  children,
  title,
  titleIcon,
  footer,
  bordered = true,
  hoverable = false,
  loading = false,
  className = '',
  ...props
}: CardProps) => {
  const baseStyles = 'bg-white rounded-lg overflow-hidden';
  const borderStyles = bordered ? 'border border-gray-200' : '';
  const hoverStyles = hoverable ? 'transition-shadow duration-300 hover:shadow-lg' : '';
  
  return (
    <div 
      className={`${baseStyles} ${borderStyles} ${hoverStyles} ${className}`}
      {...props}
    >
      {(title || titleIcon) && (
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          {titleIcon && <span className="text-gray-500">{titleIcon}</span>}
          {title && <h3 className="font-medium text-gray-800">{title}</h3>}
        </div>
      )}
      
      {loading ? (
        <div className="p-4 flex justify-center items-center min-h-[100px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="p-4">
          {children}
        </div>
      )}
      
      {footer && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
}; 
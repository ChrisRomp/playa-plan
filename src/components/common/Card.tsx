import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  footer?: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  className = '',
  footer,
  onClick,
  hoverable = false,
}) => {
  const hoverClasses = hoverable ? 'transition-shadow hover:shadow-lg cursor-pointer' : '';
  
  return (
    <div 
      className={`bg-white overflow-hidden shadow rounded-lg ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {title && (
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
        </div>
      )}
      <div className="px-4 py-5 sm:p-6">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-4 sm:px-6 bg-gray-50 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card; 
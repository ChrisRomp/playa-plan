import React, { useEffect, useRef } from 'react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnEscape = true,
  closeOnOutsideClick = true,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, closeOnEscape]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOutsideClick && e.target === overlayRef.current) {
      onClose();
    }
  };

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby={title ? 'modal-title' : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
        ref={overlayRef} 
        onClick={handleOverlayClick}
      >
        <div className="flex min-h-screen items-center justify-center p-4 text-center">
          <div 
            className={`bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all my-8 w-full ${sizeClasses[size]}`}
            ref={dialogRef}
          >
            {title && (
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 
                  className="text-lg leading-6 font-medium text-gray-900" 
                  id="modal-title"
                >
                  {title}
                </h3>
              </div>
            )}
            
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
              {children}
            </div>
            
            {footer ? (
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {footer}
              </div>
            ) : (
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <Button 
                  onClick={onClose}
                  variant="primary"
                  className="w-full sm:w-auto sm:ml-3"
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal; 
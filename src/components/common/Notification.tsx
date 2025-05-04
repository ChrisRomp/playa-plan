import React, { useState, useEffect, useCallback } from 'react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  type: NotificationType;
  message: string;
  isVisible: boolean;
  onClose?: () => void;
  autoHideDuration?: number;
}

export const Notification: React.FC<NotificationProps> = ({
  type,
  message,
  isVisible,
  onClose,
  autoHideDuration = 5000, // Default to 5 seconds
}) => {
  const [isClosing, setIsClosing] = useState(false);

  // Use useCallback to memoize the handleClose function
  const handleClose = useCallback(() => {
    setIsClosing(true);
    
    // Add small delay for animation
    setTimeout(() => {
      setIsClosing(false);
      if (onClose) {
        onClose();
      }
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (!isVisible || autoHideDuration <= 0) return;

    const timeoutId = setTimeout(() => {
      handleClose();
    }, autoHideDuration);

    return () => clearTimeout(timeoutId);
  }, [isVisible, autoHideDuration, handleClose]);

  if (!isVisible) return null;

  // Define styles based on notification type
  const typeStyles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-400',
      icon: 'text-green-400',
      title: 'text-green-800',
      message: 'text-green-700',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-400',
      icon: 'text-red-400',
      title: 'text-red-800',
      message: 'text-red-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-400',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      message: 'text-blue-700',
    },
  };

  const styles = typeStyles[type];
  const transitionClass = isClosing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0';

  return (
    <div 
      className={`fixed bottom-4 right-4 max-w-sm w-full p-4 rounded-lg shadow-lg border-l-4 ${styles.bg} ${styles.border} transform transition-all duration-300 ${transitionClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {type === 'success' && (
            <svg className={`h-5 w-5 ${styles.icon}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {type === 'error' && (
            <svg className={`h-5 w-5 ${styles.icon}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {type === 'warning' && (
            <svg className={`h-5 w-5 ${styles.icon}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {type === 'info' && (
            <svg className={`h-5 w-5 ${styles.icon}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 7a1 1 0 100 2h.01a1 1 0 100-2H10z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <p className={`text-sm ${styles.message}`}>{message}</p>
        </div>
        <button
          type="button"
          className={`ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-full inline-flex ${styles.message} hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          onClick={handleClose}
          aria-label="Close notification"
        >
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Notification; 
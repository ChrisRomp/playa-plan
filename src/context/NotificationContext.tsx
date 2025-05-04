import React, { createContext, useContext, useState, useCallback } from 'react';
import Notification from '../components/common/Notification';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationContextType {
  showNotification: (message: string, type: NotificationType, duration?: number) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('info');
  const [duration, setDuration] = useState(5000);

  const showNotification = useCallback((message: string, type: NotificationType, duration = 5000) => {
    setMessage(message);
    setType(type);
    setDuration(duration);
    setIsVisible(true);
  }, []);

  const hideNotification = useCallback(() => {
    setIsVisible(false);
  }, []);

  const value = {
    showNotification,
    hideNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Notification
        type={type}
        message={message}
        isVisible={isVisible}
        onClose={hideNotification}
        autoHideDuration={duration}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext; 
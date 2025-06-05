import React from 'react';

interface ConnectionStatusProps {
  isConnecting: boolean;
  connectionError: string | null;
  children: React.ReactNode;
}

/**
 * ConnectionStatus component displays loading or error states when the API is unreachable,
 * or renders children when the connection is established.
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnecting,
  connectionError,
  children,
}) => {
  if (isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to API...</p>
        </div>
      </div>
    );
  }
  
  if (connectionError) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Unable to connect to API</p>
          <p className="text-gray-600 text-sm">{connectionError}</p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}; 
import React from 'react';
import { useAuth } from '../../store/AuthContext';
import { useConfig } from '../../store/ConfigContext';
import LoginForm from '../auth/LoginForm';
import UserDashboard from './UserDashboard';

const MainContent: React.FC = () => {
  const { user } = useAuth();
  const { config, isLoading } = useConfig();
  
  if (isLoading || !config) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }
  
  // If user is not authenticated, show login form
  if (!user?.isAuthenticated) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div 
            className="prose lg:prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: config.homePageBlurb }}
          />
        </div>
        
        <div className="mb-8 text-center">
          <p className="text-lg font-medium mb-4">
            Sign in or create an account to register for {config.name}
          </p>
          <LoginForm />
        </div>
      </div>
    );
  }
  
  // User is authenticated, show user dashboard
  return <UserDashboard />;
};

export default MainContent;
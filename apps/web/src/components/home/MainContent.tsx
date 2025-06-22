import { useAuth } from '../../store/authUtils';
import { useConfig } from '../../hooks/useConfig';
import { useProfile } from '../../hooks/useProfile';
import LoginFormReset from '../auth/LoginFormReset';
import UserDashboard from './UserDashboard';
import ProfilePage from '../profile/ProfilePage';

const MainContent: React.FC = () => {
  const { user } = useAuth();
  const { config, isLoading: configLoading } = useConfig();
  const { isProfileComplete, isLoading: profileLoading } = useProfile();
  
  // Show loading state if any of our crucial contexts are still loading
  if (configLoading || !config || profileLoading) {
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
          <LoginFormReset />
        </div>
      </div>
    );
  }
  
  // User is authenticated but profile is incomplete, redirect to profile page
  if (user && !isProfileComplete) {
    return <ProfilePage />;
  }
  
  // User is authenticated and profile is complete, show user dashboard
  return <UserDashboard />;
};

export default MainContent;
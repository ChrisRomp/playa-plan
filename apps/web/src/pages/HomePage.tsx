import { Link } from 'react-router-dom';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../store/authUtils';
import { PATHS } from '../routes';
import { ConnectionStatus } from '../components/common/ConnectionStatus';

/**
 * Home page component
 * Displays landing content for all users
 */
const HomePage: React.FC = () => {
  const { config, isLoading, error } = useConfig();
  const { isAuthenticated } = useAuth();

  // Return early if config is not loaded yet
  if (!config) {
    return <div className="p-8 text-center">Loading camp information...</div>;
  }

  return (
    <ConnectionStatus isConnecting={isLoading} connectionError={error}>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-md rounded-lg overflow-hidden">        
          <div className="p-6">
            {config.homePageBlurb && (
              <div 
                className="prose mb-6 p-4 bg-blue-50 rounded-md [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 [&_a]:cursor-pointer" 
                dangerouslySetInnerHTML={{ __html: config.homePageBlurb }}
              />
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              {!isAuthenticated ? (
                <Link
                  to={PATHS.LOGIN}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-center"
                >
                  Login
                </Link>
              ) : (
                <Link
                  to={PATHS.DASHBOARD}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-center"
                >
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </ConnectionStatus>
  );
};

export default HomePage;

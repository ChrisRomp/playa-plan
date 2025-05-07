import React from 'react';
import { Link } from 'react-router-dom';
import { useConfig } from '../store/ConfigContext';
import { PATHS } from '../routes';

/**
 * Home page component
 * Displays landing content for all users
 */
const HomePage: React.FC = () => {
  const { config } = useConfig();

  // Return early if config is not loaded yet
  if (!config) {
    return <div className="p-8 text-center">Loading camp information...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {config.bannerUrl && (
          <div className="w-full h-48 md:h-64 relative">
            <img 
              src={config.bannerUrl} 
              alt={config.bannerAltText || config.name} 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {config.name}
          </h1>
          
          {config.description && (
            <div 
              className="prose mb-6" 
              dangerouslySetInnerHTML={{ __html: config.description }}
            />
          )}
          
          {config.homePageBlurb && (
            <div 
              className="prose mb-6 p-4 bg-blue-50 rounded-md" 
              dangerouslySetInnerHTML={{ __html: config.homePageBlurb }}
            />
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link
              to={PATHS.LOGIN}
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-center"
            >
              Login
            </Link>
            
            <Link
              to={PATHS.DASHBOARD}
              className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md text-center"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

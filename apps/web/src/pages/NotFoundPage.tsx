import React from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../routes';

/**
 * Not found (404) page component
 * Displayed when user navigates to a route that doesn't exist
 */
const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-6xl font-bold text-amber-500 mb-4">404</div>
      <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
      <p className="text-gray-600 mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to={PATHS.HOME}
        className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
};

export default NotFoundPage;

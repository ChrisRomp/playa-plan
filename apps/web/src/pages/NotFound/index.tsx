import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Navbar } from '../../components/Navbar';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <h1 className="text-9xl font-bold text-gray-900">404</h1>
          <h2 className="text-2xl font-medium text-gray-700">Page Not Found</h2>
          <p className="text-gray-600">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <div className="mt-6">
            <Link to="/">
              <Button variant="primary">Go Back Home</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 
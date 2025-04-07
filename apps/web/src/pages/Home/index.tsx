import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      
      <div className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Welcome to PlayaPlan
            </h1>
            <p className="mt-3 text-xl text-gray-600">
              Manage your camp registrations and shifts
            </p>
          </div>
          
          <div className="mt-8 space-y-4">
            {isAuthenticated ? (
              <div className="space-y-4">
                <p className="text-gray-700">
                  You're logged in! Browse available shifts or check your profile.
                </p>
                <div className="flex space-x-4 justify-center">
                  <Link to="/shifts">
                    <Button>Browse Shifts</Button>
                  </Link>
                  <Link to="/profile">
                    <Button variant="outline">My Profile</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-700">
                  Sign in or create an account to get started.
                </p>
                <div className="flex space-x-4 justify-center">
                  <Link to="/login">
                    <Button>Sign In</Button>
                  </Link>
                  <Link to="/register">
                    <Button variant="outline">Create Account</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <footer className="bg-white py-4 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} PlayaPlan. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home; 
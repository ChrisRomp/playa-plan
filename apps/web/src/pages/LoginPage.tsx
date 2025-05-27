import { useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authUtils';
import { PATHS } from '../routes';

/**
 * Login page wrapper component
 * Replaces the window.location redirects in LoginForm with React Router navigation
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Extract the returnTo path from URL query params if present
  const searchParams = new URLSearchParams(location.search);
  const returnTo = searchParams.get('returnTo');
  
  // Redirect to dashboard or requested page if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Navigate to the returnTo path if available, or to dashboard
      navigate(returnTo ? decodeURIComponent(returnTo) : PATHS.DASHBOARD, { replace: true });
    }
  }, [isAuthenticated, navigate, returnTo]);

  // Import the original LoginForm dynamically to avoid potential circular dependencies
  const LoginForm = lazy(() => import('../components/auth/LoginForm'));
  
  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
};

export default LoginPage;

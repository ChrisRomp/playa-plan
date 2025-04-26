import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { Spinner } from './components/Spinner';
import { Container } from './components/Container';
import { Button } from './components/Button';
import './App.css';

// Lazy load pages for better performance
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Navigation items
const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Camp Sessions', href: '/camps' },
  { label: 'Jobs', href: '/jobs' },
];

// Loading component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen w-screen">
    <Spinner size="xl" />
  </div>
);

// Layout component for authenticated pages
const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-secondary-50 flex flex-col">
      <Header 
        navItems={navItems} 
        rightSection={
          <div className="flex space-x-2">
            <Button size="sm" variant="ghost" onClick={() => window.location.href = '/login'}>
              Log In
            </Button>
            <Button size="sm" onClick={() => window.location.href = '/register'}>
              Sign Up
            </Button>
          </div>
        } 
      />
      <main className="flex-grow py-8">
        <Container>
          {children}
        </Container>
      </main>
      <footer className="bg-white border-t border-secondary-200 py-6">
        <Container>
          <div className="text-center text-secondary-600 text-sm">
            &copy; {new Date().getFullYear()} PlayaPlan. All rights reserved.
          </div>
        </Container>
      </footer>
    </div>
  );
};

// Auth layout without navigation
const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-secondary-50 flex flex-col items-center justify-center">
      <Container size="xs">
        {children}
      </Container>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<MainLayout><Home /></MainLayout>} />
            <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
            <Route path="/register" element={<AuthLayout><Register /></AuthLayout>} />
            <Route path="/forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />
            
            {/* Add more routes here as they are developed */}
            {/* <Route path="/profile" element={<MainLayout><Profile /></MainLayout>} /> */}
            
            {/* 404 page */}
            <Route path="*" element={<MainLayout><NotFound /></MainLayout>} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;

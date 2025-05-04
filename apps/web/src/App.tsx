import React, { createContext, useState, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Basic AuthContext implementation
type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff' | 'participant';
};

type AuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, _password: string) => {
    setIsLoading(true);
    // Mock login for now
    setTimeout(() => {
      setUser({
        id: '1',
        name: 'Demo User',
        email: email,
        role: 'participant'
      });
      setIsAuthenticated(true);
      setIsLoading(false);
    }, 1000);
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Basic NotificationContext implementation
type NotificationType = 'info' | 'success' | 'warning' | 'error';

type Notification = {
  id: string;
  type: NotificationType;
  message: string;
};

type NotificationContextType = {
  notifications: Notification[];
  addNotification: (type: NotificationType, message: string) => void;
  removeNotification: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (type: NotificationType, message: string) => {
    const id = Date.now().toString();
    setNotifications([...notifications, { id, type, message }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(notifications.filter(notification => notification.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Header Component
const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const campName = "PlayaPlan Camp 2024";
  
  return (
    <header className="bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-lg">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img 
              src="/icons/playa-plan-icon.png" 
              alt="PlayaPlan Logo" 
              className="w-10 h-10 rounded-full bg-white p-1"
              onError={(e) => {
                e.currentTarget.src = "https://via.placeholder.com/40?text=PP";
              }}
            />
            <div>
              <h1 className="text-2xl font-bold">{campName}</h1>
              <p className="text-sm text-blue-200">Your camp registration platform</p>
            </div>
          </div>
          
          <nav className="hidden md:flex space-x-6">
            <a href="/" className="hover:text-blue-200 font-medium">Home</a>
            <a href="#camp-info" className="hover:text-blue-200 font-medium">Camp Info</a>
            <a href="#registration" className="hover:text-blue-200 font-medium">Registration</a>
            <a href="#contact" className="hover:text-blue-200 font-medium">Contact</a>
          </nav>
          
          <div>
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="hidden md:inline">Welcome, {user?.name}</span>
                <button
                  onClick={logout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-x-2">
                <a
                  href="/login"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Login
                </a>
                <a
                  href="/register"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors hidden md:inline-block"
                >
                  Register
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Banner Image */}
      <div className="w-full h-48 md:h-64 lg:h-96 overflow-hidden relative">
        <img 
          src="/images/playa-plan-banner.png"
          alt="Beautiful camp landscape"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "https://via.placeholder.com/1600x400?text=Camp+Banner";
          }}
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="text-center p-4">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">Welcome to {campName}</h2>
            <p className="text-xl text-white">Your adventure begins here</p>
          </div>
        </div>
      </div>
    </header>
  );
};

// Footer Component
const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between">
          <div className="mb-6 md:mb-0">
            <h3 className="text-xl font-semibold mb-4">PlayaPlan</h3>
            <p className="text-gray-400 max-w-md">
              A comprehensive camp registration system that simplifies scheduling, 
              participant management, and camp operations.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/" className="hover:text-white transition-colors">Home</a></li>
                <li><a href="#camp-info" className="hover:text-white transition-colors">Camp Info</a></li>
                <li><a href="#registration" className="hover:text-white transition-colors">Registration</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-3">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                <li><a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#terms" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            &copy; {currentYear} PlayaPlan. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

// Enhanced Home component
const Home: React.FC = () => {
  const campInfo = {
    name: "PlayaPlan Camp 2024",
    startDate: "August 15, 2024",
    endDate: "August 22, 2024",
    location: "Black Rock Desert, Nevada",
    description: `Please configure your site to personalize it to your camp. Log in and complete the core configuration to get started.`
  };

  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        
      </main>
      
      <Footer />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* Add more routes as they are developed */}
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;

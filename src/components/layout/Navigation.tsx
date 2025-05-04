import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Navigation: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await logout();
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const getNavLinkClass = (path: string) => {
    const baseClasses = 'px-3 py-2 rounded-md text-sm font-medium';
    const activeClasses = 'bg-gray-900 text-white';
    const inactiveClasses = 'text-gray-300 hover:bg-gray-700 hover:text-white';
    
    return `${baseClasses} ${location.pathname === path ? activeClasses : inactiveClasses}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="ml-4 flex items-center md:ml-6">
        <Link to="/login" className={getNavLinkClass('/login')}>
          Sign in
        </Link>
        <Link to="/register" className={getNavLinkClass('/register')}>
          Register
        </Link>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff' || isAdmin;

  return (
    <div className="ml-4 flex items-center md:ml-6">
      {/* User Navigation */}
      <Link to="/profile" className={getNavLinkClass('/profile')}>
        Profile
      </Link>
      <Link to="/registration" className={getNavLinkClass('/registration')}>
        Registration
      </Link>
      <Link to="/schedule" className={getNavLinkClass('/schedule')}>
        Schedule
      </Link>
      
      {/* Staff Navigation */}
      {isStaff && (
        <Link to="/reports" className={getNavLinkClass('/reports')}>
          Reports
        </Link>
      )}
      
      {/* Admin Navigation */}
      {isAdmin && (
        <Link to="/admin" className={getNavLinkClass('/admin')}>
          Admin
        </Link>
      )}
      
      {/* Logout */}
      <a href="#" onClick={handleLogout} className={`${getNavLinkClass('/logout')} ml-4`}>
        Sign out
      </a>
    </div>
  );
};

export default Navigation; 
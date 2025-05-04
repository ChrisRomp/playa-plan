import React from 'react';
import { useAuth } from '../../store/AuthContext';
import { LogOut, User, Tent, Calendar, FileText, Settings } from 'lucide-react';

interface NavigationProps {
  isScrolled: boolean;
  isMobile?: boolean;
  closeMenu?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ 
  isScrolled, 
  isMobile = false,
  closeMenu
}) => {
  const { user, logout } = useAuth();
  
  const handleLinkClick = () => {
    if (closeMenu) closeMenu();
  };
  
  const textColorClass = isScrolled || isMobile ? 'text-gray-800' : 'text-white';
  const hoverClass = isScrolled || isMobile ? 'hover:text-blue-600' : 'hover:text-blue-300';
  
  const linkClass = `flex items-center gap-2 px-4 py-2 ${textColorClass} ${hoverClass} transition-colors duration-200`;
  
  return (
    <nav className={`${isMobile ? 'flex flex-col py-4' : 'flex items-center space-x-1'}`}>
      {!user?.isAuthenticated ? (
        <a 
          href="#" 
          className={linkClass}
          onClick={handleLinkClick}
        >
          <User size={18} />
          <span>Sign In / Register</span>
        </a>
      ) : (
        <>
          <a 
            href="#" 
            className={linkClass}
            onClick={handleLinkClick}
          >
            <User size={18} />
            <span>Profile</span>
          </a>
          
          <a 
            href="#" 
            className={linkClass}
            onClick={handleLinkClick}
          >
            <Tent size={18} />
            <span>Camp Registration</span>
          </a>
          
          <a 
            href="#" 
            className={linkClass}
            onClick={handleLinkClick}
          >
            <Calendar size={18} />
            <span>Work Schedule</span>
          </a>
          
          {(user.role === 'staff' || user.role === 'admin') && (
            <a 
              href="#" 
              className={linkClass}
              onClick={handleLinkClick}
            >
              <FileText size={18} />
              <span>Reports</span>
            </a>
          )}
          
          {user.role === 'admin' && (
            <a 
              href="#" 
              className={linkClass}
              onClick={handleLinkClick}
            >
              <Settings size={18} />
              <span>Administration</span>
            </a>
          )}
          
          <button 
            onClick={() => {
              logout();
              if (closeMenu) closeMenu();
            }} 
            className={linkClass}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </>
      )}
    </nav>
  );
};

export default Navigation;
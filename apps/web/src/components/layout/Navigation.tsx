import { Link } from 'react-router-dom';
import { useAuth } from '../../store/authUtils';
import { useConfig } from '../../store/ConfigContextDefinition';
import { LogOut, User, Tent, FileText, Settings } from 'lucide-react';
import { PATHS } from '../../routes';
import { isRegistrationAccessible } from '../../utils/registrationUtils';

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
  const { user, logout, isAuthenticated } = useAuth();
  const { config } = useConfig();
  const canAccessRegistration = isRegistrationAccessible(config, user);
  
  const textColorClass = isScrolled || isMobile ? 'text-amber-900' : 'text-white';
  const hoverClass = isScrolled || isMobile ? 'hover:text-amber-600' : 'hover:text-amber-200';
  
  const linkClass = `flex items-center gap-2 px-3 py-2 ${textColorClass} ${hoverClass} transition-colors duration-200 whitespace-nowrap text-sm md:text-base`;
  
  return (
    <nav className={`${isMobile ? 'flex flex-col py-4' : 'flex items-center space-x-0.5 md:space-x-1 overflow-x-auto max-w-full'}`}>
      {!isAuthenticated ? (
        <Link
          to={PATHS.LOGIN}
          className={linkClass}
          onClick={() => closeMenu?.()}
        >
          <User size={18} />
          <span>Sign In</span>
        </Link>
      ) : (
        <>
          <Link
            to={PATHS.PROFILE}
            className={linkClass}
            onClick={() => closeMenu?.()}
          >
            <User size={18} />
            <span>Profile</span>
          </Link>
          
          {canAccessRegistration && (
            <Link
              to={PATHS.REGISTRATION}
              className={linkClass}
              onClick={() => closeMenu?.()}
            >
              <Tent size={18} />
              <span>Registration</span>
            </Link>
          )}
          

          
          {user && (user.role === 'staff' || user.role === 'admin') && (
            <Link
              to={PATHS.REPORTS}
              className={linkClass}
              onClick={() => closeMenu?.()}
            >
              <FileText size={18} />
              <span>Reports</span>
            </Link>
          )}
          
          {user && user.role === 'admin' && (
            <Link
              to={PATHS.ADMIN}
              className={linkClass}
              onClick={() => closeMenu?.()}
            >
              <Settings size={18} />
              <span>Admin</span>
            </Link>
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
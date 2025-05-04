import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import AccessibleImage from '../common/AccessibleImage';

interface HeaderProps {
  campName: string;
  campDescription: string;
  bannerUrl?: string;
  iconUrl?: string;
  bannerAltText?: string;
  iconAltText?: string;
  isAuthenticated: boolean;
  userRole?: 'admin' | 'staff' | 'participant';
}

const defaultBannerUrl = '/images/playa-plan-banner.png';
const defaultIconUrl = '/images/playa-plan-icon.png';

export const Header: React.FC<HeaderProps> = ({
  campName,
  campDescription,
  bannerUrl,
  iconUrl,
  bannerAltText,
  iconAltText,
  isAuthenticated,
  userRole = 'participant',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const renderBanner = () => {
    const imgSrc = bannerUrl || defaultBannerUrl;
    const altText = bannerAltText || `${campName} banner image`;
    
    return (
      <div className="relative">
        <AccessibleImage
          src={imgSrc}
          alt={altText}
          className="w-full h-48 object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col justify-center items-center text-white p-4">
          <h1 className="text-3xl font-bold text-center">{campName}</h1>
          <p className="text-lg text-center mt-2">{campDescription}</p>
        </div>
      </div>
    );
  };
  
  const renderMenu = () => {
    return (
      <nav className="bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link to="/">
                  <AccessibleImage
                    className="h-8 w-8"
                    src={iconUrl || defaultIconUrl}
                    alt={iconAltText || `${campName} icon`}
                  />
                </Link>
              </div>
              <div className="hidden md:block">
                <Navigation />
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                type="button"
                className="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
                aria-controls="mobile-menu"
                aria-expanded={isMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {/* Icon for menu button */}
                <svg
                  className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                {/* Icon for when menu is open */}
                <svg
                  className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`}
          id="mobile-menu"
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* We would need a mobile-specific version of Navigation here */}
            {isAuthenticated ? (
              <div className="flex flex-col space-y-1">
                <Link to="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-white bg-gray-900">
                  Profile
                </Link>
                <Link to="/registration" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700">
                  Registration
                </Link>
                <Link to="/schedule" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700">
                  Schedule
                </Link>
                {userRole === 'admin' || userRole === 'staff' ? (
                  <Link to="/reports" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700">
                    Reports
                  </Link>
                ) : null}
                {userRole === 'admin' ? (
                  <Link to="/admin" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700">
                    Admin
                  </Link>
                ) : null}
                <a href="#" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700">
                  Sign out
                </a>
              </div>
            ) : (
              <div className="flex flex-col space-y-1">
                <Link to="/login" className="block px-3 py-2 rounded-md text-base font-medium text-white bg-gray-900">
                  Sign in
                </Link>
                <Link to="/register" className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700">
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    );
  };
  
  return (
    <header>
      {renderBanner()}
      {renderMenu()}
    </header>
  );
};

export default Header; 
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useConfig } from '../../hooks/useConfig';
import { PATHS } from '../../routes';
import Navigation from './Navigation';

const Header: React.FC = () => {
  const { config, isLoading } = useConfig();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  if (isLoading || !config) {
    return (
      <header className="h-80 bg-gray-200 animate-pulse">
        <div className="container mx-auto h-full flex items-center justify-center">
          <p className="text-gray-400">Loading camp information...</p>
        </div>
      </header>
    );
  }

  const defaultBanner = '/images/playa-plan-banner.png';
  const defaultIcon = '/icons/playa-plan-icon.png';
  const bannerUrl = config.bannerUrl || defaultBanner;
  const iconUrl = config.iconUrl || defaultIcon;
   
  // Responsive banner height - smaller but still impactful
  // Uses clamp() for responsive sizing: min 280px, preferred 35vh, max 400px
  // Recommended banner image dimensions: 1920x600px or similar 16:5 aspect ratio
  // Banner will be center-cropped to fit the container height
  const bannerHeight = 'clamp(280px, 35vh, 400px)';
  const compactHeaderHeight = '80px';

  return (
    <>
      {/* Fixed height spacer that always maintains the banner's size */}
      <div style={{ height: bannerHeight }} />
      
      <header 
        id="main-header"
        className={`fixed top-0 left-0 w-full transition-all duration-300 z-10 ${
          isScrolled ? 'bg-amber-50 shadow-md' : 'bg-transparent'
        }`}
        style={{ 
          height: isScrolled ? compactHeaderHeight : bannerHeight,
        }}
      >
        <div 
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-300"
          style={{ 
            backgroundImage: `url(${bannerUrl})`,
            opacity: isScrolled ? 0 : 1,
            filter: 'brightness(0.7)',
            backgroundPosition: 'center center'
          }}
          aria-hidden="true"
        />
        
        <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-6">
          <div className="flex justify-between items-center relative z-20 w-full">
            <Link 
              to={PATHS.DASHBOARD} 
              className="flex-shrink-0 flex items-center space-x-3 hover:opacity-80 transition-opacity duration-200"
              aria-label="Go to dashboard"
            >
              <img 
                src={iconUrl} 
                alt={config.iconAltText || `${config.name} camp icon`}
                className={`rounded-full object-cover border-2 ${isScrolled ? 'border-amber-600' : 'border-white'} transition-all duration-300 ${
                  isScrolled ? 'w-10 h-10' : 'w-11 h-11'
                }`}
              />
              <h1 className={`font-bold transition-all duration-300 ${
                isScrolled ? 'text-amber-900 text-xl' : 'text-white text-xl md:text-2xl'
              }`}>
                {config.name}
              </h1>
            </Link>
            
            <button 
              onClick={toggleMenu}
              className={`block md:hidden p-2 rounded-full transition-colors ${
                isScrolled ? 'text-amber-900 hover:bg-amber-100' : 'text-white hover:bg-black/30'
              }`}
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            <div className="hidden md:block">
              <Navigation isScrolled={isScrolled} />
            </div>
          </div>
          
          <div className={`mt-auto transition-opacity duration-300 ${isScrolled ? 'opacity-0' : 'opacity-100'}`}>
            <Link 
              to={PATHS.DASHBOARD} 
              className="inline-block hover:opacity-80 transition-opacity duration-200"
              aria-label="Go to dashboard"
            >
              <h2 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2 drop-shadow-lg">
                {config.name}
              </h2>
            </Link>
            <p 
              className="text-white/90 text-base md:text-lg lg:text-xl drop-shadow-md [&_a]:text-blue-200 [&_a]:underline [&_a:hover]:text-white [&_a]:cursor-pointer"
              dangerouslySetInnerHTML={{ __html: config.description }}
            />
          </div>
        </div>
      </header>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden fixed top-[80px] left-0 right-0 bg-amber-50 shadow-lg z-20 transition-all duration-300 transform">
          <Navigation isScrolled={true} isMobile={true} closeMenu={() => setIsMenuOpen(false)} />
        </div>
      )}
    </>
  );
};

export default Header;
import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useConfig } from '../../store/ConfigContext';
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
      <header className="h-40 bg-gray-200 animate-pulse">
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
   
  // Fixed banner height
  const bannerHeight = '60vh';
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
            filter: 'brightness(0.7)'
          }}
          aria-hidden="true"
        />
        
        <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-8">
          <div className="flex justify-between items-center relative z-20">
            <div className="flex items-center space-x-4">
              <img 
                src={iconUrl} 
                alt={config.iconAltText || `${config.name} camp icon`}
                className={`rounded-full object-cover border-2 ${isScrolled ? 'border-amber-600' : 'border-white'} transition-all duration-300 ${
                  isScrolled ? 'w-10 h-10' : 'w-12 h-12'
                }`}
              />
              <h1 className={`font-bold transition-all duration-300 ${
                isScrolled ? 'text-amber-900 text-xl' : 'text-white text-2xl'
              }`}>
                {config.name}
              </h1>
            </div>
            
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
            <h2 className="text-white text-3xl md:text-4xl font-bold mb-2 drop-shadow-lg">
              {config.name}
            </h2>
            <p className="text-white/90 text-lg md:text-xl drop-shadow-md">
              {config.description}
            </p>
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
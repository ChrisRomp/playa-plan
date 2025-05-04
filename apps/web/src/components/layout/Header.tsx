import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useConfig } from '../../store/ConfigContext';
import Navigation from './Navigation';

const Header: React.FC = () => {
  const { config, isLoading } = useConfig();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState<number>(0);

  useEffect(() => {
    const header = document.getElementById('main-header');
    if (header) {
      setHeaderHeight(header.offsetHeight);
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

  const defaultBanner = 'https://images.pexels.com/photos/587976/pexels-photo-587976.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2';
  const bannerUrl = config.bannerUrl || defaultBanner;

  return (
    <>
      <header 
        id="main-header"
        className={`fixed w-full transition-all duration-300 z-10 ${
          isScrolled ? 'bg-white shadow-md' : 'bg-transparent'
        }`}
        style={{ height: isScrolled ? '64px' : '60vh' }}
      >
        <div 
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-300"
          style={{ 
            backgroundImage: `url(${bannerUrl})`,
            opacity: isScrolled ? 0 : 1,
            filter: 'brightness(0.7)'
          }}
        />
        
        <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-8">
          <div className="flex justify-between items-center relative z-20">
            <div className="flex items-center space-x-4">
              {config.iconUrl && (
                <img 
                  src={config.iconUrl} 
                  alt={`${config.name} icon`} 
                  className={`rounded-full object-cover border-2 border-white transition-all duration-300 ${
                    isScrolled ? 'w-8 h-8' : 'w-12 h-12'
                  }`}
                />
              )}
              <h1 className={`font-bold transition-all duration-300 ${
                isScrolled ? 'text-gray-800 text-xl' : 'text-white text-2xl'
              }`}>
                {config.name}
              </h1>
            </div>
            
            <button 
              onClick={toggleMenu}
              className={`block md:hidden p-2 rounded-full transition-colors ${
                isScrolled ? 'text-gray-800 hover:bg-gray-100' : 'text-white hover:bg-black/30'
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
        <div className="md:hidden fixed top-[64px] left-0 right-0 bg-white shadow-lg z-20 transition-all duration-300 transform">
          <Navigation isScrolled={true} isMobile={true} closeMenu={() => setIsMenuOpen(false)} />
        </div>
      )}
      
      {/* Spacer to prevent content from being hidden under the header */}
      <div style={{ height: headerHeight }} />
    </>
  );
};

export default Header;
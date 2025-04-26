import { useState } from 'react';
import { Link } from 'react-router-dom';

type NavItem = {
  label: string;
  href: string;
};

export interface HeaderProps {
  navItems: NavItem[];
  rightSection?: React.ReactNode;
}

export const Header = ({ navItems, rightSection }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-primary-700 font-bold text-xl">PlayaPlan</span>
            </Link>
            <nav className="hidden md:ml-6 md:flex md:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-secondary-700 hover:text-primary-700 border-b-2 border-transparent hover:border-primary-500"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="hidden md:ml-6 md:flex md:items-center">
            {rightSection}
          </div>
          <div className="flex items-center md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-secondary-400 hover:text-secondary-500 hover:bg-secondary-100 focus:outline-none focus:bg-secondary-100 focus:text-secondary-500"
              aria-expanded={isMenuOpen}
              onClick={toggleMenu}
            >
              <span className="sr-only">Open main menu</span>
              {!isMenuOpen ? (
                <svg
                  className="h-6 w-6"
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
              ) : (
                <svg
                  className="h-6 w-6"
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
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-secondary-600 hover:bg-secondary-50 hover:border-secondary-300 hover:text-secondary-800"
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-secondary-200">
            <div className="flex items-center px-4 py-2">
              {rightSection && <div className="ml-3">{rightSection}</div>}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

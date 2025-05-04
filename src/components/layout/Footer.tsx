import React from 'react';

interface FooterProps {
  campName: string;
}

export const Footer: React.FC<FooterProps> = ({ campName }) => {
  return (
    <footer className="bg-gray-800 text-white py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-lg font-semibold">{campName}</p>
          </div>
          <div className="text-gray-400 text-sm">
            <p className="text-center md:text-right">
              Powered by{' '}
              <a
                href="https://github.com/ChrisRomp/playa-plan"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
                aria-label="Visit PlayaPlan GitHub repository"
              >
                PlayaPlan
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 
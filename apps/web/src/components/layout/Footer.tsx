import { useConfig } from '../../hooks/useConfig';

const Footer: React.FC = () => {
  const { config } = useConfig();
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-800 text-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h3 className="text-xl font-semibold mb-2">
              {config?.name || 'Camp'}
            </h3>
            <p className="text-gray-300 text-sm">
              &copy; {currentYear} All rights reserved
            </p>
          </div>
          
          <div className="flex flex-col items-center md:items-end">
            <p className="text-gray-400 text-sm">
              Powered by{' '}
              <a 
                href="https://github.com/ChrisRomp/playa-plan" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
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
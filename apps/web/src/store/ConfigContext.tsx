import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CampConfig } from '../types';

interface ConfigContextType {
  config: CampConfig | null;
  isLoading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  isLoading: false,
  error: null,
  refreshConfig: async () => {}
});

export const useConfig = () => useContext(ConfigContext);

// Mock data - in a real application, this would come from an API
const mockConfig: CampConfig = {
  name: "PlayaPlan",
  description: "A Burning Man camp registration and planning tool",
  bannerUrl: "/images/playa-plan-banner.png",
  bannerAltText: "Desert landscape at sunset with art installations",
  iconUrl: "/icons/playa-plan-icon.png",
  iconAltText: "PlayaPlan camp icon",
  homePageBlurb: "<h2>Welcome to PlayaPlan.</h2><p>Please log in as an admin and configure your site.</p>",
  registrationOpen: true,
  earlyRegistrationOpen: true,
  currentYear: 2025
};

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<CampConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Mock API call - in a real application, this would fetch from an API
      await new Promise(resolve => setTimeout(resolve, 800));
      setConfig(mockConfig);
    } catch (err) {
      setError('Failed to load camp configuration');
      console.error('Error fetching config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, isLoading, error, refreshConfig: fetchConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};
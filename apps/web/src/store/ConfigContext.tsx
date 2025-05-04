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
  name: "Camp Dusty Dreams",
  description: "A place for dreamers in the dust",
  bannerUrl: "/images/playa-plan-banner.png",
  bannerAltText: "Desert landscape at sunset with art installations",
  iconUrl: "/icons/playa-plan-icon.png",
  iconAltText: "Camp Dusty Dreams camp icon",
  homePageBlurb: "<h2>Welcome to Camp Dusty Dreams!</h2><p>Join us for an unforgettable experience in the desert. Our camp provides a supportive community for creativity, self-expression, and radical inclusion.</p><p>Register now to secure your spot and sign up for shifts to help keep our camp running smoothly.</p>",
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
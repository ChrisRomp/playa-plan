import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { CampConfig } from '../types';
import { config as configApi } from '../lib/api';
import { fallbackConfig, mapApiConfigToFrontend } from '../utils/configUtils';
import { ConfigContext } from './ConfigContextDefinition';


// Provider component that wraps the application
export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<CampConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch configuration from the API
      const apiConfig = await configApi.getCurrent();
      setConfig(mapApiConfigToFrontend(apiConfig));
    } catch (err) {
      console.error('Error fetching config:', err);
      
      // Get the specific error message
      const errorMessage = err instanceof Error ? err.message : 'Unknown error fetching configuration';
      
      // Always set the error message to make connectivity issues visible
      setError(errorMessage);
      
      // Use fallback configuration if error occurs
      // Check current state with a function rather than dependency to avoid infinite loop
      setConfig(currentConfig => {
        if (!currentConfig) {
          console.warn('Using fallback configuration due to API error');
          return fallbackConfig;
        }
        return currentConfig;
      });
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array to prevent call loop

  // Load configuration only once when component mounts
  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally omit fetchConfig to prevent repeated calls

  return (
    <ConfigContext.Provider value={{ config, isLoading, error, refreshConfig: fetchConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

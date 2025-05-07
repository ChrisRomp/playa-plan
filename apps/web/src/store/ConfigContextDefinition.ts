/**
 * Configuration Context Definition
 * 
 * This file contains only the context definition and hook, separating it from
 * the provider component to ensure React Fast Refresh works correctly.
 */
import { createContext, useContext } from 'react';
import { CampConfig } from '../types';

// Define the shape of the context
export interface ConfigContextType {
  config: CampConfig | null;
  isLoading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
}

// Create the context with default values
export const ConfigContext = createContext<ConfigContextType>({
  config: null,
  isLoading: true,
  error: null,
  refreshConfig: async () => { /* default implementation */ },
});

// Hook for component access to the config context
export const useConfig = () => useContext(ConfigContext);

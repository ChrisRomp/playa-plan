/**
 * Configuration Context Definition
 * 
 * This file contains only the context definition and hook, separating it from
 * the provider component to ensure React Fast Refresh works correctly.
 */
import { createContext } from 'react';
import { CampConfig } from '../types';

// Define the shape of the context
export interface ConfigContextType {
  config: CampConfig | null;
  isLoading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
  // Connection state
  isConnecting: boolean;
  isConnected: boolean;
  connectionError: string | null;
}

// Create the context with default values
export const ConfigContext = createContext<ConfigContextType>({
  config: null,
  isLoading: true,
  error: null,
  refreshConfig: async () => { /* default implementation */ },
  // Connection state defaults
  isConnecting: true,
  isConnected: false,
  connectionError: null,
});

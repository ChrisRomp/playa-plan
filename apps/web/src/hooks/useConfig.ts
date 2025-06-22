import { useContext } from 'react';
import { ConfigContext } from '../store/ConfigContextDefinition';

/**
 * Hook to access the config context
 * This is separated to allow for proper fast refresh in development
 */
export const useConfig = () => useContext(ConfigContext);

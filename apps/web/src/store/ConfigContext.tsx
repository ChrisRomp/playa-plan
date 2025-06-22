/**
 * Configuration Context for the application
 * 
 * This file is a simple re-export of the components defined in ConfigContextProvider
 * to ensure React Fast Refresh works correctly by avoiding exporting both constants
 * and React components from the same file.
 */

// Re-export the provider component
export { ConfigProvider } from './ConfigContextProvider';

// Re-export the context definition and types
export { ConfigContext, type ConfigContextType } from './ConfigContextDefinition';
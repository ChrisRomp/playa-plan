/**
 * Profile Context for the application
 * 
 * This file is a simple re-export of the components defined in ProfileContextProvider
 * to ensure React Fast Refresh works correctly by avoiding exporting both constants
 * and React components from the same file.
 */

// Re-export the provider component
export { ProfileProvider } from './ProfileContextProvider';

// Re-export the context definition and types
export { ProfileContext, type UserProfile, type ProfileContextType } from './ProfileContextDefinition';

import { useContext } from 'react';
import { ProfileContext } from '../store/ProfileContextDefinition';

/**
 * Hook to access the profile context
 * This is separated to allow for proper fast refresh in development
 */
export const useProfile = () => useContext(ProfileContext);

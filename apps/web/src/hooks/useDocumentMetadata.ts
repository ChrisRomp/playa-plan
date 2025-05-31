import { useEffect } from 'react';
import { api } from '../lib/api';

/**
 * Custom hook to dynamically update document metadata based on camp configuration
 * Updates the page title to include the camp name and sets a meta description
 */
export const useDocumentMetadata = () => {
  useEffect(() => {
    const updateMetadata = async () => {
      try {
        // Fetch the current camp configuration using the API client
        // This will use the full backend URL since we removed the proxy
        const response = await api.get('/public/config');
        const config = response.data;
        
        if (config?.campName) {
          // Update document title
          document.title = `${config.campName} - Camp Registration`;
        }
        
        if (config?.campDescription) {
          // Strip HTML tags and limit to 160 characters for SEO
          const cleanDescription = config.campDescription
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .trim()
            .substring(0, 160);
          
          // Update or create meta description
          let metaDescription = document.querySelector('meta[name="description"]');
          if (!metaDescription) {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            document.head.appendChild(metaDescription);
          }
          metaDescription.setAttribute('content', cleanDescription);
        }
      } catch (error) {
        console.warn('Failed to update document metadata:', error);
      }
    };

    updateMetadata();
  }, []); // Empty dependency array means this runs once on mount
}; 
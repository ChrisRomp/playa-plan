import { useEffect } from 'react';

/**
 * Hook to dynamically update document title and meta description
 * based on camp configuration from the API
 */
export function useDocumentMetadata() {
  useEffect(() => {
    async function updateMetadata() {
      try {
        // Fetch current camp configuration
        const response = await fetch('/api/core-config/current');
        const config = await response.json();
        
        // Update document title
        if (config?.campName) {
          document.title = `${config.campName} - Camp Registration`;
        }
        
        // Update meta description
        if (config?.campDescription) {
          // Strip HTML tags from description
          const text = config.campDescription.replace(/<[^>]*>/g, '');
          // Limit to 160 characters for SEO best practices
          const description = text.length > 160 ? text.substring(0, 157) + '...' : text;
          
          // Find or create meta description tag
          let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement;
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', description);
        }
      } catch (error) {
        // Silently fail - page still works with default title
        console.warn('Failed to update document metadata:', error);
      }
    }
    
    updateMetadata();
  }, []);
} 
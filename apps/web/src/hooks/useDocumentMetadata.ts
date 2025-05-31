import { useEffect } from 'react';
import { api } from '../lib/api';

/**
 * Safely removes HTML tags and extracts plain text using DOMParser
 * This prevents HTML injection vulnerabilities that regex-based approaches can miss
 */
const sanitizeHtmlToText = (html: string): string => {
  try {
    // Use browser's DOMParser to safely parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Extract only the text content, which strips all HTML safely
    return doc.body.textContent || doc.body.innerText || '';
  } catch (error) {
    // Fallback: if DOMParser fails, return empty string for safety
    console.warn('Failed to sanitize HTML content:', error);
    return '';
  }
};

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
          // Safely strip HTML tags and limit to 160 characters for SEO
          const cleanDescription = sanitizeHtmlToText(config.campDescription)
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
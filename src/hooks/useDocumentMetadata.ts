import { useEffect } from 'react';

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
 * Hook to dynamically update document title and meta description
 * based on camp configuration from the API
 */
export function useDocumentMetadata() {
  useEffect(() => {
    async function updateMetadata() {
      try {
        // Fetch current camp configuration
        const response = await fetch('/public/config');
        const config = await response.json();
        
        // Update document title
        if (config?.campName) {
          document.title = `${config.campName} - Camp Registration`;
        }
        
        // Update meta description
        if (config?.campDescription) {
          // Safely strip HTML tags from description using DOMParser
          const text = sanitizeHtmlToText(config.campDescription);
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
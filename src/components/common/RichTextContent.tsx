import React from 'react';
import DOMPurify from 'dompurify';

interface RichTextContentProps {
  html: string;
  className?: string;
  preserveWhitespace?: boolean;
}

export const RichTextContent: React.FC<RichTextContentProps> = ({
  html,
  className = '',
  preserveWhitespace = false,
}) => {
  // Sanitize the HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 
      'ul', 'ol', 'li', 'br', 'a', 'blockquote', 'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'class', 'title', 'aria-label'
    ],
  });

  const whiteSpaceClass = preserveWhitespace ? 'whitespace-pre-wrap' : '';

  return (
    <div 
      className={`rich-text-content ${whiteSpaceClass} ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default RichTextContent; 
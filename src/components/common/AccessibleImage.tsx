import React, { useState } from 'react';

interface AccessibleImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  fallbackAlt?: string;
}

export const AccessibleImage: React.FC<AccessibleImageProps> = ({
  src,
  alt,
  fallbackSrc,
  fallbackAlt,
  className = '',
  ...rest
}) => {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [imgAlt, setImgAlt] = useState<string>(alt);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (fallbackSrc && !hasError) {
      setImgSrc(fallbackSrc);
      setImgAlt(fallbackAlt || alt);
      setHasError(true);
    }
  };

  // If neither primary nor fallback src is available, render a visually hidden
  // element with the alt text for screen readers
  if (!src && !fallbackSrc) {
    return (
      <span 
        className="sr-only" 
        role="img" 
        aria-label={alt}
      >
        {alt}
      </span>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={imgAlt}
      onError={handleError}
      className={className}
      {...rest}
    />
  );
};

export default AccessibleImage; 
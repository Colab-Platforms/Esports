import { useState, useEffect } from 'react';

const ResponsiveImage = ({ 
  imageUrl, 
  responsiveUrls = {}, 
  alt, 
  className = '',
  ...props 
}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);

  useEffect(() => {
    const updateImageForScreenSize = () => {
      const width = window.innerWidth;
      
      // Determine which image to use based on screen size
      if (width >= 1024) {
        // Desktop
        setCurrentImageUrl(responsiveUrls.desktop || imageUrl);
      } else if (width >= 768) {
        // Tablet
        setCurrentImageUrl(responsiveUrls.tablet || responsiveUrls.desktop || imageUrl);
      } else {
        // Mobile
        setCurrentImageUrl(
          responsiveUrls.mobile || 
          responsiveUrls.tablet || 
          responsiveUrls.desktop || 
          imageUrl
        );
      }
    };

    // Initial update
    updateImageForScreenSize();

    // Listen for window resize
    window.addEventListener('resize', updateImageForScreenSize);

    return () => {
      window.removeEventListener('resize', updateImageForScreenSize);
    };
  }, [imageUrl, responsiveUrls]);

  return (
    <img 
      src={currentImageUrl} 
      alt={alt} 
      className={className}
      {...props}
    />
  );
};

export default ResponsiveImage;

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
      
      console.log('📱 ResponsiveImage - Screen width:', width);
      console.log('📱 ResponsiveImage - Available URLs:', {
        main: imageUrl,
        desktop: responsiveUrls.desktop,
        tablet: responsiveUrls.tablet,
        mobile: responsiveUrls.mobile
      });
      
      let selectedUrl;
      
      // Determine which image to use based on screen size
      if (width >= 1024) {
        // Desktop
        selectedUrl = responsiveUrls.desktop || imageUrl;
        console.log('📱 Using DESKTOP image:', selectedUrl);
      } else if (width >= 768) {
        // Tablet
        selectedUrl = responsiveUrls.tablet || responsiveUrls.desktop || imageUrl;
        console.log('📱 Using TABLET image:', selectedUrl);
      } else {
        // Mobile
        selectedUrl = responsiveUrls.mobile || 
                     responsiveUrls.tablet || 
                     responsiveUrls.desktop || 
                     imageUrl;
        console.log('📱 Using MOBILE image:', selectedUrl);
      }
      
      setCurrentImageUrl(selectedUrl);
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

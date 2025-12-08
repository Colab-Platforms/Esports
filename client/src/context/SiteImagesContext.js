import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SiteImagesContext = createContext();

export const useSiteImages = () => {
  const context = useContext(SiteImagesContext);
  if (!context) {
    throw new Error('useSiteImages must be used within SiteImagesProvider');
  }
  return context;
};

export const SiteImagesProvider = ({ children }) => {
  const [siteImages, setSiteImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSiteImages = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/site-images`);
      
      if (response.data.success) {
        setSiteImages(response.data.data.images);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching site images:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSiteImages();
  }, []);

  const updateImage = (imageKey, newUrl) => {
    setSiteImages(prev => ({
      ...prev,
      [imageKey]: {
        ...prev[imageKey],
        imageUrl: newUrl
      }
    }));
  };

  const value = {
    siteImages,
    loading,
    error,
    fetchSiteImages,
    updateImage
  };

  return (
    <SiteImagesContext.Provider value={value}>
      {children}
    </SiteImagesContext.Provider>
  );
};

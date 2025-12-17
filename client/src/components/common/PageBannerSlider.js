import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import OptimizedImage from './OptimizedImage';
import ResponsiveImage from './ResponsiveImage';
import imageService from '../../services/imageService';

const PageBannerSlider = ({ pageKey = 'homepage', height = 'h-96' }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    fetchSlides();
  }, [pageKey]);

  const fetchSlides = async () => {
    setLoading(true);
    const result = await imageService.getAllImages();
    
    if (result.success) {
      const images = result.data;
      const pageSlides = [];
      
      // Get slides for this page (e.g., bgmi-slide-1, bgmi-slide-2, etc.)
      // Only add slides that have actual images uploaded
      for (let i = 1; i <= 5; i++) {
        const slideKey = `${pageKey}-slide-${i}`;
        const slideImage = images[slideKey];
        
        if (slideImage?.imageUrl) {
          pageSlides.push({
            id: slideKey,
            image: slideImage.imageUrl,
            responsiveUrls: slideImage.responsiveUrls,
            imageKey: slideKey
          });
        }
        // No placeholder slides - only show actual uploaded images
      }
      
      // If no slides found, add one placeholder for admin guidance
      if (pageSlides.length === 0) {
        pageSlides.push({
          id: `${pageKey}-no-slides`,
          image: null,
          responsiveUrls: null,
          imageKey: `${pageKey}-slide-1`,
          isPlaceholder: true
        });
      }
      
      setSlides(pageSlides);
    }
    
    setLoading(false);
  };

  // Auto-play
  useEffect(() => {
    if (!autoPlay || slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoPlay, slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  if (loading) {
    return (
      <div className={`relative ${height} bg-gaming-dark flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gaming-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    // Show placeholder when no slides uploaded
    const placeholderContent = {
      homepage: { icon: '🏠', title: 'Welcome to Colab Esports', desc: 'Your ultimate gaming tournament platform' },
      bgmi: { icon: '🎮', title: 'BGMI Tournaments', desc: 'Join exciting BGMI tournaments and compete with the best' },
      games: { icon: '🎯', title: 'Games Portal', desc: 'Explore all available games and join tournaments' },
      tournaments: { icon: '🏆', title: 'Tournaments Hub', desc: 'Compete in exciting tournaments and win amazing prizes' }
    };
    
    const content = placeholderContent[pageKey] || placeholderContent.homepage;
    
    return (
      <div className={`relative ${height} overflow-hidden bg-gradient-to-br from-gaming-dark via-gaming-charcoal to-gaming-dark flex items-center justify-center`}>
        <div className="text-center px-4">
          <div className="text-6xl mb-4">{content.icon}</div>
          <h2 className="text-3xl font-gaming font-bold text-white mb-2">
            {content.title}
          </h2>
          <p className="text-gray-400 max-w-md mx-auto">
            {content.desc}
          </p>
          <div className="mt-6 text-sm text-gray-500">
            Banner images can be uploaded via Admin Panel → Image Management
          </div>
        </div>
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];

  return (
    <div className={`relative ${height} overflow-hidden bg-gaming-dark`}>
      {/* Background Images */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentSlide}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ 
            type: 'tween',
            ease: 'easeInOut',
            duration: 0.7
          }}
          className="absolute inset-0"
        >
          <div className="w-full h-full overflow-hidden relative">
            {currentSlideData.isPlaceholder ? (
              // Placeholder slide
              <div className="w-full h-full bg-gradient-to-br from-gaming-dark via-gaming-charcoal to-gaming-dark flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="text-4xl mb-4">🎮</div>
                  <h3 className="text-xl font-gaming font-bold text-white mb-2">
                    Slide {currentSlide + 1}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Upload banner via Admin Panel
                  </p>
                </div>
              </div>
            ) : (
              // Actual image slide
              (() => {
                const hasResponsiveUrls = currentSlideData.responsiveUrls && Object.keys(currentSlideData.responsiveUrls).length > 0;
                
                return hasResponsiveUrls ? (
                  <ResponsiveImage
                    imageUrl={currentSlideData.image}
                    responsiveUrls={currentSlideData.responsiveUrls}
                    alt={`${pageKey} slide ${currentSlide + 1}`}
                    className="w-full h-full object-cover object-center"
                  />
                ) : (
                  <OptimizedImage
                    src={currentSlideData.image}
                    alt={`${pageKey} slide ${currentSlide + 1}`}
                    className="w-full h-full object-cover object-center"
                    lazy={false}
                  />
                );
              })()
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Controls */}
      {slides.length > 1 && (
        <>
          {/* Previous/Next Buttons */}
          <button
            onClick={prevSlide}
            className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-20 p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all duration-200"
          >
            <FiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-20 p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all duration-200"
          >
            <FiChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Slide Indicators */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2 sm:space-x-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-200 ${
                  index === currentSlide
                    ? 'bg-gaming-neon scale-125'
                    : 'bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* Auto-play control */}
      {slides.length > 1 && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setAutoPlay(!autoPlay)}
            className={`p-3 rounded-full backdrop-blur-md transition-all duration-200 shadow-lg hover:scale-110 ${
              autoPlay 
                ? 'bg-white/90 text-gaming-dark hover:bg-white' 
                : 'bg-gaming-gold/90 text-black hover:bg-gaming-gold'
            }`}
            title={autoPlay ? 'Pause slideshow' : 'Play slideshow'}
          >
            <span className="text-xl">
              {autoPlay ? '⏸' : '▶'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default PageBannerSlider;

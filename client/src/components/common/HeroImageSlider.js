import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import OptimizedImage from './OptimizedImage';
import ResponsiveImage from './ResponsiveImage';
import LoadingSpinner from './LoadingSpinner';
import imageService from '../../services/imageService';

const HeroImageSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [siteImages, setSiteImages] = useState({});
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left

  useEffect(() => {
    const loadData = async () => {
      await fetchSiteImages();
    };
    loadData();
  }, []);

  // Fetch hero data whenever siteImages changes
  useEffect(() => {
    if (Object.keys(siteImages).length > 0) {
      fetchHeroData();
    }
  }, [siteImages]);

  const fetchSiteImages = async () => {
    const result = await imageService.getAllImages();
    if (result.success) {
      console.log('🖼️ Fetched site images:', result.data);
      setSiteImages(result.data);
      return result.data;
    } else {
      console.error('Error fetching site images:', result.error);
      return {};
    }
  };

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || slides.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoPlay, slides.length]);

  const fetchHeroData = async () => {
    try {
      setLoading(true);
      
      // Get current siteImages from state
      const currentSiteImages = siteImages;
      console.log('🎬 Creating slides with siteImages:', currentSiteImages);
      
      // Create slides from uploaded homepage slides
      const heroSlides = [];
      
      // Add homepage slides (1-5)
      for (let i = 1; i <= 5; i++) {
        const slideKey = `homepage-slide-${i}`;
        const slideImage = currentSiteImages[slideKey];
        
        if (slideImage?.imageUrl) {
          heroSlides.push({
            id: slideKey,
            type: 'custom',
            title: 'COLAB ESPORTS',
            subtitle: `Slide ${i}`,
            description: 'Join thousands of gamers competing for glory and prizes',
            image: slideImage.imageUrl,
            responsiveUrls: slideImage.responsiveUrls,
            imageKey: slideKey,
            cta: {
              text: 'Explore Now',
              link: '/tournaments'
            }
          });
        }
      }
      
      // If no custom slides, add default platform slide
      if (heroSlides.length === 0) {
        heroSlides.push({
          id: 'default',
          type: 'platform',
          title: 'COLAB ESPORTS',
          subtitle: 'Ultimate Gaming Platform',
          description: 'Join thousands of gamers competing for glory and prizes',
          image: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Web_banner_CP_new_-_1.2_new_size.jpg?v=1764574806',
          responsiveUrls: {},
          imageKey: 'homepage-slide-1',
          cta: {
            text: 'Join Now',
            link: '/register'
          }
        });
      }
      
      console.log(`✅ Created ${heroSlides.length} slides for homepage`);

      setSlides(heroSlides);
    } catch (error) {
      console.error('Error fetching hero data:', error);
      // Fallback slide
      setSlides([
        {
          id: 'fallback',
          type: 'platform',
          title: 'COLAB ESPORTS',
          subtitle: 'Ultimate Gaming Platform',
          description: 'Join thousands of gamers competing for glory and prizes',
          image: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Web_banner_CP_new_-_1.2_new_size.jpg?v=1764574806',
          responsiveUrls: {},
          imageKey: 'homepage-slide-1',
          cta: {
            text: 'Get Started',
            link: '/register'
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };



  const nextSlide = () => {
    setDirection(1); // Slide from right
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setAutoPlay(false);
    setTimeout(() => setAutoPlay(true), 10000);
  };

  const prevSlide = () => {
    setDirection(-1); // Slide from left
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setAutoPlay(false);
    setTimeout(() => setAutoPlay(true), 10000);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setAutoPlay(false);
    setTimeout(() => setAutoPlay(true), 10000);
  };

  if (loading) {
    return (
      <div className="relative h-screen flex items-center justify-center bg-gaming-dark">
        <div className="absolute inset-0 bg-gradient-to-br from-gaming-neon/20 to-gaming-neon-blue/20" />
        <div className="relative z-10">
          <LoadingSpinner size="xl" text="Loading amazing content..." />
        </div>
      </div>
    );
  }

  if (slides.length === 0) return null;

  const currentSlideData = slides[currentSlide];

  return (
    <div className="relative min-h-screen h-screen overflow-hidden bg-gaming-dark">
      {/* Background Images */}
      <AnimatePresence initial={false}>
        <motion.div
          key={currentSlide}
          initial={{ x: direction > 0 ? '100%' : '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: direction > 0 ? '-100%' : '100%' }}
          transition={{ 
            type: 'tween',
            ease: 'easeInOut',
            duration: 0.6
          }}
          className="absolute inset-0"
        >
          <div className="w-full h-full overflow-hidden relative">
            {(() => {
              const hasResponsiveUrls = currentSlideData.responsiveUrls && Object.keys(currentSlideData.responsiveUrls).length > 0;
              console.log('🖼️ Slide data:', {
                key: currentSlideData.imageKey,
                hasResponsiveUrls,
                responsiveUrls: currentSlideData.responsiveUrls
              });
              
              return hasResponsiveUrls ? (
                <ResponsiveImage
                  imageUrl={currentSlideData.image}
                  responsiveUrls={currentSlideData.responsiveUrls}
                  alt={currentSlideData.title}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <OptimizedImage
                  src={currentSlideData.image}
                  alt={currentSlideData.title}
                  className="w-full h-full object-cover object-center"
                  lazy={false}
                />
              );
            })()}
          </div>
          {/* No overlay - clean images */}
        </motion.div>
      </AnimatePresence>

      {/* No text overlay - just images */}

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
          <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2 sm:space-x-3">
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
    </div>
  );
};

export default HeroImageSlider;
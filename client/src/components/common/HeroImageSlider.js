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
      // Defer loading to after initial render
      setTimeout(() => {
        fetchSiteImages();
      }, 100);
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
      
      // Add homepage slides (1-5) with unique content
      const slideContent = [
        {
          title: 'COLAB ESPORTS',
          subtitle: 'Ultimate Gaming Platform',
          description: 'Join thousands of gamers competing for glory and prizes',
          cta: { text: 'Join Now', link: '/register' }
        },
        {
          title: 'EPIC TOURNAMENTS',
          subtitle: 'Compete & Win Big',
          description: 'Battle in exciting tournaments with amazing prize pools',
          cta: { text: 'View Tournaments', link: '/tournaments' }
        },
        {
          title: 'BUILD YOUR TEAM',
          subtitle: 'Play Together, Win Together',
          description: 'Create or join teams and dominate the competition',
          cta: { text: 'Create Team', link: '/teams' }
        },
        {
          title: 'TRACK YOUR STATS',
          subtitle: 'Monitor Your Progress',
          description: 'View detailed statistics and climb the leaderboards',
          cta: { text: 'View Stats', link: '/profile' }
        },
        {
          title: 'EARN REWARDS',
          subtitle: 'Play, Win, Withdraw',
          description: 'Compete in tournaments and earn real rewards',
          cta: { text: 'Start Earning', link: '/wallet' }
        }
      ];

      for (let i = 1; i <= 5; i++) {
        const slideKey = `homepage-slide-${i}`;
        const slideImage = currentSiteImages[slideKey];
        const content = slideContent[i - 1];
        
        if (slideImage?.imageUrl) {
          heroSlides.push({
            id: slideKey,
            type: 'custom',
            title: content.title,
            subtitle: content.subtitle,
            description: content.description,
            image: slideImage.imageUrl,
            responsiveUrls: slideImage.responsiveUrls,
            imageKey: slideKey,
            cta: content.cta
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
      <div className="relative h-screen flex items-center justify-center bg-gaming-dark overflow-hidden">
        {/* Placeholder image - loads instantly */}
        <img 
          src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Web_banner_CP_new_-_1.2_new_size.jpg?v=1764574806"
          alt="Loading..."
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
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
                  fetchpriority="high"
                  loading="eager"
                />
              ) : (
                <OptimizedImage
                  src={currentSlideData.image}
                  alt={currentSlideData.title}
                  className="w-full h-full object-cover object-center"
                  lazy={false}
                  fetchpriority="high"
                />
              );
            })()}
          </div>
          {/* Gradient Overlay - centered on mobile, left-aligned on desktop */}
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Text Content Overlay with Animations */}
      <div className="absolute inset-0 z-10 flex items-center justify-center md:justify-start">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto md:mx-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-4 sm:space-y-6 text-center md:text-left"
              >
                {/* Subtitle with typing animation */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="overflow-hidden"
                >
                  <motion.p 
                    className="text-gaming-neon text-base sm:text-lg md:text-xl font-semibold tracking-wider uppercase hero-subtitle-glow"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                  >
                    {currentSlideData.subtitle.split('').map((char, index) => (
                      <motion.span
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + index * 0.03, duration: 0.1 }}
                      >
                        {char}
                      </motion.span>
                    ))}
                  </motion.p>
                </motion.div>

                {/* Title with slide-in animation */}
                <motion.h1
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white leading-tight hero-text-glow"
                >
                  {currentSlideData.title.split(' ').map((word, wordIndex) => (
                    <motion.span
                      key={wordIndex}
                      className="inline-block mr-3 sm:mr-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + wordIndex * 0.1, duration: 0.5 }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </motion.h1>

                {/* Description with fade-in animation */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                  className="text-gray-200 text-lg sm:text-xl md:text-2xl max-w-xl leading-relaxed mx-auto md:mx-0"
                >
                  {currentSlideData.description}
                </motion.p>

                {/* CTA Button with scale animation */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1, duration: 0.5, type: 'spring', stiffness: 200 }}
                  className="pt-2 sm:pt-4 flex justify-center md:justify-start"
                >
                  <a
                    href={currentSlideData.cta.link}
                    className="inline-block px-8 sm:px-10 py-4 sm:py-5 bg-gaming-neon hover:bg-gaming-gold text-black font-bold text-base sm:text-lg md:text-xl rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-gaming-neon/50"
                  >
                    {currentSlideData.cta.text}
                  </a>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      {slides.length > 1 && (
        <>
          {/* Previous/Next Buttons - Hidden on mobile */}
          <button
            onClick={prevSlide}
            className="hidden md:block absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-20 p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all duration-200"
          >
            <FiChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <button
            onClick={nextSlide}
            className="hidden md:block absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-20 p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all duration-200"
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
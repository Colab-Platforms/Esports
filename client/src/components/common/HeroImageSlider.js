import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiPlay } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import OptimizedImage from './OptimizedImage';
import ResponsiveImage from './ResponsiveImage';
import ImageEditor from '../designer/ImageEditor';
import api from '../../services/api';
import axios from 'axios';

const HeroImageSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [siteImages, setSiteImages] = useState({});

  useEffect(() => {
    fetchHeroData();
    fetchSiteImages();
  }, []);

  const fetchSiteImages = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/site-images`);
      if (response.data.success) {
        setSiteImages(response.data.data.images);
      }
    } catch (error) {
      console.error('Error fetching site images:', error);
    }
  };

  const handleImageUpdate = (imageKey, newUrl) => {
    console.log('🎨 Image updated:', imageKey, newUrl);
    
    // Update siteImages state
    setSiteImages(prev => ({
      ...prev,
      [imageKey]: {
        ...prev[imageKey],
        imageUrl: newUrl
      }
    }));

    // Update current slides array immediately
    setSlides(prevSlides => 
      prevSlides.map(slide => 
        slide.imageKey === imageKey 
          ? { ...slide, image: newUrl }
          : slide
      )
    );
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
      
      // Fetch featured tournaments and platform stats
      const [tournamentsResponse, statsResponse] = await Promise.all([
        api.get('/tournaments?featured=true&limit=5'),
        api.get('/tournaments/stats') // We'll create this endpoint
      ]);

      const tournaments = tournamentsResponse.data.data?.tournaments || [];
      const stats = statsResponse.data.data || {};

      // Create slides from tournaments and platform data
      const heroSlides = [
        // Main platform slide
        {
          id: 'main',
          type: 'platform',
          title: 'COLAB ESPORTS',
          subtitle: 'Ultimate Gaming Platform',
          description: 'Join thousands of gamers competing for glory and prizes',
          image: siteImages['hero-banner-main']?.imageUrl || 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Web_banner_CP_new_-_1.2_new_size.jpg?v=1764574806',
          responsiveUrls: siteImages['hero-banner-main']?.responsiveUrls,
          imageKey: 'hero-banner-main',
          cta: {
            text: 'Join Now',
            link: '/register'
          },
          stats: {
            players: stats.totalPlayers || '15K+',
            tournaments: stats.activeTournaments || '12',
            prizes: stats.totalPrizes || '₹2.5L+'
          }
        },
        // Tournament slides
        ...tournaments.map(tournament => ({
          id: tournament._id,
          type: 'tournament',
          title: tournament.name,
          subtitle: tournament.gameType?.toUpperCase() || 'TOURNAMENT',
          description: tournament.description || 'Join this exciting tournament',
          image: siteImages[`hero-banner-${tournament.gameType?.toLowerCase()}`]?.imageUrl || getGameBanner(tournament.gameType),
          responsiveUrls: siteImages[`hero-banner-${tournament.gameType?.toLowerCase()}`]?.responsiveUrls,
          imageKey: `hero-banner-${tournament.gameType?.toLowerCase()}`,
          cta: {
            text: 'Join Tournament',
            link: `/tournaments/${tournament._id}`
          },
          tournament: {
            prizePool: tournament.prizePool,
            entryFee: tournament.entryFee,
            participants: `${tournament.currentParticipants}/${tournament.maxParticipants}`,
            status: tournament.status
          }
        }))
      ];

      setSlides(heroSlides);
    } catch (error) {
      console.error('Error fetching hero data:', error);
      // Fallback slides
      setSlides([
        {
          id: 'fallback',
          type: 'platform',
          title: 'COLAB ESPORTS',
          subtitle: 'Ultimate Gaming Platform',
          description: 'Join thousands of gamers competing for glory and prizes',
          image: siteImages['hero-banner-main']?.imageUrl || 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Web_banner_CP_new_-_1.2_new_size.jpg?v=1764574806',
          imageKey: 'hero-banner-main',
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

  const getGameBanner = (gameType) => {
    const banners = {
      bgmi: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&h=1080&fit=crop&crop=center',
      cs2: 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1920&h=1080&fit=crop&crop=center',
      valorant: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1920&h=1080&fit=crop&crop=center',
      freefire: 'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1920&h=1080&fit=crop&crop=center'
    };
    return banners[gameType?.toLowerCase()] || banners.bgmi;
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setAutoPlay(false);
    setTimeout(() => setAutoPlay(true), 10000);
  };

  const prevSlide = () => {
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
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 border-4 border-gaming-neon border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading amazing content...</p>
        </div>
      </div>
    );
  }

  if (slides.length === 0) return null;

  const currentSlideData = slides[currentSlide];

  return (
    <div className="relative min-h-screen h-screen overflow-hidden bg-gaming-dark">
      {/* Background Images */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <div className="w-full h-full overflow-hidden relative">
            {currentSlideData.responsiveUrls ? (
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
            )}
            {/* Designer Edit Button - Top Left */}
            {currentSlideData.imageKey && (
              <ImageEditor
                imageKey={currentSlideData.imageKey}
                currentImageUrl={currentSlideData.image}
                onImageUpdate={(newUrl) => handleImageUpdate(currentSlideData.imageKey, newUrl)}
              />
            )}
          </div>
          {/* Light overlay to maintain readability */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-black/10 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gaming-neon/5 via-transparent to-gaming-neon-blue/5" />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center py-20 sm:py-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              key={`content-${currentSlide}`}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center lg:text-left"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mb-4"
              >
                <span className="px-4 py-2 bg-gaming-gold/20 text-gaming-gold rounded-full text-sm font-bold backdrop-blur-sm">
                  {currentSlideData.subtitle}
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-gaming font-bold text-white mb-4 sm:mb-6 leading-tight"
              >
                {currentSlideData.title}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 mb-6 sm:mb-8 max-w-2xl"
              >
                {currentSlideData.description}
              </motion.p>

              {/* Stats or Tournament Info */}
              {currentSlideData.type === 'platform' && currentSlideData.stats && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="grid grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8"
                >
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl md:text-3xl font-gaming font-bold text-gaming-gold">
                      {currentSlideData.stats.players}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm">Active Players</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl md:text-3xl font-gaming font-bold text-gaming-gold">
                      {currentSlideData.stats.tournaments}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm">Live Tournaments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl md:text-3xl font-gaming font-bold text-gaming-gold">
                      {currentSlideData.stats.prizes}
                    </div>
                    <div className="text-gray-400 text-xs sm:text-sm">Prizes Won</div>
                  </div>
                </motion.div>
              )}

              {currentSlideData.type === 'tournament' && currentSlideData.tournament && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  className="bg-black/40 backdrop-blur-sm rounded-lg p-6 mb-8"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gaming-gold text-sm font-medium">Prize Pool</div>
                      <div className="text-white text-xl font-bold">
                        ₹{currentSlideData.tournament.prizePool?.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gaming-gold text-sm font-medium">Entry Fee</div>
                      <div className="text-white text-xl font-bold">
                        ₹{currentSlideData.tournament.entryFee}
                      </div>
                    </div>
                    <div>
                      <div className="text-gaming-gold text-sm font-medium">Players</div>
                      <div className="text-white text-xl font-bold">
                        {currentSlideData.tournament.participants}
                      </div>
                    </div>
                    <div>
                      <div className="text-gaming-gold text-sm font-medium">Status</div>
                      <div className="text-white text-xl font-bold capitalize">
                        {currentSlideData.tournament.status?.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                <Link
                  to={currentSlideData.cta.link}
                  className="inline-flex items-center space-x-2 sm:space-x-3 bg-gradient-to-r from-gaming-neon to-gaming-neon-blue hover:from-gaming-neon-blue hover:to-gaming-neon text-white font-bold py-3 px-6 sm:py-4 sm:px-8 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-sm sm:text-base"
                >
                  <FiPlay className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{currentSlideData.cta.text}</span>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right Content - Game Icons or Visual Elements */}
            <motion.div
              key={`visual-${currentSlide}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="hidden lg:flex items-center justify-center"
            >
              <div className="relative">
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="w-64 h-64 bg-gradient-to-br from-gaming-neon/20 to-gaming-neon-blue/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-gaming-neon/30"
                >
                  <div className="text-8xl">
                    {currentSlideData.type === 'tournament' ? '🎮' : '🏆'}
                  </div>
                </motion.div>
                
                {/* Floating elements */}
                {['⚡', '🎯', '🔥', '💎'].map((icon, index) => (
                  <motion.div
                    key={index}
                    animate={{
                      y: [0, -20, 0],
                      rotate: [0, 180, 360]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: index * 0.5
                    }}
                    className={`absolute text-3xl ${
                      index === 0 ? 'top-4 right-4' :
                      index === 1 ? 'bottom-4 left-4' :
                      index === 2 ? 'top-4 left-4' :
                      'bottom-4 right-4'
                    }`}
                  >
                    {icon}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

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

      {/* Auto-play indicator */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setAutoPlay(!autoPlay)}
          className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 ${
            autoPlay 
              ? 'bg-gaming-neon/20 text-gaming-neon' 
              : 'bg-black/50 text-white'
          }`}
          title={autoPlay ? 'Pause auto-play' : 'Resume auto-play'}
        >
          {autoPlay ? '⏸️' : '▶️'}
        </button>
      </div>
    </div>
  );
};

export default HeroImageSlider;
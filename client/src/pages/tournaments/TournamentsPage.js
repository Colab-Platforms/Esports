import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilter, FiSearch, FiUsers, FiAward, FiChevronLeft, FiChevronRight, FiPlay } from 'react-icons/fi';
import { 
  fetchTournaments, 
  selectTournaments, 
  selectTournamentLoading, 
  selectTournamentError,
  setFilters,
  selectTournamentFilters
} from '../../store/slices/tournamentSlice';

const TournamentsPage = () => {
  const dispatch = useDispatch();
  const tournaments = useSelector(selectTournaments);
  const loading = useSelector(selectTournamentLoading);
  const error = useSelector(selectTournamentError);
  const filters = useSelector(selectTournamentFilters);
  
  const [currentBanner, setCurrentBanner] = useState(0);
  const [activeStatusTab, setActiveStatusTab] = useState('upcoming');
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Tournament banners for sliding carousel
  const banners = [
    {
      id: 1,
      title: 'COLAB CHAMPIONSHIP SERIES',
      subtitle: 'Compete across all games for ultimate glory',
      background: 'linear-gradient(135deg, #f1c40f 0%, #000000 100%)',
      image: '🏆',
      cta: 'Join Championship'
    },
    {
      id: 2,
      title: 'WEEKLY TOURNAMENTS',
      subtitle: 'Regular competitions with amazing prizes',
      background: 'linear-gradient(135deg, #ff6b35 0%, #000000 100%)',
      image: '⚡',
      cta: 'View Weekly Events'
    },
    {
      id: 3,
      title: 'COMMUNITY BATTLES',
      subtitle: 'Player-organized tournaments and events',
      background: 'linear-gradient(135deg, #4a90e2 0%, #000000 100%)',
      image: '👥',
      cta: 'Join Community'
    }
  ];

  // Auto-slide banners
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners.length]);

  // Fetch tournaments on component mount and when filters change
  useEffect(() => {
    console.log('Fetching tournaments with filters:', {
      status: activeStatusTab === 'all' ? undefined : activeStatusTab,
      gameType: activeCategoryTab === 'all' ? undefined : activeCategoryTab
    });
    dispatch(fetchTournaments({
      status: activeStatusTab === 'all' ? undefined : activeStatusTab,
      gameType: activeCategoryTab === 'all' ? undefined : activeCategoryTab
    }));
  }, [dispatch, activeStatusTab, activeCategoryTab]);

  // Debug log tournaments data
  useEffect(() => {
    console.log('Tournaments data:', tournaments);
    console.log('Loading:', loading);
    console.log('Error:', error);
  }, [tournaments, loading, error]);

  // Handle filter changes
  const handleStatusTabChange = (status) => {
    setActiveStatusTab(status);
  };

  const handleCategoryTabChange = (category) => {
    setActiveCategoryTab(category);
  };

  // Get game icon based on game type
  const getGameIcon = (gameType) => {
    switch (gameType) {
      case 'bgmi':
        return '📱';
      case 'valorant':
        return '🎯';
      case 'cs2':
        return '⚡';
      default:
        return '🎮';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filter tournaments based on search and active tabs
  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = activeStatusTab === 'all' || tournament.status === activeStatusTab;
    const matchesCategory = activeCategoryTab === 'all' || tournament.gameType === activeCategoryTab;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Tournament background gradients based on game type
  const getBackgroundGradient = (gameType) => {
    switch (gameType) {
      case 'bgmi':
        return 'linear-gradient(135deg, #ff6b35 0%, #2c1810 100%)';
      case 'valorant':
        return 'linear-gradient(135deg, #ff4655 0%, #2c1810 100%)';
      case 'cs2':
        return 'linear-gradient(135deg, #f39800 0%, #2c1810 100%)';
      default:
        return 'linear-gradient(135deg, #4a90e2 0%, #2c1810 100%)';
    }
  };

  const statusTabs = [
    { id: 'all', label: 'ALL' },
    { id: 'upcoming', label: 'UPCOMING' },
    { id: 'registration_open', label: 'OPEN' },
    { id: 'active', label: 'ACTIVE' },
    { id: 'completed', label: 'COMPLETED' }
  ];

  const categoryTabs = [
    { id: 'all', label: 'ALL GAMES' },
    { id: 'bgmi', label: 'BGMI' },
    { id: 'valorant', label: 'VALORANT' },
    { id: 'cs2', label: 'CS2' }
  ];

  const nextBanner = () => {
    setCurrentBanner((prev) => (prev + 1) % banners.length);
  };

  const prevBanner = () => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
  };

  // This is already defined above, so we can remove this duplicate

  const TournamentCard = ({ tournament }) => (
    <Link to={`/tournament/${tournament._id}`}>
      <motion.div
        whileHover={{ y: -5, scale: 1.02 }}
        className="relative overflow-hidden rounded-xl border border-gaming-border hover:border-gaming-gold/50 transition-all duration-300 group cursor-pointer"
        style={{ background: getBackgroundGradient(tournament.gameType) }}
      >
        <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-all duration-300" />
        
        <div className="relative p-4 h-48 flex flex-col justify-between">
          {/* Game Icon & Status */}
          <div className="flex justify-between items-start">
            <div className="text-4xl">{getGameIcon(tournament.gameType)}</div>
            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
              tournament.status === 'active' 
                ? 'bg-red-500 text-white animate-pulse' 
                : tournament.status === 'registration_open'
                ? 'bg-green-500 text-white'
                : tournament.status === 'upcoming'
                ? 'bg-gaming-gold text-black'
                : 'bg-gray-600 text-white'
            }`}>
              {tournament.status.toUpperCase().replace('_', ' ')}
            </span>
          </div>

          {/* Tournament Info */}
          <div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-gaming-gold transition-colors duration-300 line-clamp-2">
              {tournament.name}
            </h3>
            
            <div className="text-xs text-gray-300 mb-2">
              {formatDate(tournament.startDate)} • {tournament.gameType.toUpperCase()}
            </div>

            {/* Stats */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <FiAward className="h-3 w-3 text-gaming-gold" />
                  <span className="text-gaming-gold font-bold">₹{tournament.prizePool.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <FiUsers className="h-3 w-3 text-white" />
                  <span className="text-white">{tournament.currentParticipants || 0}/{tournament.maxParticipants}</span>
                </div>
              </div>
              
              <button className="px-3 py-1 bg-gaming-gold text-black text-xs font-bold rounded hover:bg-gaming-accent transition-colors duration-200">
                {tournament.status === 'registration_open' ? 'JOIN NOW' : 'VIEW'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Banner Carousel */}
      <section className="relative h-80 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBanner}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: banners[currentBanner].background }}
          >
            <div className="absolute inset-0 bg-black/50" />
            
            <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-6xl mb-6"
              >
                {banners[currentBanner].image}
              </motion.div>
              
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-6xl font-gaming font-bold text-white mb-4"
              >
                {banners[currentBanner].title}
              </motion.h1>
              
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xl text-gray-300 mb-8"
              >
                {banners[currentBanner].subtitle}
              </motion.p>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <button className="btn-gaming inline-flex items-center space-x-2">
                  <FiPlay className="h-5 w-5" />
                  <span>{banners[currentBanner].cta}</span>
                </button>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <button
          onClick={prevBanner}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
        >
          <FiChevronLeft className="h-6 w-6" />
        </button>
        
        <button
          onClick={nextBanner}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
        >
          <FiChevronRight className="h-6 w-6" />
        </button>

        {/* Banner Indicators */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentBanner ? 'bg-gaming-gold' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-gaming font-bold text-white">
            TOURNAMENTS
          </h1>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gaming-card border border-gaming-border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gaming-gold focus:border-transparent"
            />
          </div>

          {/* Filters Button */}
          <button className="flex items-center space-x-2 px-6 py-3 bg-gaming-card border border-gaming-border rounded-lg text-white hover:border-gaming-gold transition-colors duration-200">
            <FiFilter className="h-4 w-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Date Filter */}
        <div className="mb-6">
          <select className="px-4 py-2 bg-gaming-card border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold">
            <option>CLOSEST START DATE</option>
            <option>LATEST START DATE</option>
            <option>HIGHEST PRIZE POOL</option>
            <option>LOWEST ENTRY FEE</option>
          </select>
        </div>

        {/* Tournament Status Tabs */}
        <div className="mb-8">
          <div className="flex space-x-8 border-b border-gaming-border">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveStatusTab(tab.id)}
                className={`pb-4 px-2 font-semibold transition-colors duration-200 ${
                  activeStatusTab === tab.id
                    ? 'text-gaming-gold border-b-2 border-gaming-gold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tournament Categories */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4">
            {categoryTabs.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategoryTab(category.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 ${
                  activeCategoryTab === category.id
                    ? 'bg-gaming-gold text-black'
                    : 'bg-gaming-card text-gray-300 hover:text-white border border-gaming-border'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tournament Grid */}
        <div className="min-h-96">
          {loading ? (
            // Loading State
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="bg-gaming-charcoal rounded-xl h-48 border border-gaming-border"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            // Error State
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="text-6xl text-red-500 mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Error Loading Tournaments</h3>
              <p className="text-gray-400 text-center max-w-md mb-4">
                {error.message || 'Failed to load tournaments. Please try again.'}
              </p>
              <button
                onClick={() => dispatch(fetchTournaments({
                  status: activeStatusTab === 'all' ? undefined : activeStatusTab,
                  gameType: activeCategoryTab === 'all' ? undefined : activeCategoryTab
                }))}
                className="btn-gaming"
              >
                Try Again
              </button>
            </motion.div>
          ) : filteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament, index) => (
                <motion.div
                  key={tournament._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TournamentCard tournament={tournament} />
                </motion.div>
              ))}
            </div>
          ) : (
            // Empty State
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="text-6xl text-gray-600 mb-4">
                <FiAward />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No tournaments found</h3>
              <p className="text-gray-400 text-center max-w-md">
                {searchQuery 
                  ? `No tournaments match "${searchQuery}". Try different search terms or filters.`
                  : 'No tournaments found for the selected filters. Try adjusting your filters or check back later.'
                }
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentsPage;
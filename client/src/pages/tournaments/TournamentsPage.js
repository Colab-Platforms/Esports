import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilter, FiSearch, FiUsers, FiAward, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import GameIcon from '../../components/common/GameIcon';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import TournamentCardProfessional from '../../components/tournaments/TournamentCardProfessional';
import imageService from '../../services/imageService';
import { 
  fetchTournaments, 
  selectTournaments, 
  selectTournamentLoading, 
  selectTournamentError
} from '../../store/slices/tournamentSlice';

const TournamentsPage = () => {
  const dispatch = useDispatch();
  const tournaments = useSelector(selectTournaments);
  const loading = useSelector(selectTournamentLoading);
  const error = useSelector(selectTournamentError);
  
  const [currentBanner, setCurrentBanner] = useState(0);
  const [activeStatusTab, setActiveStatusTab] = useState('all');
  const [activeCategoryTab, setActiveCategoryTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [siteImages, setSiteImages] = useState({});
  
  // Advanced filter states
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGameTypes, setFilterGameTypes] = useState([]); // Changed to array for multiselect
  const [showGameTypeDropdown, setShowGameTypeDropdown] = useState(false);

  // Fetch site images for banners (uses cached data if available)
  useEffect(() => {
    const fetchSiteImages = async () => {
      const result = await imageService.getAllImages();
      if (result.success) {
        setSiteImages(result.data);
      }
    };
    fetchSiteImages();
  }, []);

  // handleImageUpdate removed - banners managed via Controls/Banners page

  // Tournament banners from ImageManagement (tournaments-slide-1, 2, 3)
  const banners = [
    {
      id: 1,
      imageKey: 'tournaments-slide-1',
      image: siteImages['tournaments-slide-1']?.imageUrl
    },
    {
      id: 2,
      imageKey: 'tournaments-slide-2',
      image: siteImages['tournaments-slide-2']?.imageUrl
    },
    {
      id: 3,
      imageKey: 'tournaments-slide-3',
      image: siteImages['tournaments-slide-3']?.imageUrl
    }
  ].filter(banner => banner.image); // Only show uploaded banners

  // Reset currentBanner if out of bounds
  useEffect(() => {
    if (banners.length > 0 && currentBanner >= banners.length) {
      setCurrentBanner(0);
    }
  }, [banners.length, currentBanner]);

  // Auto-slide banners
  useEffect(() => {
    if (banners.length === 0) return;
    
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

  // Handle filter changes - functions integrated directly in onClick handlers

  // Get game icon based on game type
  const getGameIcon = (gameType) => {
    // Use GameIcon component instead of hardcoded emojis
    return <GameIcon gameType={gameType} size="sm" />;
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming':
        return 'text-blue-400 bg-blue-400/10';
      case 'registration_open':
        return 'text-green-400 bg-green-400/10';
      case 'active':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'completed':
        return 'text-red-400 bg-red-800/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  // Get mode icon
  const getModeIcon = (mode) => {
    switch (mode) {
      case 'solo':
        return '👤';
      case 'duo':
        return '👥';
      case 'squad':
        return '👨‍👩‍👧‍👦';
      default:
        return '🎮';
    }
  };

  // Handle game type selection (multiselect)
  const handleGameTypeToggle = (gameType) => {
    setFilterGameTypes(prev => {
      if (prev.includes(gameType)) {
        // Remove if already selected
        return prev.filter(g => g !== gameType);
      } else {
        // Add if not selected
        return [...prev, gameType];
      }
    });
  };

  // Filter tournaments based on search and active filters
  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Status filter
    let matchesStatus = true;
    if (filterStatus !== 'all') {
      if (filterStatus === 'active') {
        matchesStatus = tournament.status === 'active' || tournament.status === 'registration_open';
      } else if (filterStatus === 'completed') {
        matchesStatus = tournament.status === 'completed';
      }
    }
    
    // Game type filter (multiselect)
    const matchesGameType = filterGameTypes.length === 0 || filterGameTypes.includes(tournament.gameType);
    
    return matchesSearch && matchesStatus && matchesGameType;
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
    <TournamentCardProfessional 
      tournament={tournament}
      getModeIcon={getModeIcon}
      getStatusColor={getStatusColor}
      formatDate={formatDate}
      showTimer={true}
      gameType={tournament.gameType}
    />
  );

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Banner Carousel - Plain images like homepage */}
      <section className="relative h-80 overflow-hidden bg-gradient-to-br from-gaming-dark via-gaming-charcoal to-gaming-dark">
        {banners.length > 0 && banners[currentBanner] ? (
          <>
          {/* Banner with images */}
          <AnimatePresence initial={false}>
            <motion.div
              key={currentBanner}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ 
                type: 'tween',
                ease: 'easeInOut',
                duration: 0.6
              }}
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${banners[currentBanner]?.image || ''})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* No text overlay - clean images */}
              {/* Camera icon removed - manage via Controls/Banners */}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          {banners.length > 1 && (
            <>
              <button
                onClick={prevBanner}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
              >
                <FiChevronLeft className="h-6 w-6" />
              </button>
              
              <button
                onClick={nextBanner}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
              >
                <FiChevronRight className="h-6 w-6" />
              </button>

              {/* Banner Indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2">
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
            </>
          )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <div className="text-6xl mb-4">
              <GameIcon gameType="valorant" size="2xl" />
            </div>
            <h2 className="text-3xl font-gaming font-bold text-white mb-2">
              Tournaments Hub
            </h2>
            <p className="text-gray-400 max-w-md">
              Compete in exciting tournaments and win amazing prizes
            </p>
            <div className="mt-6 text-sm text-gray-500">
              Banner images can be uploaded via Admin Panel → Image Management
            </div>
          </div>
        )}
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title, Search and Filters - All in one line */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center gap-4">
          {/* Page Title */}
          <h1 className="text-3xl font-gaming font-bold text-white whitespace-nowrap">
            TOURNAMENTS
          </h1>

          {/* Search Bar */}
          <div className="flex-1 relative w-full md:w-auto">
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
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-6 py-3 bg-gaming-card border border-gaming-border rounded-lg text-white hover:border-gaming-gold transition-colors duration-200 whitespace-nowrap ${showFilters ? 'border-gaming-gold bg-gaming-gold/10' : ''}`}
          >
            <FiFilter className="h-4 w-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Advanced Filters Modal */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-6 bg-gaming-card border border-gaming-border rounded-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-gaming font-bold text-white">Advanced Filters</h3>
                <button 
                  onClick={() => setShowFilters(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Status</label>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold font-gaming"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active / Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Game Type (Multi-Select)</label>
                  <button
                    type="button"
                    onClick={() => setShowGameTypeDropdown(!showGameTypeDropdown)}
                    className="w-full px-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold font-gaming text-left flex items-center justify-between"
                  >
                    <span className="truncate">
                      {filterGameTypes.length === 0 
                        ? 'Select Games' 
                        : filterGameTypes.length === 1
                        ? filterGameTypes[0].toUpperCase()
                        : `${filterGameTypes.length} Games Selected`
                      }
                    </span>
                    <FiChevronRight className={`transform transition-transform ${showGameTypeDropdown ? 'rotate-90' : ''}`} />
                  </button>
                  
                  {/* Multiselect Dropdown */}
                  {showGameTypeDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-gaming-dark border border-gaming-border rounded-lg shadow-lg overflow-hidden">
                      {['bgmi', 'freefire', 'valorant', 'cs2'].map((game) => (
                        <label
                          key={game}
                          className="flex items-center px-4 py-3 hover:bg-gaming-card cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={filterGameTypes.includes(game)}
                            onChange={() => handleGameTypeToggle(game)}
                            className="w-4 h-4 text-gaming-gold bg-gaming-charcoal border-gaming-border rounded focus:ring-gaming-gold focus:ring-2"
                          />
                          <span className="ml-3 text-white font-gaming">
                            {game === 'bgmi' ? 'BGMI' : 
                             game === 'freefire' ? 'Free Fire' : 
                             game === 'valorant' ? 'Valorant' : 
                             'CS2'}
                          </span>
                          {filterGameTypes.includes(game) && (
                            <span className="ml-auto text-gaming-gold">✓</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end mt-4 space-x-3">
                <button 
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterGameTypes([]);
                    setSearchQuery('');
                    setShowGameTypeDropdown(false);
                  }}
                  className="px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors font-gaming"
                >
                  Clear All
                </button>
                <button 
                  onClick={() => {
                    setShowFilters(false);
                    setShowGameTypeDropdown(false);
                  }}
                  className="px-4 py-2 bg-gaming-gold text-black rounded-lg hover:bg-gaming-accent transition-colors font-gaming font-bold"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tournament Status Tabs */}
        {/* <div className="mb-8">
          <div className="overflow-x-auto">
            <div className="flex space-x-8 border-b border-gaming-border min-w-max">
              {statusTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveStatusTab(tab.id)}
                  className={`pb-4 px-2 font-semibold transition-colors duration-200 whitespace-nowrap ${
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
        </div> */}

        {/* Tournament Categories */}
        {/* <div className="mb-8">
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-2">
              {categoryTabs.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategoryTab(category.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors duration-200 whitespace-nowrap ${
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
        </div> */}

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
              <div className="text-6xl text-red-500 mb-4"></div>
              <h3 className="text-xl font-bold text-white mb-2">
                {error.code === 'TIMEOUT' 
                  ? 'Connection Timeout' 
                  : error.code === 'SERVICE_UNAVAILABLE'
                  ? 'Server Temporarily Unavailable'
                  : 'Error Loading Tournaments'}
              </h3>
              <p className="text-gray-400 text-center max-w-md mb-4">
                {error.message || 'Failed to load tournaments. Please check your internet connection and try again.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => dispatch(fetchTournaments({
                    status: activeStatusTab === 'all' ? undefined : activeStatusTab,
                    gameType: activeCategoryTab === 'all' ? undefined : activeCategoryTab
                  }))}
                  className="btn-gaming"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors font-gaming"
                >
                  Refresh Page
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                {error.code === 'TIMEOUT' && 'Tip: Check your internet connection. If problem persists, try refreshing the page.'}
                {error.code === 'SERVICE_UNAVAILABLE' && 'Tip: The server is temporarily busy. Please wait a moment and try again.'}
              </p>
            </motion.div>
          ) : filteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament, index) => (
                <div key={tournament._id} className="w-11/12 mx-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <TournamentCard tournament={tournament} />
                  </motion.div>
                </div>
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
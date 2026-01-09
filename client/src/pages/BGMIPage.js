import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageBannerSlider from '../components/common/PageBannerSlider';
import BGMIRegistrationForm from '../components/bgmi/BGMIRegistrationForm';
import GameIcon from '../components/common/GameIcon';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CountdownTimer from '../components/common/CountdownTimer';
import { getCdnIcon } from '../assets/gameAssets';
import { selectUser } from '../store/slices/authSlice';
import {
  fetchTournaments,
  selectTournaments,
  selectTournamentLoading,
  selectTournamentError,
  selectTournamentPagination,
  clearError
} from '../store/slices/tournamentSlice';

const BGMIPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const tournaments = useSelector(selectTournaments);
  const loading = useSelector(selectTournamentLoading);
  const error = useSelector(selectTournamentError);
  const pagination = useSelector(selectTournamentPagination);

  const [activeTab, setActiveTab] = useState('upcoming');
  const [filters, setFilters] = useState({
    entryFeeMin: '',
    entryFeeMax: '',
    prizePoolMin: '',
    mode: ''
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState(null);

  // Debounce filters to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 1500); // 1.5 second delay - enough time to type complete values

    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    // Fetch BGMI tournaments based on active tab and debounced filters
    const status = getStatusFromTab(activeTab);
    dispatch(fetchTournaments({
      gameType: 'bgmi',
      status,
      entryFeeMin: debouncedFilters.entryFeeMin,
      entryFeeMax: debouncedFilters.entryFeeMax,
      prizePoolMin: debouncedFilters.prizePoolMin,
      mode: debouncedFilters.mode,
      page: 1,
      limit: 12
    }));
  }, [dispatch, activeTab, debouncedFilters]);

  const getStatusFromTab = (tab) => {
    switch (tab) {
      case 'upcoming':
        return 'upcoming,registration_open,registration_closed';
      case 'live':
        return 'active';
      case 'completed':
        return 'completed';
      default:
        return 'upcoming,registration_open,registration_closed';
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      entryFeeMin: '',
      entryFeeMax: '',
      prizePoolMin: '',
      mode: ''
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming':
        return 'text-blue-400 bg-blue-400/10';
      case 'registration_open':
        return 'text-green-400 bg-green-400/10';
      case 'active':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'completed':
        return 'text-gray-400 bg-gray-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'solo':
        return '';
      case 'duo':
        return '';
      case 'squad':
        return '';
      default:
        return '';
    }
  };

  const handleRegisterClick = (tournament) => {
    if (!user) {
      // Redirect to login if not authenticated
      navigate('/login');
      return;
    }
    
    setSelectedTournament(tournament);
    setShowRegistrationForm(true);
  };

  const handleRegistrationSuccess = (registration) => {
    setShowRegistrationForm(false);
    setSelectedTournament(null);
    
    // Optional: Show a success notification or stay on the same page
    // Users will receive WhatsApp message with instructions to send images
  };

  const handleCloseRegistrationForm = () => {
    setShowRegistrationForm(false);
    setSelectedTournament(null);
  };

  // Safety check for tournaments data
  if (!tournaments) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading BGMI tournaments..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Banner Slider */}
      <PageBannerSlider pageKey="bgmi" height="h-96" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tournament Tabs */}
        <div className="card-gaming p-6 mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'upcoming', label: 'Upcoming', icon: '' },
              { key: 'live', label: 'Live', icon: '' },
              { key: 'completed', label: 'Completed', icon: '' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center space-x-2 px-4 py-2 font-display font-medium transition-all duration-200 border ${
                  activeTab === tab.key
                    ? 'bg-gaming-gold/20 border-gaming-gold text-gaming-gold'
                    : 'bg-white/5 border-white/20 text-gray-300 hover:border-gaming-gold/60 hover:bg-white/10'
                }`}
                // style={{
                //   clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'
                // }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mode
              </label>
              <select
                value={filters.mode}
                onChange={(e) => handleFilterChange('mode', e.target.value)}
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none font-gaming"
              >
                <option value="">All Modes</option>
                <option value="solo">Solo</option>
                <option value="duo">Duo</option>
                <option value="squad">Squad</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Min Entry Fee
              </label>
              <input
                type="number"
                value={filters.entryFeeMin}
                onChange={(e) => handleFilterChange('entryFeeMin', e.target.value)}
                placeholder="₹0"
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none font-gaming"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Entry Fee
              </label>
              <input
                type="number"
                value={filters.entryFeeMax}
                onChange={(e) => handleFilterChange('entryFeeMax', e.target.value)}
                placeholder="₹1000"
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none font-gaming"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 text-white rounded-none hover:border-gaming-gold/60 hover:bg-white/10 transition-colors duration-200 font-display font-bold"
                style={{
                  clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="card-gaming p-6 mb-6">
            <div className="text-center">
              <div className="text-red-400 text-6xl mb-4"></div>
              <h3 className="text-xl font-bold text-white mb-2">Error Loading Tournaments</h3>
              <p className="text-gray-300 mb-4">{error.message}</p>
              <button
                onClick={() => {
                  dispatch(clearError());
                  dispatch(fetchTournaments({
                    gameType: 'bgmi',
                    status: getStatusFromTab(activeTab),
                    ...filters
                  }));
                }}
                className="px-6 py-2 bg-white/5 border border-white/20 text-white font-display font-bold hover:border-gaming-gold/60 hover:bg-white/10 transition-all duration-300"
                style={{
                  clipPath: 'polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)'
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Main Content Grid - Tournaments */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!tournaments || tournaments.length === 0 ? (
            <div className="card-gaming p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">
                <img src={getCdnIcon('features', 'tournaments')} alt="No tournaments" className="w-16 h-16 mx-auto opacity-50" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No BGMI Tournaments Found</h2>
              <p className="text-gray-300 mb-4">
                {activeTab === 'upcoming' 
                  ? 'No upcoming tournaments at the moment. Check back soon!'
                  : activeTab === 'live'
                  ? 'No live tournaments right now.'
                  : 'No completed tournaments to show.'
                }
              </p>
            </div>
          ) : (
            <>
              {tournaments?.map((tournament) => (
                <div key={tournament._id} className="w-full">
                  <TournamentCard 
                    tournament={tournament}
                    navigate={navigate}
                    getModeIcon={getModeIcon}
                    getStatusColor={getStatusColor}
                    formatDate={formatDate}
                    onRegisterClick={handleRegisterClick}
                  />
                </div>
              ))}
            </>
          )}
        </div>
        {showRegistrationForm && selectedTournament && (
          <BGMIRegistrationForm
            tournament={selectedTournament}
            onClose={handleCloseRegistrationForm}
            onSuccess={handleRegistrationSuccess}
          />
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="card-gaming p-4 mt-6">
            <div className="flex items-center justify-between">
              <div className="text-gray-300 text-sm">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} tournaments
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => dispatch(fetchTournaments({
                    gameType: 'bgmi',
                    status: getStatusFromTab(activeTab),
                    ...filters,
                    page: pagination.page - 1
                  }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 bg-white/5 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-gold/60 hover:bg-white/10 font-display font-bold transition-all duration-300"
                  style={{
                    clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px)'
                  }}
                >
                  Previous
                </button>
                
                <span className="px-3 py-1 bg-gaming-gold/20 border border-gaming-gold text-gaming-gold font-display font-bold"
                  style={{
                    clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px)'
                  }}
                >
                  {pagination.page}
                </span>
                
                <button
                  onClick={() => dispatch(fetchTournaments({
                    gameType: 'bgmi',
                    status: getStatusFromTab(activeTab),
                    ...filters,
                    page: pagination.page + 1
                  }))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-1 bg-white/5 border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-gold/60 hover:bg-white/10 font-display font-bold transition-all duration-300"
                  style={{
                    clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px)'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BGMI Specific Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="card-gaming p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <GameIcon gameType="bgmi" size="sm" />
              <span>BGMI Tournament Rules</span>
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div>• Room ID and password will be shared 30 minutes before match</div>
              <div>• Screenshots required for result verification</div>
              <div>• No third-party apps or cheats allowed</div>
              <div>• Follow fair play guidelines</div>
              <div>• Disputes must be raised within 24 hours</div>
            </div>
          </div>

          <div className="card-gaming p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
              <GameIcon gameType="bgmi" size="sm" />
              <span>How to Join BGMI Match</span>
            </h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div>1. Register for the tournament</div>
              <div>2. Get room credentials before match time</div>
              <div>3. Join the custom room in BGMI</div>
              <div>4. Play the match and take screenshots</div>
              <div>5. Submit results through our platform</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoized Tournament Card Component
const TournamentCard = React.memo(({ tournament, navigate, getModeIcon, getStatusColor, formatDate, onRegisterClick }) => {
  const isRegistrationClosed = tournament.status === 'registration_closed';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full aspect-[4/5] overflow-hidden border border-gaming-gold/70 hover:border-gaming-gold transition-all duration-300 group bg-gradient-to-br from-gaming-charcoal via-gaming-dark to-gaming-darker shadow-xl hover:shadow-gaming-gold/40"
      style={{
        clipPath: 'polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)'
      }}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        {tournament.bannerImage ? (
          <img 
            src={tournament.bannerImage} 
            alt={tournament.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <img 
            src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Post.jpg?v=1767875878"
            alt={tournament.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/85" />
      </div>

      {/* Top Left - Registration Closed Chip & Timer */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        {isRegistrationClosed && (
          <div className="px-3 py-1.5 border border-gaming-gold/60 rounded-full text-xs font-display font-bold text-gaming-gold">
            REGISTRATION CLOSED
          </div>
        )}
        
        {/* Timer - Show if tournament hasn't started yet */}
        {tournament?.startDate && new Date(tournament.startDate) > new Date() && (
          <div className="px-3 py-1.5 backdrop-blur-md border border-blue-200/50 rounded-full text-xs font-display font-bold text-white">
            <CountdownTimer 
              targetDate={tournament.startDate}
              format="compact"
              size="sm"
              showLabels={false}
              className="text-white"
            />
          </div>
        )}
      </div>

      {/* Content Container */}
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        {/* Top Section - Status Badge */}
        {!isRegistrationClosed && (
          <div className="flex justify-end">
            <div className={`px-2.5 py-1 rounded-full text-xs font-display font-bold ${getStatusColor(tournament.status)}`}>
              {tournament.status === 'completed' ? 'FINISHED' : tournament.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        )}

        {/* Middle Section - Tournament Name */}
        <div className="flex flex-col items-center justify-center text-center mt-8">
          {/* <h3 className="text-white font-display text-xl font-bold mb-2 line-clamp-2 drop-shadow-lg tracking-wide">
            {tournament.name}
          </h3>
          <div className="text-gaming-gold font-display text-xs font-bold tracking-widest opacity-80">
            {tournament.mode?.toUpperCase() || 'SQUAD'}
          </div> */}
        </div>

        {/* Bottom Section - Info Bar */}
        <div className="space-y-2.5">
          {/* Prize Pool & Entry Fee Row */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-gaming-gold font-display font-bold">PRIZE:</span>
              <span className="text-white font-display font-bold">₹{(tournament.prizePool / 1000).toFixed(0)}K</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-gaming-gold font-display font-bold">ENTRY:</span>
              <span className="text-white font-display font-bold">₹{tournament.entryFee}</span>
            </div>
          </div>

          {/* Players & Registration Row */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="text-gaming-gold font-display font-bold">PLAYERS:</span>
              <span className="text-white font-display font-bold">{tournament.currentParticipants}/{tournament.maxParticipants}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-gaming-gold font-display font-bold">REG:</span>
              <span className="text-gaming-neon font-display font-bold">{Math.round((tournament.currentParticipants / tournament.maxParticipants) * 100)}%</span>
            </div>
          </div>

          {/* Divider Line */}
          <div className="h-px bg-gradient-to-r from-gaming-gold/20 via-gaming-gold/40 to-gaming-gold/20" />

          {/* Dates Row */}
          <div className="flex justify-between items-center text-xs">
            <div>
              <div className="text-gaming-gold font-display font-bold text-xs">REG DEADLINE</div>
              <div className="text-white font-display text-xs">{formatDate(tournament.registrationDeadline).split(',')[0]}</div>
            </div>
            <div className="text-right">
              <div className="text-gaming-gold font-display font-bold text-xs">STARTS</div>
              <div className="text-white font-display text-xs">{formatDate(tournament.startDate).split(',')[0]}</div>
            </div>
          </div>

          {/* View Details Button - Glassy Effect */}
          <button
            onClick={() => navigate(`/tournaments/${tournament._id}`)}
            className="w-full py-2 px-3 mt-2 bg-white/10 backdrop-blur-md border border-white/20 hover:border-gaming-gold/60 hover:bg-white/20 text-white font-display font-bold text-xs rounded-lg transition-all duration-300 shadow-lg hover:shadow-gaming-gold/40"
          >
            VIEW DETAILS →
          </button>
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.tournament._id === nextProps.tournament._id &&
         prevProps.tournament.currentParticipants === nextProps.tournament.currentParticipants &&
         prevProps.tournament.status === nextProps.tournament.status;
});

export default BGMIPage;
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageBannerSlider from '../components/common/PageBannerSlider';
import BGMIRegistrationForm from '../components/bgmi/BGMIRegistrationForm';
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
        return 'upcoming,registration_open';
      case 'live':
        return 'active';
      case 'completed':
        return 'completed';
      default:
        return 'upcoming,registration_open';
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
        return '👤';
      case 'duo':
        return '👥';
      case 'squad':
        return '👨‍👩‍👧‍👦';
      default:
        return '🎮';
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
    
    // Show success message - no need to redirect since images are sent via WhatsApp
    console.log('✅ Registration successful:', registration);
    
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading BGMI tournaments...</p>
        </div>
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
              { key: 'upcoming', label: 'Upcoming', icon: '🔜' },
              { key: 'live', label: 'Live', icon: '🔴' },
              { key: 'completed', label: 'Completed', icon: '✅' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-gaming-neon text-gaming-dark'
                    : 'bg-gaming-charcoal text-gray-300 hover:bg-gaming-slate'
                }`}
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
                className="w-full px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors duration-200 font-gaming"
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
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
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
                className="btn-primary"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Tournaments Grid */}
        {!tournaments || tournaments.length === 0 ? (
          <div className="card-gaming p-8 text-center">
            <div className="text-gray-400 text-6xl mb-4">🎮</div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments?.map((tournament) => (
              <TournamentCard 
                key={tournament._id} 
                tournament={tournament}
                navigate={navigate}
                getModeIcon={getModeIcon}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
                onRegisterClick={handleRegisterClick}
              />
            ))}
          </div>
        )}

        {/* Registration Form Modal */}
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
                  className="px-3 py-1 bg-gaming-charcoal border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-neon"
                >
                  Previous
                </button>
                
                <span className="px-3 py-1 bg-gaming-neon text-black rounded font-medium">
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
                  className="px-3 py-1 bg-gaming-charcoal border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-neon"
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
            <h3 className="text-lg font-bold text-white mb-4">🎮 BGMI Tournament Rules</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div>• Room ID and password will be shared 30 minutes before match</div>
              <div>• Screenshots required for result verification</div>
              <div>• No third-party apps or cheats allowed</div>
              <div>• Follow fair play guidelines</div>
              <div>• Disputes must be raised within 24 hours</div>
            </div>
          </div>

          <div className="card-gaming p-6">
            <h3 className="text-lg font-bold text-white mb-4">📱 How to Join BGMI Match</h3>
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card-gaming p-6 hover:border-gaming-neon/50 transition-all duration-300 group"
    >
      {/* Tournament Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{getModeIcon(tournament.mode)}</span>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tournament.status)}`}>
            {tournament.status === 'completed' ? 'FINISHED' : tournament.status.replace('_', ' ').toUpperCase()}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Entry Fee</div>
          <div className="text-lg font-bold text-gaming-neon">₹{tournament.entryFee}</div>
        </div>
      </div>

      {/* Tournament Info */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-gaming-neon transition-colors">
          {tournament.name}
        </h3>
        <p className="text-gray-400 text-sm line-clamp-2">
          {tournament.description}
        </p>
      </div>

      {/* Tournament Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-gaming-neon">₹{tournament.prizePool.toLocaleString()}</div>
          <div className="text-xs text-gray-400">Prize Pool</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-white">
            {tournament.currentParticipants}/{tournament.maxParticipants}
          </div>
          <div className="text-xs text-gray-400">Players</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Registration</span>
          <span>{Math.round((tournament.currentParticipants / tournament.maxParticipants) * 100)}%</span>
        </div>
        <div className="w-full bg-gaming-charcoal rounded-full h-2">
          <div
            className="bg-gaming-neon h-2 rounded-full transition-all duration-300"
            style={{ width: `${(tournament.currentParticipants / tournament.maxParticipants) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Tournament Dates */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Registration:</span>
          <span className="text-white">{formatDate(tournament.registrationDeadline)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Starts:</span>
          <span className="text-white">{formatDate(tournament.startDate)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={() => navigate(`/tournaments/${tournament._id}`)}
          className="flex-1 btn-primary text-sm"
        >
          View Details
        </button>
        {tournament.status === 'registration_open' && (
          <button
            onClick={() => onRegisterClick(tournament)}
            className="flex-1 btn-gaming text-sm"
          >
            Register Now
          </button>
        )}
        {tournament.status === 'active' && (
          <button
            onClick={() => navigate(`/tournaments/${tournament._id}/live`)}
            className="flex-1 btn-gaming text-sm bg-red-600 hover:bg-red-700"
          >
            🔴 Live
          </button>
        )}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if tournament data actually changed
  return prevProps.tournament._id === nextProps.tournament._id &&
         prevProps.tournament.currentParticipants === nextProps.tournament.currentParticipants &&
         prevProps.tournament.status === nextProps.tournament.status;
});

export default BGMIPage;
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  fetchTournaments,
  selectTournaments,
  selectTournamentLoading,
  selectTournamentError,
  selectTournamentPagination,
  clearError
} from '../store/slices/tournamentSlice';
import { selectAuth } from '../store/slices/authSlice';

const CS2Page = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const tournaments = useSelector(selectTournaments) || [];
  const loading = useSelector(selectTournamentLoading);
  const error = useSelector(selectTournamentError);
  const pagination = useSelector(selectTournamentPagination);

  const [activeTab, setActiveTab] = useState('upcoming');
  const [showSteamModal, setShowSteamModal] = useState(false);
  const [steamCheckResult, setSteamCheckResult] = useState(null);
  const [filters, setFilters] = useState({
    entryFeeMin: '',
    entryFeeMax: '',
    prizePoolMin: '',
    region: ''
  });

  useEffect(() => {
    // Fetch CS2 tournaments based on active tab
    const status = getStatusFromTab(activeTab);
    dispatch(fetchTournaments({
      gameType: 'cs2',
      status,
      ...filters,
      page: 1,
      limit: 12
    }));
  }, [dispatch, activeTab, filters]);

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
      region: ''
    });
  };

  const checkSteamIntegration = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check if user has Steam ID
    if (!user?.gameIds?.steam) {
      setShowSteamModal(true);
      setSteamCheckResult({
        hasSteam: false,
        message: 'Steam ID not found in your profile'
      });
      return;
    }

    // Mock Steam validation (in real app, call API)
    try {
      setSteamCheckResult({
        hasSteam: true,
        steamId: user.gameIds.steam,
        ownsCS2: true,
        message: 'Steam integration verified!'
      });
    } catch (error) {
      setSteamCheckResult({
        hasSteam: false,
        message: 'Failed to verify Steam integration'
      });
    }
  };

  const handleJoinTournament = (tournament) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check Steam integration before joining CS2 tournament
    if (!user?.gameIds?.steam) {
      setShowSteamModal(true);
      setSteamCheckResult({
        hasSteam: false,
        message: 'Steam ID required for CS2 tournaments',
        tournament: tournament
      });
      return;
    }

    // Proceed to tournament details
    navigate(`/tournaments/${tournament._id}`);
  };

  const handleSteamConnect = () => {
    // In real app, this would redirect to Steam OAuth
    window.open('https://steamcommunity.com/openid/login', '_blank');
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

  if (loading.tournaments) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading CS2 tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-gaming-dark via-gaming-charcoal to-gaming-dark py-16">
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="text-6xl mb-4">⚡</div>
            <h1 className="text-4xl md:text-6xl font-gaming font-bold text-white">
              Counter-Strike 2 Tournaments
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Professional CS2 tournaments with dedicated servers and Steam integration
            </p>
            
            {/* Steam Integration Status */}
            <div className="flex justify-center mt-8">
              {isAuthenticated && user?.gameIds?.steam ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center space-x-3">
                  <div className="text-green-400 text-2xl">✅</div>
                  <div>
                    <div className="text-green-400 font-bold">Steam Connected</div>
                    <div className="text-gray-300 text-sm">Steam ID: {user.gameIds.steam}</div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center space-x-3">
                  <div className="text-yellow-400 text-2xl">⚠️</div>
                  <div>
                    <div className="text-yellow-400 font-bold">Steam Required</div>
                    <div className="text-gray-300 text-sm">Connect Steam to join CS2 tournaments</div>
                  </div>
                  <button
                    onClick={() => setShowSteamModal(true)}
                    className="btn-gaming text-sm"
                  >
                    Connect Steam
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-gaming-neon">{tournaments?.length || 0}</div>
                <div className="text-sm text-gray-300">Active Tournaments</div>
              </div>
              <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-gaming-neon">₹100K+</div>
                <div className="text-sm text-gray-300">Total Prize Pool</div>
              </div>
              <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded-lg p-4">
                <div className="text-2xl font-bold text-gaming-neon">500+</div>
                <div className="text-sm text-gray-300">Players</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

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
                Region
              </label>
              <select
                value={filters.region}
                onChange={(e) => handleFilterChange('region', e.target.value)}
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              >
                <option value="">All Regions</option>
                <option value="mumbai">Mumbai</option>
                <option value="delhi">Delhi</option>
                <option value="bangalore">Bangalore</option>
                <option value="singapore">Singapore</option>
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
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
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
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error.tournaments && (
          <div className="card-gaming p-6 mb-6">
            <div className="text-center">
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Error Loading Tournaments</h3>
              <p className="text-gray-300 mb-4">{error.tournaments.message}</p>
              <button
                onClick={() => {
                  dispatch(clearError());
                  dispatch(fetchTournaments({
                    gameType: 'cs2',
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
            <div className="text-gray-400 text-6xl mb-4">⚡</div>
            <h2 className="text-xl font-bold text-white mb-2">No CS2 Tournaments Found</h2>
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
            {tournaments?.map((tournament, index) => (
              <motion.div
                key={tournament._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="card-gaming p-6 hover:border-gaming-neon/50 transition-all duration-300 group"
              >
                {/* Tournament Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">⚡</span>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(tournament.status)}`}>
                      {tournament.status.replace('_', ' ').toUpperCase()}
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
                    <div className="text-xl font-bold text-gaming-neon">₹{tournament.prizePool?.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Prize Pool</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">
                      {tournament.currentParticipants}/{tournament.maxParticipants}
                    </div>
                    <div className="text-xs text-gray-400">Teams</div>
                  </div>
                </div>

                {/* Steam Requirement Notice */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-400">🎮</span>
                    <span className="text-blue-400 text-sm font-medium">Steam Required</span>
                  </div>
                  <div className="text-gray-300 text-xs mt-1">
                    Valid Steam account with CS2 needed
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
                      onClick={() => handleJoinTournament(tournament)}
                      className="flex-1 btn-gaming text-sm"
                    >
                      Join Tournament
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* CS2 Specific Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="card-gaming p-6">
            <h3 className="text-lg font-bold text-white mb-4">⚡ CS2 Tournament Features</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div>• Dedicated 128-tick servers</div>
              <div>• Professional match configurations</div>
              <div>• Automatic demo recording</div>
              <div>• Anti-cheat integration</div>
              <div>• Server-side result verification</div>
            </div>
          </div>

          <div className="card-gaming p-6">
            <h3 className="text-lg font-bold text-white mb-4">🎮 Steam Integration</h3>
            <div className="space-y-2 text-sm text-gray-300">
              <div>1. Connect your Steam account</div>
              <div>2. Verify CS2 ownership</div>
              <div>3. Join tournament servers via Steam</div>
              <div>4. Automatic match result tracking</div>
              <div>5. Steam profile verification</div>
            </div>
          </div>
        </div>
      </div>

      {/* Steam Integration Modal */}
      {showSteamModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gaming-charcoal rounded-lg p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-bold text-white mb-4">Steam Integration Required</h3>
            
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-blue-400 text-2xl">🎮</span>
                  <div>
                    <div className="text-blue-400 font-bold">Steam Account Required</div>
                    <div className="text-gray-300 text-sm">CS2 tournaments require Steam integration</div>
                  </div>
                </div>
                
                {steamCheckResult && (
                  <div className="mt-3 p-3 bg-black/30 rounded">
                    <div className="text-sm text-gray-300">{steamCheckResult.message}</div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="text-sm text-gray-300">
                  To join CS2 tournaments, you need:
                </div>
                <ul className="text-sm text-gray-300 space-y-1 ml-4">
                  <li>• Valid Steam account</li>
                  <li>• Counter-Strike 2 ownership</li>
                  <li>• Steam profile linked to your account</li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowSteamModal(false)}
                  className="flex-1 px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSteamConnect}
                  className="flex-1 btn-gaming"
                >
                  Connect Steam
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CS2Page;
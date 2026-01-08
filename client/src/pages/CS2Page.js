import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { FiSettings } from 'react-icons/fi';
import { motion } from 'framer-motion';
import GameIcon from '../components/common/GameIcon';
import LoadingSpinner from '../components/common/LoadingSpinner';
import TournamentCardProfessional from '../components/tournaments/TournamentCardProfessional';
import {
  fetchTournaments,
  selectTournaments,
  selectTournamentLoading,
  selectTournamentError,
  selectTournamentPagination,
  clearError
} from '../store/slices/tournamentSlice';
import { selectAuth } from '../store/slices/authSlice';
import SteamConnectionModal from '../components/steam/SteamConnectionModal';
import SteamLinkingModal from '../components/tournaments/SteamLinkingModal';
import CountdownTimer from '../components/common/CountdownTimer';
import api from '../services/api';
import { getSteamAuthUrl } from '../utils/apiConfig';
import { getServerStatusBadge, getServerStats } from '../utils/cs2ServerStatus';

const CS2Page = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const tournaments = useSelector((state) => state.tournaments?.tournaments || []);
  const loading = useSelector((state) => state.tournaments?.loading || false);
  const error = useSelector((state) => state.tournaments?.error || null);
  const pagination = useSelector((state) => state.tournaments?.pagination || {});

  const [activeTab, setActiveTab] = useState('upcoming');
  const [showSteamModal, setShowSteamModal] = useState(false);
  const [steamCheckResult, setSteamCheckResult] = useState(null);
  const [serverStatuses, setServerStatuses] = useState({});
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

  // Fetch server statuses for all tournaments
  useEffect(() => {
    const fetchServerStatuses = async () => {
      if (!tournaments || tournaments.length === 0) return;

      const statuses = {};
      for (const tournament of tournaments) {
        if (tournament.gameType === 'cs2' && tournament.roomDetails?.cs2) {
          try {
            const badge = await getServerStatusBadge(tournament);
            const stats = await getServerStats(tournament);
            statuses[tournament._id] = { badge, stats };
          } catch (error) {
            console.error(`Failed to fetch status for tournament ${tournament._id}:`, error);
          }
        }
      }
      setServerStatuses(statuses);
    };

    fetchServerStatuses();
  }, [dispatch, activeTab, filters]);

  const getStatusFromTab = (tab) => {
    switch (tab) {
      case 'upcoming':
        return 'active'; // CS2 servers are always active
      case 'live':
        return 'active'; // CS2 servers are always active
      case 'completed':
        return 'completed'; // Keep completed for historical data
      default:
        return 'active'; // Default to active for CS2
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
        return 'text-gray-400 bg-gray-400/10';
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

  // Set CS2 image URL
  const cs2ImageUrl = 'https://gameplayscassi.com.br/wp-content/smush-webp/2023/03/Rumores-indicam-que-a-beta-do-Counter-Strike-2-pode-ser-lancada-em-1o-de-abril..jpg.webp';

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

  const [selectedTournament, setSelectedTournament] = useState(null);

  const openSteamAndConnect = (tournament) => {
    setSelectedTournament(tournament);
    setShowSteamModal(true);
  };

  const handleSteamLink = () => {
    const userId = user?.id || user?._id;
    
    if (!userId) {
      alert('Please login again to continue');
      navigate('/login');
      return;
    }

    setShowSteamModal(false);
    
    // Direct redirect to Steam OAuth - uses dynamic URL
    window.location.href = getSteamAuthUrl(userId, `/tournaments/${selectedTournament?._id}`);
  };

  const handleJoinTournament = async (tournament) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Check Steam integration before joining CS2 tournament
    try {
      const steamStatus = await api.get('/api/steam/status');

      if (!steamStatus.isConnected) {
        // Directly open Steam instead of showing modal
        openSteamAndConnect(tournament);
        return;
      }

      // Check CS2 eligibility
      const eligibility = await api.get('/api/steam/cs2/eligibility');

      if (!eligibility.eligible) {
        setShowSteamModal(true);
        setSteamCheckResult({
          hasSteam: true,
          eligible: false,
          reason: eligibility.reason,
          requirements: eligibility.requirements,
          tournament: tournament
        });
        return;
      }

      // All checks passed, proceed to tournament registration
      navigate(`/tournaments/${tournament._id}`);

    } catch (error) {
      console.error('Error checking Steam status:', error);
      setShowSteamModal(true);
      setSteamCheckResult({
        hasSteam: false,
        message: 'Unable to verify Steam connection. Please try again.',
        tournament: tournament
      });
    }
  };

  const handleSteamConnect = () => {
    // In real app, this would redirect to Steam OAuth
    window.open('https://steamcommunity.com/openid/login', '_blank');
  };

  const handleSteamSuccess = (steamData) => {
    setSteamCheckResult(steamData);
    setShowSteamModal(false);

    // If there was a tournament they were trying to join, redirect to it
    if (steamCheckResult?.tournament && steamData.eligible) {
      navigate(`/tournaments/${steamCheckResult.tournament._id}`);
    }
  };

  if (loading.tournaments) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading CS2 tournaments..." />
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
            <GameIcon gameType="cs2" size="2xl" />
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

            {/* CS2 Installation Notice */}
            <div className="flex justify-center mt-4">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 max-w-2xl">
                <div className="flex items-start space-x-3">
                  <div className="text-blue-400 text-2xl">
                    <GameIcon gameType="cs2" size="md" />
                  </div>
                  <div>
                    <div className="text-blue-400 font-bold mb-2">CS2 Installation Required</div>
                    <div className="text-gray-300 text-sm space-y-1">
                      <div>• Counter-Strike 2 is free on Steam</div>
                      <div>• Download size: ~30GB</div>
                      <div>• Requires Steam account</div>
                    </div>
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={() => window.open('https://store.steampowered.com/app/730/CounterStrike_2/', '_blank')}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded transition-colors"
                      >
                        Download CS2
                      </button>
                      <button
                        onClick={() => window.open('https://store.steampowered.com/about/', '_blank')}
                        className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded transition-colors"
                      >
                        Get Steam
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
        {/* Steam Connection Status */}
        {isAuthenticated && (
          <div className="card-gaming p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-3xl">
                  <GameIcon gameType="cs2" size="lg" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Steam Integration</h3>
                  <p className="text-gray-400 text-sm">Required for CS2 tournament participation</p>
                </div>
              </div>
              <Link
                to="/steam-settings"
                className="btn-gaming inline-flex items-center space-x-2"
              >
                <FiSettings className="h-4 w-4" />
                <span>Manage Steam</span>
              </Link>
            </div>
          </div>
        )}

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
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${activeTab === tab.key
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
        {error?.tournaments && (
          <div className="card-gaming p-6 mb-6">
            <div className="text-center">
              <div className="text-red-400 text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Error Loading Tournaments</h3>
              <p className="text-gray-300 mb-4">{error?.tournaments?.message || 'Failed to load tournaments'}</p>
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
            <div className="text-gray-400 text-6xl mb-4">
              <GameIcon gameType="cs2" size="2xl" />
            </div>
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
              <div key={tournament._id} className="w-11/12 mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <TournamentCardProfessional 
                    tournament={tournament}
                    getModeIcon={getModeIcon}
                    getStatusColor={getStatusColor}
                    formatDate={formatDate}
                    showTimer={false}
                    gameType="cs2"
                    cs2ImageUrl={cs2ImageUrl}
                    hideBottomInfo={true}
                  />
                </motion.div>
              </div>
            ))}
          </div>
        )}

          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {[
              { icon: <GameIcon gameType="cs2" size="sm" />, title: 'CS2 Tournament Features', desc: 'Professional match configurations' },
              { icon: <GameIcon gameType="cs2" size="sm" />, title: 'Steam Integration', desc: 'Automatic match result tracking' }
            ].map((item, idx) => (
              <div key={item.title} className="card-gaming p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                  {item.icon}
                  <span>{item.title}</span>
                </h3>
                <div className="space-y-2 text-sm text-gray-300">
                  {idx === 0 ? (
                    <>
                      <div>• Dedicated 128-tick servers</div>
                      <div>• Professional match configurations</div>
                      <div>• Automatic demo recording</div>
                      <div>• Anti-cheat integration</div>
                      <div>• Server-side result verification</div>
                    </>
                  ) : (
                    <>
                      <div>1. Connect your Steam account</div>
                      <div>2. Verify CS2 ownership</div>
                      <div>3. Join tournament servers via Steam</div>
                      <div>4. Automatic match result tracking</div>
                      <div>5. Steam profile verification</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
      </div>

      {/* Steam Linking Modal */}
      <SteamLinkingModal
        isOpen={showSteamModal}
        onClose={() => setShowSteamModal(false)}
        onConfirm={handleSteamLink}
        tournamentName={selectedTournament?.name || 'this tournament'}
      />

      {/* Steam Integration Modal (for eligibility check) */}
      <SteamConnectionModal
        isOpen={steamCheckResult !== null}
        onClose={() => setSteamCheckResult(null)}
        onSuccess={handleSteamSuccess}
        gameType="cs2"
      />
    </div>
  );
};

export default CS2Page;
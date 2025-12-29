import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import axios from 'axios';
import { FaCrosshairs, FaSkull, FaHandsHelping, FaFire, FaStar, FaTrophy } from 'react-icons/fa';
import {
  fetchLeaderboard,
  fetchMyPosition,
  fetchTopPerformers,
  clearLeaderboardError,
  selectLeaderboard,
  selectUserPosition,
  selectTopPerformers,
  selectLeaderboardLoading,
  selectLeaderboardError,
  selectLeaderboardPagination
} from '../store/slices/leaderboardSlice';
import { selectAuth } from '../store/slices/authSlice';
import GameIcon from '../components/common/GameIcon';

const LeaderboardPage = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const leaderboard = useSelector(selectLeaderboard);
  const userPosition = useSelector(selectUserPosition);
  const topPerformers = useSelector(selectTopPerformers);
  const loading = useSelector(selectLeaderboardLoading);
  const error = useSelector(selectLeaderboardError);
  const pagination = useSelector(selectLeaderboardPagination);

  const [activeTab, setActiveTab] = useState('overall');
  const [selectedGame, setSelectedGame] = useState('bgmi');
  
  // CS2 specific state
  const [cs2Leaderboard, setCs2Leaderboard] = useState([]);
  const [cs2Stats, setCs2Stats] = useState(null);
  const [cs2Loading, setCs2Loading] = useState(false);
  
  // BGMI specific state
  const [bgmiScoreboards, setBgmiScoreboards] = useState([]);
  const [bgmiLoading, setBgmiLoading] = useState(false);

  useEffect(() => {
    if (selectedGame === 'cs2') {
      // Fetch CS2 leaderboard data
      fetchCS2Leaderboard();
    } else if (selectedGame === 'bgmi') {
      // Fetch BGMI scoreboards instead of regular leaderboard
      fetchBgmiScoreboards();
    } else {
      // Fetch regular leaderboard data for other games
      dispatch(fetchLeaderboard({
        gameType: selectedGame,
        leaderboardType: activeTab,
        page: 1,
        limit: 50
      }));

      // Fetch user position if authenticated
      if (isAuthenticated) {
        dispatch(fetchMyPosition({
          gameType: selectedGame,
          leaderboardType: activeTab
        }));
      }

      // Fetch top performers
      dispatch(fetchTopPerformers({
        gameType: selectedGame,
        limit: 10
      }));
    }
  }, [dispatch, selectedGame, activeTab, isAuthenticated]);

  const fetchBgmiScoreboards = async () => {
    try {
      setBgmiLoading(true);
      
      // Direct fetch without axios to avoid rate limiting
      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_URL}/api/tournaments/bgmi/scoreboards`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data.scoreboards) {
        setBgmiScoreboards(data.data.scoreboards);
      } else {
        setBgmiScoreboards([]);
      }
    } catch (err) {
      console.error('❌ Error fetching BGMI scoreboards:', err);
      setBgmiScoreboards([]);
    } finally {
      setBgmiLoading(false);
    }
  };

  const fetchCS2Leaderboard = async () => {
    try {
      setCs2Loading(true);
      
      // Fetch ALL players leaderboard (only registered)
      const leaderboardRes = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/cs2-leaderboard/all-players?limit=50`
      );
      
      // Fetch overall stats
      const statsRes = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/cs2-leaderboard/all-stats`
      );
      
      if (leaderboardRes.data.success) {
        setCs2Leaderboard(leaderboardRes.data.leaderboard);
      }
      
      if (statsRes.data.success) {
        setCs2Stats(statsRes.data.stats);
      }
    } catch (err) {
      console.error('❌ Error fetching CS2 leaderboard:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
    } finally {
      setCs2Loading(false);
    }
  };

  const handleGameChange = (game) => {
    setSelectedGame(game);
    dispatch(clearLeaderboardError());
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    dispatch(clearLeaderboardError());
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= pagination.pages) {
      dispatch(fetchLeaderboard({
        gameType: selectedGame,
        leaderboardType: activeTab,
        page,
        limit: 50
      }));
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getGameIcon = (game) => {
    return <GameIcon gameType={game} size="sm" style="cdn" />;
  };

  if (loading.leaderboard || cs2Loading) {
    return (
      <div className="min-h-screen bg-theme-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-accent mx-auto mb-4"></div>
          <p className="text-theme-text-secondary">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error.leaderboard) {
    return (
      <div className="min-h-screen bg-theme-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️ Error loading leaderboard</div>
          <p className="text-theme-text-secondary mb-4">
            {typeof error.leaderboard === 'string' 
              ? error.leaderboard 
              : error.leaderboard?.message 
              || 'Failed to load leaderboard data'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-theme-accent hover:bg-theme-accent-hover text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg-primary py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-gaming font-bold text-theme-text-primary mb-4">
            🏆 Leaderboard
          </h1>
          <p className="text-xl text-theme-text-secondary max-w-2xl mx-auto">
            Compete with the best players and climb the rankings
          </p>
        </motion.div>

        {/* Game Selection */}
        <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6 mb-6">
          <h2 className="text-xl font-bold text-theme-text-primary mb-4">Select Game</h2>
          <div className="flex flex-wrap gap-4">
            {['bgmi', 'cs2'].map((game) => (
              <button
                key={game}
                onClick={() => handleGameChange(game)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  selectedGame === game
                    ? 'bg-theme-accent text-white'
                    : 'bg-theme-bg-hover text-theme-text-secondary hover:bg-theme-bg-hover'
                }`}
              >
                <span className="text-lg">{getGameIcon(game)}</span>
                <span className="uppercase">{game}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CS2 Stats Cards */}
        {selectedGame === 'cs2' && cs2Stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                  <FaFire className="text-white text-xl" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-theme-text-primary">{cs2Stats.total_matches}</div>
                  <div className="text-sm text-theme-text-muted">Total Matches</div>
                </div>
              </div>
            </div>
            
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                  <FaCrosshairs className="text-white text-xl" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-theme-text-primary">{cs2Stats.total_kills}</div>
                  <div className="text-sm text-theme-text-muted">Total Kills</div>
                </div>
              </div>
            </div>
            
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <FaStar className="text-white text-xl" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-theme-text-primary">{cs2Stats.unique_players}</div>
                  <div className="text-sm text-theme-text-muted">Active Players</div>
                </div>
              </div>
            </div>
            
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <FaTrophy className="text-white text-xl" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-theme-text-primary">{cs2Stats.total_rounds}</div>
                  <div className="text-sm text-theme-text-muted">Rounds Played</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Type Tabs - Hide for CS2 and BGMI */}
        {selectedGame !== 'cs2' && selectedGame !== 'bgmi' && (
          <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6 mb-6">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'overall', label: 'Overall', icon: '🌟' },
                { key: 'weekly', label: 'Weekly', icon: '📅' },
                { key: 'monthly', label: 'Monthly', icon: '📊' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'bg-theme-accent text-white'
                      : 'bg-theme-bg-hover text-theme-text-secondary hover:bg-theme-bg-hover'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Leaderboard */}
          <div className="lg:col-span-3">
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6" key={selectedGame}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-theme-text-primary">
                  {selectedGame === 'cs2' 
                    ? '⚡ CS2 Player Rankings' 
                    : selectedGame === 'bgmi'
                    ? '🏆 BGMI Tournament Results'
                    : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Rankings`
                  }
                </h2>
                <div className="text-sm text-theme-text-secondary">
                  {selectedGame === 'cs2' 
                    ? `${cs2Leaderboard.length} players (${cs2Leaderboard.filter(p => p.isRegistered).length} registered)` 
                    : selectedGame === 'bgmi'
                    ? `${bgmiScoreboards.length} tournament results`
                    : `${pagination.total} players`
                  }
                </div>
              </div>

              {selectedGame === 'cs2' ? (
                // CS2 Leaderboard - ISOLATED SECTION
                <div className="cs2-section" style={{backgroundColor: '#1e3a8a20', border: '2px solid #3b82f6', padding: '20px', borderRadius: '10px'}}>
                  
                  {cs2Loading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
                      <p className="text-blue-400">Loading CS2 leaderboard...</p>
                    </div>
                  ) : cs2Leaderboard.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4"><FaTrophy className="inline-block text-theme-accent" /></div>
                      <h3 className="text-xl font-bold text-theme-text-primary mb-2">No CS2 Players Found</h3>
                      <p className="text-theme-text-secondary mb-4">
                        Connect your Steam account and play CS2 matches to appear on the leaderboard!
                      </p>
                      {cs2Stats && (
                        <div className="mt-6 text-sm text-theme-text-muted">
                          <p>Total Matches: {cs2Stats.total_matches} | Total Kills: {cs2Stats.total_kills}</p>
                        </div>
                      )}
                      {/* Debug button for testing */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fetchCS2Leaderboard();
                        }}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        🔄 Refresh CS2 Data
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-theme-bg-hover">
                          <tr>
                            <th className="px-4 py-3 text-left text-theme-text-secondary text-sm font-semibold">Rank</th>
                          <th className="px-4 py-3 text-left text-theme-text-secondary text-sm font-semibold">Player</th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">
                            <FaCrosshairs className="inline mr-1" /> Kills
                          </th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">
                            <FaSkull className="inline mr-1" /> Deaths
                          </th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">
                            <FaHandsHelping className="inline mr-1" /> Assists
                          </th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">K/D</th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">
                            <FaFire className="inline mr-1" /> Damage
                          </th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">
                            <FaStar className="inline mr-1" /> MVP
                          </th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">Rounds</th>
                          <th className="px-4 py-3 text-center text-theme-text-secondary text-sm font-semibold">Matches</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cs2Leaderboard
                          .map((player, index) => (
                          <motion.tr
                            key={player.accountid}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`border-b border-theme-border hover:bg-theme-bg-hover transition-colors ${
                              player.rank <= 3 ? 'bg-gradient-to-r from-theme-accent/10 to-transparent' : ''
                            }`}
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-2">
                                <span className={`text-lg font-bold ${
                                  player.rank === 1 ? 'text-yellow-400' :
                                  player.rank === 2 ? 'text-gray-300' :
                                  player.rank === 3 ? 'text-orange-400' :
                                  'text-theme-text-primary'
                                }`}>
                                  #{player.rank}
                                </span>
                                {player.rank <= 3 && (
                                  <FaTrophy className={
                                    player.rank === 1 ? 'text-yellow-400' :
                                    player.rank === 2 ? 'text-gray-300' :
                                    'text-orange-400'
                                  } />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center space-x-3">
                                {player.avatar ? (
                                  <img
                                    src={player.avatar}
                                    alt={player.username}
                                    className="w-10 h-10 rounded-full border-2 border-theme-accent"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full border-2 border-theme-accent bg-theme-bg-hover flex items-center justify-center">
                                    <span className="text-theme-accent font-bold text-sm">
                                      {player.displayName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <div className="text-theme-text-primary font-semibold">
                                    {player.displayName}
                                    {!player.isRegistered && (
                                      <span className="ml-2 text-xs text-yellow-400">(Unregistered)</span>
                                    )}
                                  </div>
                                  <div className="text-theme-text-muted text-sm">
                                    Account ID: {player.accountid}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-green-400 font-bold">{player.stats.total_kills}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-red-400 font-bold">{player.stats.total_deaths}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-blue-400 font-bold">{player.stats.total_assists}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`font-bold ${
                                player.stats.kdr >= 1.5 ? 'text-green-400' :
                                player.stats.kdr >= 1 ? 'text-yellow-400' :
                                'text-red-400'
                              }`}>
                                {player.stats.kdr.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-yellow-400 font-bold">
                                {player.stats.total_damage.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-purple-400 font-bold">{player.stats.total_mvp}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-theme-text-secondary font-semibold">
                                {player.stats.rounds_played}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-theme-text-primary font-semibold">
                                {player.stats.matches_played}
                              </span>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )
                }
                </div>
              ) : selectedGame === 'bgmi' ? (
                // BGMI Tournament Results Gallery - ISOLATED SECTION
                <div className="bgmi-section" style={{backgroundColor: '#ea580c20', border: '2px solid #f97316', padding: '20px', borderRadius: '10px'}}>
                  
                  {bgmiScoreboards.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🏆</div>
                    <h3 className="text-xl font-bold text-theme-text-primary mb-2">No Tournament Results Yet</h3>
                    <p className="text-theme-text-secondary mb-4">
                      Tournament results will appear here after competitions are completed.
                    </p>
                    <button
                      onClick={() => window.location.href = '/tournaments'}
                      className="px-6 py-3 bg-theme-accent text-white font-bold rounded-lg hover:bg-theme-accent/80 transition-colors"
                    >
                      Browse Tournaments
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bgmiScoreboards.map((scoreboard, index) => (
                      <motion.div
                        key={scoreboard._id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-theme-bg-hover rounded-lg overflow-hidden border border-theme-border hover:border-theme-accent/50 transition-all group cursor-pointer"
                      >
                        <div className="flex flex-col md:flex-row">
                          {/* Image Section */}
                          <div className="md:w-1/3">
                            <img
                              src={scoreboard.imageUrl}
                              alt={scoreboard.description}
                              className="w-full h-48 md:h-32 object-cover group-hover:opacity-80 transition-opacity cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(scoreboard.imageUrl, '_blank');
                              }}
                            />
                          </div>
                          
                          {/* Details Section */}
                          <div className="flex-1 p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex-1">
                                <h4 className="text-lg font-bold text-theme-text-primary mb-1 group-hover:text-theme-accent transition-colors">
                                  {scoreboard.tournament.name}
                                </h4>
                                <p className="text-sm text-theme-text-secondary mb-2">
                                  {scoreboard.description}
                                </p>
                                
                                <div className="flex flex-wrap items-center gap-4 text-xs text-theme-text-muted">
                                  <div className="flex items-center space-x-1">
                                    <GameIcon gameType="bgmi" size="sm" />
                                    <span className="uppercase font-medium">BGMI</span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <FaTrophy className="text-theme-accent" />
                                    <span>
                                      Ended: {new Date(scoreboard.tournament.endDate).toLocaleDateString()}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1">
                                    <span>📅</span>
                                    <span>
                                      Uploaded: {new Date(scoreboard.uploadedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-3 sm:mt-0 sm:ml-4 flex flex-col items-end">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                  scoreboard.tournament.status === 'completed' 
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                }`}>
                                  {scoreboard.tournament.status === 'completed' ? '✅ Completed' : '🔄 Active'}
                                </span>
                                
                                <div className="mt-2 text-xs text-theme-text-muted">
                                  #{index + 1}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        

                      </motion.div>
                    ))}
                  </div>
                  )}
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏆</div>
                  <h3 className="text-xl font-bold text-theme-text-primary mb-2">No Rankings Yet</h3>
                  <p className="text-theme-text-secondary">
                    Be the first to compete and claim your spot on the leaderboard!
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <div className="space-y-2">
                      {leaderboard.map((entry, index) => (
                        <motion.div
                          key={entry._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex items-center justify-between p-4 rounded-lg transition-all duration-200 ${
                            entry.rank <= 3
                              ? 'bg-gradient-to-r from-theme-accent/10 to-transparent border border-theme-accent/30'
                              : 'bg-theme-bg-hover hover:bg-theme-bg-hover'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="text-2xl font-bold">
                              {getRankIcon(entry.rank)}
                            </div>
                            <div className="w-10 h-10 bg-theme-accent/20 rounded-full flex items-center justify-center">
                              <span className="text-theme-accent font-bold">
                                {entry.userId?.username?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <div className="text-theme-text-primary font-bold">
                                {entry.userId?.username || 'Unknown User'}
                              </div>
                              <div className="text-theme-text-muted text-sm">
                                Level {entry.userId?.level || 1}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 text-sm">
                            <div className="text-center">
                              <div className="text-theme-accent font-bold">
                                {entry.points}
                              </div>
                              <div className="text-theme-text-muted">Points</div>
                            </div>
                            <div className="text-center">
                              <div className="text-green-400 font-bold">
                                {entry.wins}
                              </div>
                              <div className="text-theme-text-muted">Wins</div>
                            </div>
                            <div className="text-center">
                              <div className="text-theme-text-primary font-bold">
                                {entry.totalMatches}
                              </div>
                              <div className="text-theme-text-muted">Matches</div>
                            </div>
                            <div className="text-center">
                              <div className="text-theme-accent font-bold">
                                {entry.totalMatches > 0 ? Math.round((entry.wins / entry.totalMatches) * 100) : 0}%
                              </div>
                              <div className="text-theme-text-muted">Win Rate</div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden">
                    <div className="space-y-4">
                      {leaderboard.map((entry, index) => (
                        <motion.div
                          key={entry._id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`p-4 rounded-lg transition-all duration-200 ${
                            entry.rank <= 3
                              ? 'bg-gradient-to-r from-theme-accent/10 to-transparent border border-theme-accent/30'
                              : 'bg-theme-bg-hover'
                          }`}
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="text-xl font-bold">
                              {getRankIcon(entry.rank)}
                            </div>
                            <div className="w-10 h-10 bg-theme-accent/20 rounded-full flex items-center justify-center">
                              <span className="text-theme-accent font-bold">
                                {entry.userId?.username?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="text-theme-text-primary font-bold">
                                {entry.userId?.username || 'Unknown User'}
                              </div>
                              <div className="text-theme-text-muted text-sm">
                                Level {entry.userId?.level || 1}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-theme-text-muted">Points:</span>
                              <span className="text-theme-accent font-bold">{entry.points}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-text-muted">Wins:</span>
                              <span className="text-green-400 font-bold">{entry.wins}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-text-muted">Matches:</span>
                              <span className="text-theme-text-primary font-bold">{entry.totalMatches}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-text-muted">Win Rate:</span>
                              <span className="text-theme-accent font-bold">
                                {entry.totalMatches > 0 ? Math.round((entry.wins / entry.totalMatches) * 100) : 0}%
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-theme-border">
                      <div className="text-theme-text-secondary text-sm">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page === 1}
                          className="px-3 py-1 bg-theme-bg-hover text-theme-text-secondary rounded disabled:opacity-50 hover:bg-theme-bg-hover transition-colors"
                        >
                          Previous
                        </button>
                        
                        <div className="flex space-x-1">
                          {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                            const page = i + 1;
                            return (
                              <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`px-3 py-1 rounded transition-colors ${
                                  pagination.page === page
                                    ? 'bg-theme-accent text-white'
                                    : 'bg-theme-bg-hover text-theme-text-secondary hover:bg-theme-bg-hover'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page === pagination.pages}
                          className="px-3 py-1 bg-theme-bg-hover text-theme-text-secondary rounded disabled:opacity-50 hover:bg-theme-bg-hover transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* User Position */}
            {isAuthenticated && selectedGame === 'cs2' && cs2Leaderboard.length > 0 && (
              <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6">
                <h3 className="text-lg font-bold text-theme-text-primary mb-4">🎯 Your CS2 Stats</h3>
                {(() => {
                  const myStats = cs2Leaderboard.find(p => p.isRegistered && p.userId === user?.id);
                  if (myStats) {
                    return (
                      <div className="text-center">
                        <div className="text-3xl font-bold text-theme-accent mb-2">
                          #{myStats.rank}
                        </div>
                        <div className="text-theme-text-secondary mb-4">
                          Your Rank
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center">
                            <div className="text-green-400 font-bold">
                              {myStats.stats.total_kills}
                            </div>
                            <div className="text-theme-text-muted">Kills</div>
                          </div>
                          <div className="text-center">
                            <div className="text-red-400 font-bold">
                              {myStats.stats.total_deaths}
                            </div>
                            <div className="text-theme-text-muted">Deaths</div>
                          </div>
                          <div className="text-center">
                            <div className="text-theme-accent font-bold">
                              {myStats.stats.kdr.toFixed(2)}
                            </div>
                            <div className="text-theme-text-muted">K/D</div>
                          </div>
                          <div className="text-center">
                            <div className="text-theme-text-primary font-bold">
                              {myStats.stats.matches_played}
                            </div>
                            <div className="text-theme-text-muted">Matches</div>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-center text-theme-text-muted text-sm">
                        <p>Play on our CS2 servers to see your stats!</p>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
            {isAuthenticated && selectedGame !== 'cs2' && userPosition && (
              <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6">
                <h3 className="text-lg font-bold text-theme-text-primary mb-4">🎯 Your Position</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-theme-accent mb-2">
                    #{userPosition.rank}
                  </div>
                  <div className="text-theme-text-secondary mb-4">
                    {userPosition.points} points
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-theme-text-primary font-bold">
                        {userPosition.wins}
                      </div>
                      <div className="text-theme-text-muted">Wins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-theme-text-primary font-bold">
                        {userPosition.totalMatches}
                      </div>
                      <div className="text-theme-text-muted">Matches</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Performers */}
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6">
              <h3 className="text-lg font-bold text-theme-text-primary mb-4">⭐ Top Performers</h3>
              <div className="space-y-3">
                {selectedGame === 'cs2' ? (
                  cs2Leaderboard.slice(0, 5).map((player) => (
                    <div key={player.accountid} className="flex items-center space-x-3">
                      <div className="text-lg">
                        {getRankIcon(player.rank)}
                      </div>
                      <img
                        src={player.avatar || '/default-avatar.png'}
                        alt={player.username}
                        className="w-8 h-8 rounded-full border-2 border-theme-accent"
                      />
                      <div className="flex-1">
                        <div className="text-theme-text-primary font-medium text-sm">
                          {player.displayName || player.username}
                        </div>
                        <div className="text-theme-text-muted text-xs">
                          {player.stats.total_kills} kills
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  topPerformers.slice(0, 5).map((performer) => (
                    <div key={performer.user?._id || Math.random()} className="flex items-center space-x-3">
                      <div className="text-lg">
                        {getRankIcon(performer.rank)}
                      </div>
                      <div className="w-8 h-8 bg-theme-accent/20 rounded-full flex items-center justify-center">
                        <span className="text-theme-accent font-bold text-sm">
                          {performer.user?.username?.charAt(0).toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-theme-text-primary font-medium text-sm">
                          {performer.user?.username || 'Unknown User'}
                        </div>
                        <div className="text-theme-text-muted text-xs">
                          {performer.points} pts
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6">
              <h3 className="text-lg font-bold text-theme-text-primary mb-4">📈 Quick Stats</h3>
              <div className="space-y-3 text-sm">
                {selectedGame === 'cs2' && cs2Stats ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Total Matches:</span>
                      <span className="text-theme-text-primary font-bold">{cs2Stats.total_matches}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Total Kills:</span>
                      <span className="text-green-400 font-bold">{cs2Stats.total_kills}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Total Deaths:</span>
                      <span className="text-red-400 font-bold">{cs2Stats.total_deaths}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Active Players:</span>
                      <span className="text-theme-accent font-bold">{cs2Stats.unique_players}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Total Rounds:</span>
                      <span className="text-theme-text-primary font-bold">{cs2Stats.total_rounds}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Maps Played:</span>
                      <span className="text-theme-text-primary font-bold">{cs2Stats.maps_played}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Total Players:</span>
                      <span className="text-theme-text-primary font-bold">{pagination.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Active Game:</span>
                      <span className="text-theme-accent font-bold uppercase">{selectedGame}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-theme-text-muted">Period:</span>
                      <span className="text-theme-text-primary font-bold capitalize">{activeTab}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
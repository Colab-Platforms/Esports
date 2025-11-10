import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  fetchLeaderboard,
  fetchMyPosition,
  fetchTopPerformers,
  setLeaderboardFilters,
  clearLeaderboardError,
  selectLeaderboard,
  selectUserPosition,
  selectTopPerformers,
  selectLeaderboardLoading,
  selectLeaderboardError,
  selectLeaderboardFilters,
  selectLeaderboardPagination
} from '../store/slices/leaderboardSlice';
import { selectAuth } from '../store/slices/authSlice';

const LeaderboardPage = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(selectAuth);
  const leaderboard = useSelector(selectLeaderboard);
  const userPosition = useSelector(selectUserPosition);
  const topPerformers = useSelector(selectTopPerformers);
  const loading = useSelector(selectLeaderboardLoading);
  const error = useSelector(selectLeaderboardError);
  // const filters = useSelector(selectLeaderboardFilters);
  const pagination = useSelector(selectLeaderboardPagination);

  const [activeTab, setActiveTab] = useState('overall');
  const [selectedGame, setSelectedGame] = useState('bgmi');

  useEffect(() => {
    // Fetch leaderboard data
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
      leaderboardType: activeTab,
      limit: 10
    }));
  }, [dispatch, selectedGame, activeTab, isAuthenticated]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    dispatch(setLeaderboardFilters({ leaderboardType: tab }));
  };

  const handleGameChange = (game) => {
    setSelectedGame(game);
    dispatch(setLeaderboardFilters({ gameType: game }));
  };

  const handlePageChange = (newPage) => {
    dispatch(fetchLeaderboard({
      gameType: selectedGame,
      leaderboardType: activeTab,
      page: newPage,
      limit: 50
    }));
  };

  const getGameIcon = (gameType) => {
    switch (gameType) {
      case 'bgmi':
        return '🎮';
      case 'valorant':
        return '🎯';
      case 'cs2':
        return '⚡';
      default:
        return '🎮';
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getRankChangeIcon = (rankChange) => {
    switch (rankChange) {
      case 'up':
        return <span className="text-green-400">↗️</span>;
      case 'down':
        return <span className="text-red-400">↘️</span>;
      case 'same':
        return <span className="text-gray-400">➡️</span>;
      case 'new':
        return <span className="text-blue-400">🆕</span>;
      default:
        return null;
    }
  };

  if (loading.leaderboard) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
          <p className="text-gray-300">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-gaming font-bold text-white mb-4">
            🏆 Leaderboard
          </h1>
          <p className="text-gray-400 text-lg">
            Compete with the best players and climb the ranks
          </p>
        </motion.div>

        {/* Game Selection */}
        <div className="card-gaming p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Select Game</h2>
          <div className="flex flex-wrap gap-4">
            {['bgmi', 'valorant', 'cs2'].map((game) => (
              <button
                key={game}
                onClick={() => handleGameChange(game)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${selectedGame === game
                  ? 'bg-gaming-neon text-gaming-dark'
                  : 'bg-gaming-charcoal text-gray-300 hover:bg-gaming-slate'
                  }`}
              >
                <span className="text-xl">{getGameIcon(game)}</span>
                <span className="uppercase">{game}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Type Tabs */}
        <div className="card-gaming p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'overall', label: 'Overall', icon: '🌟' },
              { key: 'monthly', label: 'Monthly', icon: '📅' },
              { key: 'weekly', label: 'Weekly', icon: '📊' }
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Leaderboard */}
          <div className="lg:col-span-3">
            <div className="card-gaming p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Rankings
                </h2>
                <div className="text-sm text-gray-400">
                  {pagination.total} players
                </div>
              </div>

              {error.leaderboard ? (
                <div className="text-center py-8">
                  <div className="text-red-400 text-6xl mb-4">⚠️</div>
                  <h3 className="text-xl font-bold text-white mb-2">Error Loading Leaderboard</h3>
                  <p className="text-gray-300 mb-4">{error.leaderboard.message}</p>
                  <button
                    onClick={() => {
                      dispatch(clearLeaderboardError('leaderboard'));
                      dispatch(fetchLeaderboard({
                        gameType: selectedGame,
                        leaderboardType: activeTab,
                        page: 1
                      }));
                    }}
                    className="btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-6xl mb-4">📊</div>
                  <h3 className="text-xl font-bold text-white mb-2">No Rankings Yet</h3>
                  <p className="text-gray-300">
                    Be the first to play and appear on the leaderboard!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => (
                    <motion.div
                      key={entry._id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-4 rounded-lg transition-all duration-200 ${entry.rank <= 3
                        ? 'bg-gradient-to-r from-gaming-neon/10 to-transparent border border-gaming-neon/30'
                        : 'bg-gaming-charcoal/50 hover:bg-gaming-charcoal'
                        }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl font-bold">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="w-10 h-10 bg-gaming-neon/20 rounded-full flex items-center justify-center">
                          <span className="text-gaming-neon font-bold">
                            {entry.userId.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {entry.userId.username}
                          </div>
                          <div className="text-sm text-gray-400">
                            {entry.stats.totalMatches} matches played
                          </div>
                        </div>
                        <div className="ml-2">
                          {getRankChangeIcon(entry.rankChange)}
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 text-sm">
                        <div className="text-center">
                          <div className="text-gaming-neon font-bold">
                            {entry.points}
                          </div>
                          <div className="text-gray-400">Points</div>
                        </div>
                        <div className="text-center">
                          <div className="text-white font-bold">
                            {entry.stats.winRate.toFixed(1)}%
                          </div>
                          <div className="text-gray-400">Win Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="text-white font-bold">
                            {entry.stats.kdRatio.toFixed(2)}
                          </div>
                          <div className="text-gray-400">K/D</div>
                        </div>
                        <div className="text-center">
                          <div className="text-white font-bold">
                            {entry.stats.averageScore.toFixed(0)}
                          </div>
                          <div className="text-gray-400">Avg Score</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gaming-slate">
                  <div className="text-gray-300 text-sm">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} players
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-3 py-1 bg-gaming-charcoal border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-neon"
                    >
                      Previous
                    </button>

                    <span className="px-3 py-1 bg-gaming-neon text-black rounded font-medium">
                      {pagination.page}
                    </span>

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages}
                      className="px-3 py-1 bg-gaming-charcoal border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-neon"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Position */}
            {isAuthenticated && userPosition && (
              <div className="card-gaming p-6">
                <h3 className="text-lg font-bold text-white mb-4">Your Rank</h3>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gaming-neon mb-2">
                    #{userPosition.rank}
                  </div>
                  <div className="text-sm text-gray-400 mb-4">
                    {userPosition.points} points
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-white font-bold">
                        {userPosition.stats.winRate.toFixed(1)}%
                      </div>
                      <div className="text-gray-400">Win Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold">
                        {userPosition.stats.kdRatio.toFixed(2)}
                      </div>
                      <div className="text-gray-400">K/D Ratio</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Performers */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">🔥 Top Performers</h3>
              <div className="space-y-3">
                {topPerformers.slice(0, 5).map((performer, index) => (
                  <div key={performer.user._id} className="flex items-center space-x-3">
                    <div className="text-lg">
                      {getRankIcon(performer.rank)}
                    </div>
                    <div className="w-8 h-8 bg-gaming-neon/20 rounded-full flex items-center justify-center">
                      <span className="text-gaming-neon font-bold text-sm">
                        {performer.user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">
                        {performer.user.username}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {performer.points} pts
                      </div>
                    </div>
                    <div className="text-xs">
                      {getRankChangeIcon(performer.rankChange)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-4">📈 Quick Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Players:</span>
                  <span className="text-white font-bold">{pagination.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Game:</span>
                  <span className="text-gaming-neon font-bold uppercase">{selectedGame}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Period:</span>
                  <span className="text-white font-bold capitalize">{activeTab}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
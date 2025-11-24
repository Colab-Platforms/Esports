import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
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

const LeaderboardPage = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(selectAuth);
  const leaderboard = useSelector(selectLeaderboard);
  const userPosition = useSelector(selectUserPosition);
  const topPerformers = useSelector(selectTopPerformers);
  const loading = useSelector(selectLeaderboardLoading);
  const error = useSelector(selectLeaderboardError);
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
      limit: 10
    }));
  }, [dispatch, selectedGame, activeTab, isAuthenticated]);

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
    switch (game) {
      case 'bgmi': return '🎮';
      case 'valorant': return '🎯';
      case 'cs2': return '⚡';
      default: return '🎮';
    }
  };

  if (loading.leaderboard) {
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
            {['bgmi', 'valorant', 'cs2'].map((game) => (
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

        {/* Leaderboard Type Tabs */}
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Leaderboard */}
          <div className="lg:col-span-3">
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-theme-text-primary">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Rankings
                </h2>
                <div className="text-sm text-theme-text-secondary">
                  {pagination.total} players
                </div>
              </div>

              {leaderboard.length === 0 ? (
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
            {isAuthenticated && userPosition && (
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
                {topPerformers.slice(0, 5).map((performer) => (
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
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-theme-bg-card rounded-xl border border-theme-border p-6">
              <h3 className="text-lg font-bold text-theme-text-primary mb-4">📈 Quick Stats</h3>
              <div className="space-y-3 text-sm">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
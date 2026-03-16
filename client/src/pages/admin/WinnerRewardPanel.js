import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiAward, FiSave, FiAlertCircle, FiRotateCcw, FiEye } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const WinnerRewardPanel = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Default coin values
  const DEFAULT_REWARDS = {
    1: 300,
    2: 200,
    3: 150,
    4: 100,
    5: 50
  };

  // Reward state
  const [rewardCoins, setRewardCoins] = useState(DEFAULT_REWARDS);
  const [remainingTeamsCoins, setRemainingTeamsCoins] = useState(10);
  const [selectedWinners, setSelectedWinners] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchCompletedTournaments();
  }, []);

  const fetchCompletedTournaments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/tournaments?status=completed');
      if (response.success) {
        setTournaments(response.data.tournaments || []);
      }
    } catch (error) {
      toast.error('Failed to fetch tournaments');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTournamentSelect = async (tournament) => {
    setSelectedTournament(tournament);
    setSelectedWinners({});
    setErrors({});
    setShowPreview(false);
    
    try {
      setLoading(true);
      const response = await api.get(`/api/tournaments/${tournament._id}/teams`);
      if (response.success) {
        setTeams(response.data.teams || []);
      }
    } catch (error) {
      toast.error('Failed to fetch teams');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleWinnerSelect = (position, teamId) => {
    setSelectedWinners(prev => ({
      ...prev,
      [position]: teamId
    }));
    // Clear error for this position
    setErrors(prev => ({
      ...prev,
      [position]: null
    }));
  };

  const handleRewardChange = (position, value) => {
    const numValue = parseInt(value) || 0;
    setRewardCoins(prev => ({
      ...prev,
      [position]: numValue
    }));
    // Clear error for this position
    setErrors(prev => ({
      ...prev,
      [`reward_${position}`]: null
    }));
  };

  const handleRemainingTeamsChange = (value) => {
    const numValue = parseInt(value) || 0;
    setRemainingTeamsCoins(numValue);
    setErrors(prev => ({
      ...prev,
      remaining: null
    }));
  };

  const resetToDefaults = () => {
    setRewardCoins(DEFAULT_REWARDS);
    setRemainingTeamsCoins(10);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};

    // Check if all 5 positions have teams selected
    for (let i = 1; i <= 5; i++) {
      if (!selectedWinners[i]) {
        newErrors[i] = 'Please select a team';
      }
    }

    // Check for duplicate teams
    const selectedTeamIds = Object.values(selectedWinners).filter(Boolean);
    const uniqueTeamIds = new Set(selectedTeamIds);
    if (selectedTeamIds.length !== uniqueTeamIds.size) {
      newErrors.duplicate = 'Same team cannot be selected for multiple ranks';
    }

    // Check coin values
    for (let i = 1; i <= 5; i++) {
      if (!rewardCoins[i] || rewardCoins[i] <= 0) {
        newErrors[`reward_${i}`] = 'Coins must be greater than 0';
      }
    }

    if (!remainingTeamsCoins || remainingTeamsCoins <= 0) {
      newErrors.remaining = 'Coins must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotalCoins = () => {
    const topFiveTotal = Object.values(rewardCoins).reduce((a, b) => a + b, 0);
    const remainingTeamsCount = Math.max(0, teams.length - 5);
    const remainingTotal = remainingTeamsCount * remainingTeamsCoins;
    return topFiveTotal + remainingTotal;
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t._id === teamId);
    return team?.name || 'Unknown Team';
  };

  const handlePreviewClick = () => {
    if (validateForm()) {
      setShowPreview(true);
    }
  };

  const handleDistributeRewards = async () => {
    try {
      setDistributing(true);
      const response = await api.post(`/api/admin/tournaments/${selectedTournament._id}/distribute-rewards`, {
        topFiveRewards: selectedWinners,
        rewardAmounts: rewardCoins,
        participationCoins: remainingTeamsCoins
      });

      if (response.success) {
        toast.success('🎉 Rewards distributed successfully!');
        setSelectedTournament(null);
        setTeams([]);
        setSelectedWinners({});
        setShowPreview(false);
        resetToDefaults();
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to distribute rewards');
      console.error(error);
    } finally {
      setDistributing(false);
    }
  };

  // Preview Screen Component
  if (showPreview && selectedTournament) {
    const topFiveTeams = [];
    for (let i = 1; i <= 5; i++) {
      const teamId = selectedWinners[i];
      const team = teams.find(t => t._id === teamId);
      if (team) {
        topFiveTeams.push({
          position: i,
          team,
          coins: rewardCoins[i]
        });
      }
    }

    const selectedTeamIds = Object.values(selectedWinners).filter(Boolean);
    const remainingTeams = teams.filter(team => !selectedTeamIds.includes(team._id));
    const totalCoins = calculateTotalCoins();

    return (
      <div className="min-h-screen bg-gaming-dark py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">
              🏆 Preview & Confirm
            </h1>
            <p className="text-gray-400">
              Review the reward distribution before confirming
            </p>
          </motion.div>

          <div className="space-y-6">
            {/* Tournament Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="card-gaming p-6"
            >
              <h3 className="text-lg font-bold text-white mb-2">Tournament</h3>
              <p className="text-gaming-gold text-lg">{selectedTournament.name}</p>
              <p className="text-gray-400 text-sm mt-1">{selectedTournament.gameType} • {selectedTournament.mode}</p>
            </motion.div>

            {/* Top 5 Winners */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="card-gaming p-6"
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FiAward className="text-gaming-gold" />
                Top 5 Winners
              </h3>
              <div className="space-y-3">
                {topFiveTeams.map(({ position, team, coins }) => (
                  <div key={position} className="flex items-center justify-between p-4 bg-gaming-charcoal rounded-lg border border-gaming-border">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl w-12">
                        {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
                      </div>
                      <div>
                        <p className="font-bold text-white">{team.name}</p>
                        <p className="text-sm text-gray-400">{team.memberCount} members</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gaming-gold">{coins}</p>
                      <p className="text-xs text-gray-400">coins per member</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Remaining Teams */}
            {remainingTeams.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="card-gaming p-6"
              >
                <h3 className="text-lg font-bold text-white mb-4">
                  Participation Rewards ({remainingTeams.length} teams)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {remainingTeams.map(team => (
                    <div key={team._id} className="flex items-center justify-between p-3 bg-gaming-charcoal rounded-lg border border-gaming-border">
                      <div>
                        <p className="font-semibold text-white text-sm">{team.name}</p>
                        <p className="text-xs text-gray-400">{team.memberCount} members</p>
                      </div>
                      <p className="text-lg font-bold text-gaming-gold">{remainingTeamsCoins}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Total Payout */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="card-gaming p-6 bg-gaming-charcoal/50 border border-gaming-gold/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Coins to Distribute</p>
                  <p className="text-3xl font-bold text-gaming-gold mt-2">{totalCoins}</p>
                </div>
                <div className="text-5xl">💰</div>
              </div>
            </motion.div>

            {/* Warning */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="card-gaming p-4 bg-red-500/10 border border-red-500/30 flex items-start gap-3"
            >
              <FiAlertCircle className="text-red-500 mt-1 shrink-0" />
              <div>
                <p className="font-bold text-red-400">⚠️ Warning</p>
                <p className="text-sm text-red-300 mt-1">This action cannot be undone. All coins will be immediately credited to player wallets.</p>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex gap-4"
            >
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-6 py-3 bg-gaming-charcoal border border-gaming-border hover:border-gaming-gold text-white font-bold rounded-lg transition-all"
              >
                ← Go Back
              </button>
              <button
                onClick={handleDistributeRewards}
                disabled={distributing}
                className="flex-1 px-6 py-3 bg-gaming-gold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <FiSave className="w-5 h-5" />
                {distributing ? 'Confirming...' : 'Confirm & Assign'}
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Main Panel
  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center space-x-2 text-gaming-gold hover:text-yellow-400 mb-4"
            >
              <FiArrowLeft />
              <span>Back to Admin</span>
            </Link>
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">
              🏆 Winner Reward Distribution
            </h1>
            <p className="text-gray-400">
              Distribute coins to tournament winners and participants
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Tournament Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="card-gaming p-6 sticky top-8">
              <h3 className="text-xl font-bold text-white mb-4">
                Select Tournament
              </h3>

              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading...</div>
              ) : tournaments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400">No completed tournaments</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tournaments.map(tournament => (
                    <button
                      key={tournament._id}
                      onClick={() => handleTournamentSelect(tournament)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                        selectedTournament?._id === tournament._id
                          ? 'bg-gaming-gold/20 border-2 border-gaming-gold text-gaming-gold'
                          : 'bg-gaming-charcoal border border-gaming-border text-gray-300 hover:border-gaming-gold'
                      }`}
                    >
                      <div className="font-semibold">{tournament.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {tournament.gameType} • {tournament.mode}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Right: Prize Distribution Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            {selectedTournament ? (
              <div className="space-y-6">
                {/* Prize Distribution */}
                <div className="card-gaming p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <FiAward className="text-gaming-gold" />
                      Prize Distribution
                    </h3>
                    <button
                      onClick={resetToDefaults}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-gaming-charcoal border border-gaming-border text-gray-300 hover:text-gaming-gold rounded transition-colors"
                    >
                      <FiRotateCcw className="w-4 h-4" />
                      Reset
                    </button>
                  </div>

                  {errors.duplicate && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
                      <FiAlertCircle className="text-red-500" />
                      <p className="text-sm text-red-400">{errors.duplicate}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Rank Slots */}
                    {[1, 2, 3, 4, 5].map(position => (
                      <motion.div
                        key={position}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: position * 0.05 }}
                        className="p-4 bg-gaming-charcoal rounded-lg border border-gaming-border"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-2xl w-10">
                            {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-300 mb-2">
                              Rank {position}
                            </label>
                            <select
                              value={selectedWinners[position] || ''}
                              onChange={(e) => handleWinnerSelect(position, e.target.value)}
                              className={`w-full px-3 py-2 bg-gaming-dark border rounded-lg text-white focus:outline-none transition-colors ${
                                errors[position]
                                  ? 'border-red-500 focus:border-red-500'
                                  : 'border-gaming-border focus:border-gaming-gold'
                              }`}
                            >
                              <option value="">Select team...</option>
                              {teams.map(team => (
                                <option key={team._id} value={team._id}>
                                  {team.name} ({team.memberCount} members)
                                </option>
                              ))}
                            </select>
                            {errors[position] && (
                              <p className="text-xs text-red-400 mt-1">{errors[position]}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="text-sm font-semibold text-gray-300 w-20">Coins:</label>
                          <input
                            type="number"
                            value={rewardCoins[position]}
                            onChange={(e) => handleRewardChange(position, e.target.value)}
                            min="1"
                            className={`flex-1 px-3 py-2 bg-gaming-dark border rounded-lg text-white focus:outline-none transition-colors ${
                              errors[`reward_${position}`]
                                ? 'border-red-500 focus:border-red-500'
                                : 'border-gaming-border focus:border-gaming-gold'
                            }`}
                          />
                          {errors[`reward_${position}`] && (
                            <p className="text-xs text-red-400">{errors[`reward_${position}`]}</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Remaining Teams */}
                <div className="card-gaming p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Remaining Teams</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Participation Coins (per team)
                      </label>
                      <input
                        type="number"
                        value={remainingTeamsCoins}
                        onChange={(e) => handleRemainingTeamsChange(e.target.value)}
                        min="1"
                        className={`w-full px-4 py-2 bg-gaming-dark border rounded-lg text-white focus:outline-none transition-colors ${
                          errors.remaining
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gaming-border focus:border-gaming-gold'
                        }`}
                      />
                      {errors.remaining && (
                        <p className="text-xs text-red-400 mt-1">{errors.remaining}</p>
                      )}
                    </div>
                    <div className="text-right pt-6">
                      <p className="text-xs text-gray-400">Teams</p>
                      <p className="text-2xl font-bold text-gaming-gold">{Math.max(0, teams.length - 5)}</p>
                    </div>
                  </div>
                </div>

                {/* Total Coins Counter */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-gaming p-6 bg-gradient-to-r from-gaming-gold/10 to-yellow-500/10 border border-gaming-gold/30"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Coins to be Distributed</p>
                      <p className="text-4xl font-bold text-gaming-gold mt-2">{calculateTotalCoins()}</p>
                    </div>
                    <div className="text-6xl">💰</div>
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={handlePreviewClick}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gaming-gold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <FiEye className="w-5 h-5" />
                    Preview & Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="card-gaming p-12 text-center">
                <FiAward className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a tournament to begin</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default WinnerRewardPanel;

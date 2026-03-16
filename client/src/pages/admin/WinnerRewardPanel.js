import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiAward, FiSave, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const WinnerRewardPanel = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);

  // Reward state
  const [topFiveRewards, setTopFiveRewards] = useState({
    1: 500,
    2: 400,
    3: 300,
    4: 200,
    5: 100
  });
  const [participationCoins, setParticipationCoins] = useState(50);
  const [selectedWinners, setSelectedWinners] = useState({});

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
    
    try {
      setLoading(true);
      // Fetch registered teams for this tournament
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
  };

  const handleRewardChange = (position, value) => {
    setTopFiveRewards(prev => ({
      ...prev,
      [position]: parseInt(value) || 0
    }));
  };

  const handleDistributeRewards = async () => {
    if (!selectedTournament) {
      toast.error('Please select a tournament');
      return;
    }

    // Validate top 5 selections
    const selectedPositions = Object.keys(selectedWinners).length;
    if (selectedPositions < 5) {
      toast.error(`Please select all top 5 winners (${selectedPositions}/5 selected)`);
      return;
    }

    try {
      setDistributing(true);
      const response = await api.post(`/api/admin/tournaments/${selectedTournament._id}/distribute-rewards`, {
        topFiveRewards: selectedWinners,
        rewardAmounts: topFiveRewards,
        participationCoins
      });

      if (response.success) {
        toast.success('Rewards distributed successfully!');
        setSelectedTournament(null);
        setTeams([]);
        setSelectedWinners({});
      }
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to distribute rewards');
      console.error(error);
    } finally {
      setDistributing(false);
    }
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t._id === teamId);
    return team?.name || 'Unknown Team';
  };

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
            <div className="card-gaming p-6">
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

          {/* Right: Reward Configuration & Team Selection */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            {selectedTournament ? (
              <div className="space-y-6">
                {/* Reward Configuration */}
                <div className="card-gaming p-6">
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <FiAward className="text-gaming-gold" />
                    Reward Configuration
                  </h3>

                  <div className="space-y-4">
                    {/* Top 5 Rewards */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-3 font-semibold">
                        Top 5 Positions (Coins)
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map(position => (
                          <div key={position}>
                            <label className="block text-xs text-gray-500 mb-1">
                              {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
                            </label>
                            <input
                              type="number"
                              value={topFiveRewards[position]}
                              onChange={(e) => handleRewardChange(position, e.target.value)}
                              className="w-full px-3 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white text-sm focus:outline-none focus:border-gaming-gold"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Participation Coins */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2 font-semibold">
                        Participation Coins (All other teams)
                      </label>
                      <input
                        type="number"
                        value={participationCoins}
                        onChange={(e) => setParticipationCoins(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:border-gaming-gold"
                      />
                    </div>
                  </div>
                </div>

                {/* Team Selection for Top 5 */}
                <div className="card-gaming p-6">
                  <h3 className="text-xl font-bold text-white mb-4">
                    Select Top 5 Winners
                  </h3>

                  {loading ? (
                    <div className="text-center py-8 text-gray-400">Loading teams...</div>
                  ) : teams.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No teams registered</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map(position => (
                        <div key={position} className="flex items-center gap-3">
                          <div className="text-2xl w-8">
                            {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
                          </div>
                          <select
                            value={selectedWinners[position] || ''}
                            onChange={(e) => handleWinnerSelect(position, e.target.value)}
                            className="flex-1 px-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:outline-none focus:border-gaming-gold"
                          >
                            <option value="">Select team...</option>
                            {teams.map(team => (
                              <option key={team._id} value={team._id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                          <div className="text-right min-w-20">
                            <div className="text-sm text-gray-400">Coins</div>
                            <div className="text-lg font-bold text-gaming-gold">
                              {topFiveRewards[position]}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="card-gaming p-6 bg-gaming-charcoal/50 border border-gaming-border">
                  <div className="flex items-start gap-3 mb-4">
                    <FiAlertCircle className="text-gaming-gold mt-1 shrink-0" />
                    <div>
                      <p className="text-sm text-gray-300">
                        <strong>Summary:</strong> {teams.length} teams registered
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Top 5: {Object.values(topFiveRewards).reduce((a, b) => a + b, 0)} coins total
                      </p>
                      <p className="text-sm text-gray-400">
                        Participation: {(teams.length - 5) * participationCoins} coins ({teams.length - 5} teams × {participationCoins} coins)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={handleDistributeRewards}
                  disabled={distributing || Object.keys(selectedWinners).length < 5}
                  className="w-full px-6 py-3 bg-gaming-gold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <FiSave className="w-5 h-5" />
                  {distributing ? 'Distributing...' : 'Distribute Rewards'}
                </button>
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

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiUsers, FiCalendar, FiDollarSign } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TournamentManagement = () => {
  const [tournaments, setTournaments] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    gameId: '',
    description: '',
    entryFee: 0,
    prizePool: 0,
    maxParticipants: 100,
    startDate: '',
    endDate: '',
    rules: '',
    format: 'single-elimination',
    status: 'upcoming'
  });

  useEffect(() => {
    fetchTournaments();
    fetchGames();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await api.get('/api/tournaments');
      setTournaments(response.data?.tournaments || []);
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
      toast.error('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const fetchGames = async () => {
    try {
      // Add timestamp to bypass cache
      const timestamp = new Date().getTime();
      const response = await api.get(`/api/games?t=${timestamp}`);
      console.log('Games API Response:', response);
      console.log('Response type:', typeof response);
      console.log('Is array?', Array.isArray(response));
      
      // Handle different response formats
      let gamesData = [];
      
      // Direct array response (current backend)
      if (Array.isArray(response)) {
        gamesData = response;
      }
      // Wrapped response with data.games
      else if (response.data?.games) {
        gamesData = response.data.games;
      }
      // Wrapped response with just data array
      else if (Array.isArray(response.data)) {
        gamesData = response.data;
      }
      // Success flag with data
      else if (response.success && response.data) {
        gamesData = Array.isArray(response.data) ? response.data : response.data.games || [];
      }
      
      console.log('Final games data:', gamesData);
      console.log('Games count:', gamesData.length);
      setGames(gamesData);
      
      if (gamesData.length === 0) {
        console.warn('No games found in database');
        toast.error('No games found. Please add games first from Games Management.');
      } else {
        console.log(`✅ Loaded ${gamesData.length} games`);
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
      toast.error('Failed to load games. Check console for details.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTournament) {
        await api.put(`/api/tournaments/${editingTournament._id}`, formData);
        toast.success('Tournament updated successfully!');
      } else {
        await api.post('/api/tournaments', formData);
        toast.success('Tournament created successfully!');
      }
      
      setShowModal(false);
      resetForm();
      fetchTournaments();
    } catch (error) {
      console.error('Failed to save tournament:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to save tournament');
    }
  };

  const handleEdit = (tournament) => {
    setEditingTournament(tournament);
    setFormData({
      name: tournament.name,
      gameId: tournament.gameId?._id || tournament.gameId,
      description: tournament.description || '',
      entryFee: tournament.entryFee || 0,
      prizePool: tournament.prizePool || 0,
      maxParticipants: tournament.maxParticipants || 100,
      startDate: tournament.startDate ? new Date(tournament.startDate).toISOString().slice(0, 16) : '',
      endDate: tournament.endDate ? new Date(tournament.endDate).toISOString().slice(0, 16) : '',
      rules: tournament.rules || '',
      format: tournament.format || 'single-elimination',
      status: tournament.status || 'upcoming'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this tournament?')) return;
    
    try {
      await api.delete(`/api/tournaments/${id}`);
      toast.success('Tournament deleted successfully!');
      fetchTournaments();
    } catch (error) {
      console.error('Failed to delete tournament:', error);
      toast.error('Failed to delete tournament');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      gameId: '',
      description: '',
      entryFee: 0,
      prizePool: 0,
      maxParticipants: 100,
      startDate: '',
      endDate: '',
      rules: '',
      format: 'single-elimination',
      status: 'upcoming'
    });
    setEditingTournament(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/20 text-blue-400';
      case 'ongoing': return 'bg-green-500/20 text-green-400';
      case 'completed': return 'bg-gray-500/20 text-gray-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">
              Tournament Management
            </h1>
            <p className="text-gray-400">Create and manage tournaments</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="btn-gaming flex items-center space-x-2"
          >
            <FiPlus className="h-5 w-5" />
            <span>Create Tournament</span>
          </button>
        </div>

        {/* Tournaments List */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div className="card-gaming p-12 text-center">
            <FiCalendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Tournaments Yet</h3>
            <p className="text-gray-400 mb-6">Create your first tournament to get started</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-gaming"
            >
              Create Tournament
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => (
              <motion.div
                key={tournament._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-gaming p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{tournament.name}</h3>
                    <p className="text-sm text-gray-400">{tournament.gameId?.name || 'Unknown Game'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tournament.status)}`}>
                    {tournament.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-400">
                    <FiUsers className="h-4 w-4 mr-2" />
                    <span>{tournament.participants?.length || 0} / {tournament.maxParticipants} players</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-400">
                    <FiDollarSign className="h-4 w-4 mr-2" />
                    <span>Entry: ₹{tournament.entryFee} | Prize: ₹{tournament.prizePool}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-400">
                    <FiCalendar className="h-4 w-4 mr-2" />
                    <span>{new Date(tournament.startDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(tournament)}
                    className="flex-1 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center justify-center space-x-2"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(tournament._id)}
                    className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center justify-center space-x-2"
                  >
                    <FiTrash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-gaming p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {editingTournament ? 'Edit Tournament' : 'Create Tournament'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="input-gaming w-full"
                    placeholder="Enter tournament name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Game *
                  </label>
                  <select
                    name="gameId"
                    value={formData.gameId}
                    onChange={handleInputChange}
                    required
                    className="input-gaming w-full"
                    disabled={games.length === 0}
                  >
                    <option value="">
                      {games.length === 0 ? 'Loading games...' : 'Select a game'}
                    </option>
                    {games.map(game => (
                      <option key={game._id} value={game._id}>
                        {game.name}
                      </option>
                    ))}
                  </select>
                  {games.length === 0 && (
                    <p className="text-xs text-yellow-400 mt-1">
                      No games found. Add games from Games Management first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="input-gaming w-full"
                    placeholder="Tournament description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Entry Fee (₹)
                    </label>
                    <input
                      type="number"
                      name="entryFee"
                      value={formData.entryFee}
                      onChange={handleInputChange}
                      min="0"
                      className="input-gaming w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Prize Pool (₹)
                    </label>
                    <input
                      type="number"
                      name="prizePool"
                      value={formData.prizePool}
                      onChange={handleInputChange}
                      min="0"
                      className="input-gaming w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Max Participants
                  </label>
                  <input
                    type="number"
                    name="maxParticipants"
                    value={formData.maxParticipants}
                    onChange={handleInputChange}
                    min="2"
                    className="input-gaming w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="datetime-local"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      required
                      className="input-gaming w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      End Date *
                    </label>
                    <input
                      type="datetime-local"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      required
                      className="input-gaming w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Format
                  </label>
                  <select
                    name="format"
                    value={formData.format}
                    onChange={handleInputChange}
                    className="input-gaming w-full"
                  >
                    <option value="single-elimination">Single Elimination</option>
                    <option value="double-elimination">Double Elimination</option>
                    <option value="round-robin">Round Robin</option>
                    <option value="swiss">Swiss</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="input-gaming w-full"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Rules
                  </label>
                  <textarea
                    name="rules"
                    value={formData.rules}
                    onChange={handleInputChange}
                    rows="4"
                    className="input-gaming w-full"
                    placeholder="Tournament rules and regulations"
                  />
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 btn-gaming"
                  >
                    {editingTournament ? 'Update Tournament' : 'Create Tournament'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentManagement;

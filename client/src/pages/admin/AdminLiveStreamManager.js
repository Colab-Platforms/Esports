import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiEdit2, FiSave, FiX, FiRefreshCw, FiCheck, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const AdminLiveStreamManager = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    youtubeVideoId: '',
    isLiveStreamEnabled: false
  });

  // Fetch all tournaments
  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/tournaments?limit=100');
      if (response.data && response.data.data) {
        setTournaments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      toast.error('Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tournament) => {
    setEditingId(tournament._id);
    setFormData({
      youtubeVideoId: tournament.youtubeVideoId || '',
      isLiveStreamEnabled: tournament.isLiveStreamEnabled || false
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ youtubeVideoId: '', isLiveStreamEnabled: false });
  };

  const handleSave = async (tournamentId) => {
    try {
      if (!formData.youtubeVideoId.trim()) {
        toast.error('Please enter a YouTube video ID');
        return;
      }

      const response = await api.put(`/api/tournaments/${tournamentId}`, {
        youtubeVideoId: formData.youtubeVideoId.trim(),
        isLiveStreamEnabled: formData.isLiveStreamEnabled
      });

      if (response.data && response.data.data) {
        // Update local state
        setTournaments(tournaments.map(t => 
          t._id === tournamentId ? response.data.data : t
        ));
        setEditingId(null);
        toast.success('Live stream settings updated!');
      }
    } catch (error) {
      console.error('Error updating tournament:', error);
      toast.error(error.message || 'Failed to update tournament');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getStatusBadge = (tournament) => {
    if (tournament.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
          <FiCheck size={14} />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-500/20 text-gray-400 rounded-full text-sm font-medium">
        {tournament.status}
      </span>
    );
  };

  const getVideoIdStatus = (tournament) => {
    if (tournament.youtubeVideoId) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
          <FiCheck size={12} />
          Configured
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
        <FiAlertCircle size={12} />
        Not Set
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Live Stream Manager</h1>
          <p className="text-gray-400">Manage YouTube video IDs for tournaments</p>
        </motion.div>

        {/* Refresh Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchTournaments}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-gaming-neon/10 border border-gaming-neon text-gaming-neon rounded-lg hover:bg-gaming-neon/20 transition-all"
        >
          <FiRefreshCw size={18} />
          Refresh
        </motion.button>

        {/* Tournaments List */}
        <div className="space-y-4">
          {tournaments.length === 0 ? (
            <div className="text-center py-12 bg-gaming-charcoal/30 rounded-lg border border-gaming-slate">
              <p className="text-gray-400">No tournaments found</p>
            </div>
          ) : (
            tournaments.map((tournament) => (
              <motion.div
                key={tournament._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gaming-charcoal/50 border border-gaming-slate rounded-lg p-6 hover:border-gaming-neon/30 transition-all"
              >
                {editingId === tournament._id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tournament Name
                        </label>
                        <input
                          type="text"
                          value={tournament.name}
                          disabled
                          className="w-full px-4 py-2 bg-gaming-dark border border-gaming-slate rounded-lg text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Status
                        </label>
                        <input
                          type="text"
                          value={tournament.status}
                          disabled
                          className="w-full px-4 py-2 bg-gaming-dark border border-gaming-slate rounded-lg text-gray-400 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        YouTube Video ID
                      </label>
                      <input
                        type="text"
                        name="youtubeVideoId"
                        value={formData.youtubeVideoId}
                        onChange={handleInputChange}
                        placeholder="e.g., dQw4w9WgXcQ"
                        className="w-full px-4 py-2 bg-gaming-dark border border-gaming-slate rounded-lg text-white placeholder-gray-500 focus:border-gaming-neon focus:outline-none transition-all"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Get from YouTube URL: youtube.com/watch?v=<span className="text-gaming-neon">VIDEO_ID</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="isLiveStreamEnabled"
                        checked={formData.isLiveStreamEnabled}
                        onChange={handleInputChange}
                        className="w-4 h-4 rounded border-gaming-slate bg-gaming-dark cursor-pointer"
                      />
                      <label className="text-sm font-medium text-gray-300 cursor-pointer">
                        Enable Live Stream for this tournament
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSave(tournament._id)}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500 text-green-400 rounded-lg hover:bg-green-500/30 transition-all font-medium"
                      >
                        <FiSave size={18} />
                        Save
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCancel}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/30 transition-all font-medium"
                      >
                        <FiX size={18} />
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-2">{tournament.name}</h3>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {getStatusBadge(tournament)}
                        {getVideoIdStatus(tournament)}
                      </div>
                      {tournament.youtubeVideoId && (
                        <p className="text-sm text-gray-400">
                          Video ID: <span className="text-gaming-neon font-mono">{tournament.youtubeVideoId}</span>
                        </p>
                      )}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleEdit(tournament)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gaming-neon/10 border border-gaming-neon text-gaming-neon rounded-lg hover:bg-gaming-neon/20 transition-all font-medium"
                    >
                      <FiEdit2 size={18} />
                      Edit
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
        >
          <p className="text-sm text-blue-300">
            <strong>💡 Tip:</strong> The live stream section will only appear on the homepage when a tournament with status "active" has a YouTube video ID configured.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminLiveStreamManager;

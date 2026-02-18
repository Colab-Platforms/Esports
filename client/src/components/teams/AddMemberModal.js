import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiX, FiSearch, FiUserPlus } from 'react-icons/fi';
import UserAvatar from '../common/UserAvatar';
import axios from 'axios';
import toast from 'react-hot-toast';

const AddMemberModal = ({ team, token, onClose, onSuccess }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [adding, setAdding] = useState(false);

  // Search for players
  useEffect(() => {
    if (searchQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    const searchPlayers = async () => {
      try {
        setLoading(true);
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
        
        const response = await axios.get(
          `${API_URL}/api/users/players`,
          {
            params: {
              search: searchQuery
            },
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (response.data.success) {
          const players = response.data.data.players || [];
          const filtered = players.filter(player => {
            const isMember = team.members.some(m => {
              if (!m.userId) return false;
              return m.userId._id === player._id || m.userId._id === player.id;
            });
            return !isMember;
          });
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error('Error searching players:', error);
        toast.error('Failed to search players', {
          duration: 2000,
          position: 'top-center'
        });
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchPlayers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, team, token]);

  const handleAddMember = async () => {
    if (!selectedUser) return;

    try {
      setAdding(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      const response = await axios.post(
        `${API_URL}/api/teams/${team._id}/add-member`,
        { userId: selectedUser._id },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success(`${selectedUser.username} added to team! 🎉`, {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to add member', {
        duration: 3000,
        position: 'top-center'
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gaming-charcoal rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gaming-charcoal border-b border-gaming-gold/20 p-6 flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">Add Player to {team.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search players by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gaming-charcoal border border-gaming-gold/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gaming-gold"
            />
          </div>

          {/* Selected User */}
          {selectedUser && (
            <div className="bg-gaming-gold/10 border border-gaming-gold/30 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <UserAvatar user={selectedUser} size="sm" />
                <div className="flex-1">
                  <p className="text-white font-medium">{selectedUser.username}</p>
                  <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Search Results */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-400">
                Searching players...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((player) => (
                <motion.button
                  key={player._id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedUser(player)}
                  className={`w-full p-3 rounded-lg transition-colors flex items-center space-x-3 ${
                    selectedUser?._id === player._id
                      ? 'bg-gaming-gold/20 border border-gaming-gold'
                      : 'bg-gaming-charcoal border border-gray-600 hover:border-gaming-gold/50'
                  }`}
                >
                  <UserAvatar user={player} size="xs" />
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium">{player.username}</p>
                    <p className="text-gray-400 text-xs">{player.email}</p>
                  </div>
                </motion.button>
              ))
            ) : searchQuery.trim().length >= 1 ? (
              <div className="text-center py-8 text-gray-400">
                No players found
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Type to search players
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gaming-charcoal border-t border-gaming-gold/20 p-6 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddMember}
            disabled={!selectedUser || adding}
            className="flex-1 py-2 bg-gaming-gold hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-black rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <FiUserPlus className="w-4 h-4" />
            <span>{adding ? 'Adding...' : 'Add Player'}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AddMemberModal;

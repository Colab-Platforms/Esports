import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSearch, FiUserPlus, FiCheck } from 'react-icons/fi';
import UserAvatar from '../common/UserAvatar';
import axios from 'axios';
import toast from 'react-hot-toast';

const InviteMemberModal = ({ team, onClose, token, onSuccess }) => {
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState({});

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/users/friends`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        // Filter out members who are already in the team
        const teamMemberIds = team.members.map(m => m.userId._id || m.userId.id || m.userId);
        const availableFriends = response.data.data.friends.filter(friend => {
          const friendId = friend._id || friend.id;
          return !teamMemberIds.includes(friendId);
        });
        setFriends(availableFriends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      toast.error('Failed to load friends list');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (friendId) => {
    try {      
      if (!friendId) {
        toast.error('Friend ID is missing');
        return;
      }
      
      setInviting(prev => ({ ...prev, [friendId]: true }));
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      const payload = { userId: friendId };
      
      const response = await axios.post(
        `${API_URL}/api/teams/${team._id}/invite`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('Invitation sent! 🎮', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        
        // Keep the button in "Invited" state (don't reset inviting state)
        // Remove invited friend from list after a short delay
        setTimeout(() => {
          setFriends(friends.filter(f => (f._id || f.id) !== friendId));
        }, 1000);
        
        // Don't call onSuccess to avoid page reload
        // if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to send invitation');
      // Reset button state on error
      setInviting(prev => ({ ...prev, [friendId]: false }));
    }
    // Don't reset inviting state in finally - keep it as "Invited"
  };

  const filteredFriends = friends.filter(friend =>
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-gaming-charcoal rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-gaming-border"
        >
          {/* Header */}
          <div className="p-6 border-b border-gaming-border flex items-center justify-between">
            <div>
              <h2 className="text-white text-2xl font-bold">Invite Members</h2>
              <p className="text-gray-400 text-sm">
                Invite your friends to join {team.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* Search */}
          <div className="p-6 border-b border-gaming-border">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gaming-dark border border-gaming-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gaming-gold"
              />
            </div>
          </div>

          {/* Friends List */}
          <div className="p-6 overflow-y-auto max-h-96">
            {loading ? (
              <div className="text-center py-8 text-gray-400">
                Loading friends...
              </div>
            ) : filteredFriends.length > 0 ? (
              <div className="space-y-3">
                {filteredFriends.map((friend) => {
                  const friendId = friend._id || friend.id; // Handle both _id and id
                  return (
                    <motion.div
                      key={friendId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-gaming-dark rounded-lg hover:bg-gaming-dark/70 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <UserAvatar user={friend} size="sm" />
                        <div>
                          <div className="text-white font-medium">{friend.username}</div>
                          {friend.favoriteGame && (
                            <div className="text-gaming-neon text-xs">
                              {friend.favoriteGame.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleInvite(friendId)}
                        disabled={inviting[friendId]}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                          inviting[friendId]
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-gaming-gold hover:bg-yellow-500 text-black'
                        }`}
                      >
                        {inviting[friendId] ? (
                        <>
                          <FiCheck className="w-4 h-4" />
                          <span>Sent</span>
                        </>
                      ) : (
                        <>
                          <FiUserPlus className="w-4 h-4" />
                          <span>Invite</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FiUserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {searchQuery ? 'No friends found' : 'No friends available to invite'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Add friends first to invite them to your team
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gaming-border flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default InviteMemberModal;

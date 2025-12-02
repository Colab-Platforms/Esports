import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiUserPlus, FiTarget, FiAward, FiUsers, FiStar } from 'react-icons/fi';
import UserAvatar from '../components/common/UserAvatar';
import axios from 'axios';

const PublicProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showChallengeMenu, setShowChallengeMenu] = useState(false);

  useEffect(() => {
    fetchPlayerProfile();
    checkAuth();
  }, [username]);

  // Close challenge menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChallengeMenu && !event.target.closest('.challenge-dropdown')) {
        setShowChallengeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChallengeMenu]);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  };

  const fetchPlayerProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/users/profile/${username}`);
      setPlayer(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching player profile:', err);
      setError(err.response?.data?.message || 'Player not found');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add friends', {
        duration: 3000,
        position: 'top-center'
      });
      setTimeout(() => {
        navigate('/login', { state: { from: `/player/${username}` } });
      }, 1000);
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      const response = await axios.post(
        `${API_URL}/api/users/friend-request`,
        { recipientId: player._id },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        toast.success('Friend request sent! 🎮', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to send friend request';
      const errorCode = error.response?.data?.error?.code;
      
      // Show warning toast for already sent/existing requests
      if (errorCode === 'REQUEST_EXISTS' || errorCode === 'ALREADY_FRIENDS') {
        toast(errorMessage, {
          duration: 3000,
          position: 'top-center',
          icon: '⚠️',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
      } else {
        toast.error(errorMessage, {
          duration: 3000,
          position: 'top-center'
        });
      }
    }
  };

  const handleChallenge = (game) => {
    if (!isAuthenticated) {
      toast.error('Please login to send challenges', {
        duration: 3000,
        position: 'top-center'
      });
      setTimeout(() => {
        navigate('/login', { state: { from: `/player/${username}` } });
      }, 1000);
      return;
    }
    
    setShowChallengeMenu(false);
    
    // TODO: Implement challenge functionality
    toast.success(`${game.toUpperCase()} Challenge sent! ⚔️`, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#1a1a2e',
        color: '#fff',
        border: '1px solid #00f0ff'
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-white text-xl">Loading player profile...</div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-white text-2xl mb-4">Player Not Found</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/teams')}
            className="px-6 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors"
          >
            Back to Teams
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <FiArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-gaming p-8 mb-6"
        >
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            {/* Avatar */}
            <UserAvatar user={player} size="2xl" />

            {/* Player Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-white text-3xl font-bold mb-2">{player.username}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                <span className="px-3 py-1 bg-gaming-gold/20 text-gaming-gold rounded-full text-sm font-medium">
                  Level {player.level || 1}
                </span>
                <span className="px-3 py-1 bg-gaming-neon/20 text-gaming-neon rounded-full text-sm font-medium">
                  {player.rank || 'Unranked'}
                </span>
              </div>
              {player.bio && (
                <p className="text-gray-400 mb-4">{player.bio}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-2 w-full md:w-auto">
              <button
                onClick={handleAddFriend}
                className="px-6 py-2 bg-gaming-gold hover:bg-yellow-500 text-black rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
              >
                <FiUserPlus className="w-4 h-4" />
                <span>Add Friend</span>
              </button>
              
              {/* Challenge Button with Dropdown */}
              <div className="relative challenge-dropdown">
                <button
                  onClick={() => setShowChallengeMenu(!showChallengeMenu)}
                  className="w-full px-6 py-2 bg-gaming-neon hover:bg-gaming-neon-blue text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <FiTarget className="w-4 h-4" />
                  <span>Challenge</span>
                </button>

                {/* Challenge Dropdown Menu */}
                {showChallengeMenu && (
                  <div className="absolute top-full mt-2 w-full bg-gaming-charcoal border border-gaming-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => handleChallenge('bgmi')}
                      className="w-full px-4 py-3 text-left text-white hover:bg-gaming-dark transition-colors flex items-center space-x-2"
                    >
                      <span className="text-lg">🎮</span>
                      <span>BGMI Match</span>
                    </button>
                    <button
                      onClick={() => handleChallenge('cs2')}
                      className="w-full px-4 py-3 text-left text-white hover:bg-gaming-dark transition-colors flex items-center space-x-2"
                    >
                      <span className="text-lg">🔫</span>
                      <span>CS2 Match</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<FiAward className="w-6 h-6" />}
            label="Wins"
            value={player.wins || 0}
            color="text-gaming-gold"
          />
          <StatCard
            icon={<FiTarget className="w-6 h-6" />}
            label="Games Played"
            value={player.gamesPlayed || 0}
            color="text-gaming-neon"
          />
          <StatCard
            icon={<FiUsers className="w-6 h-6" />}
            label="Friends"
            value={player.friends?.length || 0}
            color="text-blue-400"
          />
          <StatCard
            icon={<FiStar className="w-6 h-6" />}
            label="Win Rate"
            value={player.gamesPlayed > 0 ? `${Math.round((player.wins / player.gamesPlayed) * 100)}%` : '0%'}
            color="text-purple-400"
          />
        </div>

        {/* Games Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-gaming p-6 mb-6"
        >
          <h2 className="text-white text-xl font-bold mb-4 flex items-center space-x-2">
            <span>🎮</span>
            <span>Games</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {player.games && player.games.length > 0 ? (
              player.games.map((game, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-gaming-neon/20 text-gaming-neon rounded-lg font-medium"
                >
                  {game.toUpperCase()}
                </span>
              ))
            ) : (
              <p className="text-gray-400">No games added yet</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, label, value, color }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="card-gaming p-6 text-center"
  >
    <div className={`${color} mb-2 flex justify-center`}>{icon}</div>
    <div className={`${color} text-2xl font-bold mb-1`}>{value}</div>
    <div className="text-gray-400 text-sm">{label}</div>
  </motion.div>
);

export default PublicProfile;

import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  FiSearch,
  FiUsers,
  FiUserPlus,
  FiSend,
  FiFilter,
  FiTarget,
  FiCheck,
  FiX
} from 'react-icons/fi';
import { selectAuth } from '../store/slices/authSlice';
import UserAvatar from '../components/common/UserAvatar';
import axios from 'axios';

const TeamsPage = () => {
  const { user, token } = useSelector(selectAuth);
  const [activeTab, setActiveTab] = useState('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState('all');
  const [players, setPlayers] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'players', label: 'Find Players', icon: FiUsers },
    { id: 'friends', label: 'Friend Requests', icon: FiUserPlus }
  ];

  const games = [
    { id: 'all', name: 'All Games' },
    { id: 'bgmi', name: 'BGMI' },
    { id: 'cs2', name: 'CS2' },
    { id: 'valorant', name: 'Valorant' }
  ];

  useEffect(() => {
    if (activeTab === 'players') {
      fetchPlayers();
    } else if (activeTab === 'friends') {
      fetchFriendRequests();
    }
  }, [activeTab, selectedGame, searchQuery]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/users/players`, {
        params: {
          search: searchQuery,
          game: selectedGame !== 'all' ? selectedGame : undefined
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setPlayers(response.data.data.players || []);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/users/friend-requests`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setFriendRequests(response.data.data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (playerId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(
        `${API_URL}/api/users/friend-request`,
        { recipientId: playerId },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        alert('Friend request sent!');
        fetchPlayers();
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert(error.response?.data?.error?.message || 'Failed to send friend request');
    }
  };

  const sendChallenge = async (playerId, game) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(
        `${API_URL}/api/users/challenge`,
        { 
          opponentId: playerId,
          game: game
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data.success) {
        alert('Challenge sent!');
      }
    } catch (error) {
      console.error('Error sending challenge:', error);
      alert(error.response?.data?.error?.message || 'Failed to send challenge');
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            Teams & Players
          </h1>
          <p className="text-gray-400">
            Find players, send friend requests, and challenge opponents
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gaming-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 font-medium transition-colors flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'text-gaming-gold border-b-2 border-gaming-gold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Players Tab */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="card-gaming p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Search */}
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search players by username..."
                    className="w-full pl-10 pr-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none"
                  />
                </div>

                {/* Game Filter */}
                <div className="relative">
                  <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <select
                    value={selectedGame}
                    onChange={(e) => setSelectedGame(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none"
                  >
                    {games.map((game) => (
                      <option key={game.id} value={game.id}>
                        {game.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Players List */}
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading players...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    currentUserId={user?.id}
                    onSendFriendRequest={sendFriendRequest}
                    onSendChallenge={sendChallenge}
                  />
                ))}
                {players.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No players found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Friend Requests Tab */}
        {activeTab === 'friends' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading requests...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {friendRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                  />
                ))}
                {friendRequests.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <FiUserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No friend requests</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Player Card Component
const PlayerCard = ({ player, currentUserId, onSendFriendRequest, onSendChallenge }) => {
  const [showChallengeMenu, setShowChallengeMenu] = useState(false);

  if (player.id === currentUserId) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-gaming p-6"
    >
      <div className="flex items-start space-x-4 mb-4">
        <UserAvatar user={player} size="lg" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{player.username}</h3>
          <p className="text-sm text-gray-400">Level {player.level || 1}</p>
          <p className="text-xs text-gaming-neon">{player.currentRank || 'Bronze'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="bg-gaming-charcoal p-2 rounded">
          <p className="text-gray-400 text-xs">Tournaments Won</p>
          <p className="text-white font-bold">{player.tournamentsWon || 0}</p>
        </div>
        <div className="bg-gaming-charcoal p-2 rounded">
          <p className="text-gray-400 text-xs">Win Rate</p>
          <p className="text-white font-bold">{player.winRate || 0}%</p>
        </div>
      </div>

      {/* Favorite Game */}
      {player.favoriteGame && (
        <div className="mb-4">
          <span className="inline-block px-3 py-1 bg-gaming-neon/20 text-gaming-neon text-xs rounded-full">
            {player.favoriteGame.toUpperCase()}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={() => onSendFriendRequest(player.id)}
          disabled={player.friendRequestSent}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg transition-colors ${
            player.friendRequestSent
              ? 'bg-gaming-charcoal text-gray-500 cursor-not-allowed'
              : 'bg-gaming-gold hover:bg-yellow-500 text-black'
          }`}
        >
          <FiUserPlus className="w-4 h-4" />
          <span className="text-sm font-medium">
            {player.friendRequestSent ? 'Request Sent' : 'Add Friend'}
          </span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowChallengeMenu(!showChallengeMenu)}
            className="p-2 bg-gaming-neon hover:bg-gaming-neon/80 text-black rounded-lg transition-colors"
          >
            <FiTarget className="w-5 h-5" />
          </button>

          {showChallengeMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-gaming-charcoal border border-gaming-border rounded-lg shadow-xl z-10">
              <div className="p-2">
                <p className="text-xs text-gray-400 px-2 py-1">Challenge to:</p>
                <button
                  onClick={() => {
                    onSendChallenge(player.id, 'bgmi');
                    setShowChallengeMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-white hover:bg-gaming-dark rounded"
                >
                  BGMI Match
                </button>
                <button
                  onClick={() => {
                    onSendChallenge(player.id, 'cs2');
                    setShowChallengeMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-white hover:bg-gaming-dark rounded"
                >
                  CS2 Match
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Friend Request Card Component
const FriendRequestCard = ({ request }) => {
  const handleAccept = async () => {
    // TODO: Implement accept friend request
    alert('Friend request accepted!');
  };

  const handleReject = async () => {
    // TODO: Implement reject friend request
    alert('Friend request rejected!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-gaming p-6"
    >
      <div className="flex items-start space-x-4 mb-4">
        <UserAvatar user={request.sender} size="lg" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{request.sender.username}</h3>
          <p className="text-sm text-gray-400">Level {request.sender.level || 1}</p>
          <p className="text-xs text-gray-500">{request.createdAt}</p>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={handleAccept}
          className="flex-1 flex items-center justify-center space-x-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <FiCheck className="w-4 h-4" />
          <span className="text-sm font-medium">Accept</span>
        </button>
        <button
          onClick={handleReject}
          className="flex-1 flex items-center justify-center space-x-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          <FiX className="w-4 h-4" />
          <span className="text-sm font-medium">Reject</span>
        </button>
      </div>
    </motion.div>
  );
};

export default TeamsPage;

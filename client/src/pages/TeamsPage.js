import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiSearch,
  FiUsers,
  FiUserPlus,
  FiFilter,
  FiTarget,
  FiCheck,
  FiX,
  FiEye,
  FiCheckCircle,
  FiRefreshCw
} from 'react-icons/fi';
import { selectAuth } from '../store/slices/authSlice';
import UserAvatar from '../components/common/UserAvatar';
import MyTeamsTab from '../components/teams/MyTeamsTab';
import axios from 'axios';

const TeamsPage = () => {
  const navigate = useNavigate();
  const { user, token, isAuthenticated } = useSelector(selectAuth);
  const [activeTab, setActiveTab] = useState('players');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState('all');
  const [players, setPlayers] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [teamInvitations, setTeamInvitations] = useState([]);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openChallengeMenu, setOpenChallengeMenu] = useState(null);

  const tabs = [
    { id: 'players', label: 'Find Players', icon: FiUsers },
    { id: 'friends', label: 'Friend Requests', icon: FiUserPlus },
    { id: 'teams', label: 'My Teams', icon: FiUsers },
    { id: 'challenges', label: 'Challenges', icon: FiTarget }
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
    } else if (activeTab === 'teams') {
      fetchMyTeams();
      fetchTeamInvitations();
    }
  }, [activeTab, selectedGame, searchQuery]);

  // Close challenge menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openChallengeMenu && !event.target.closest('.challenge-menu-container')) {
        setOpenChallengeMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openChallengeMenu]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      // Use authenticated endpoint if logged in to get friend status
      const endpoint = isAuthenticated 
        ? `${API_URL}/api/users/players`
        : `${API_URL}/api/users/players/public`;
      
      const config = isAuthenticated ? {
        params: {
          search: searchQuery,
          game: selectedGame !== 'all' ? selectedGame : undefined
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {
        params: {
          search: searchQuery,
          game: selectedGame !== 'all' ? selectedGame : undefined
        }
      };
      
      const response = await axios.get(endpoint, config);
      
      if (response.data.success) {
        console.log('✅ Fetched players:', response.data.data.players.length);
        console.log('📊 Players data:', response.data.data.players);
        // Log friend status for each player
        response.data.data.players.forEach(p => {
          console.log(`Player: ${p.username}, isFriend: ${p.isFriend}, friendRequestSent: ${p.friendRequestSent}`);
        });
        setPlayers(response.data.data.players || []);
      }
    } catch (error) {
      console.error('❌ Error fetching players:', error);
      // Show error to user
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleActionWithLogin = (action, ...args) => {
    if (!isAuthenticated) {
      toast.error('Please login to perform this action', {
        duration: 3000,
        position: 'top-center',
        icon: '🔒'
      });
      setTimeout(() => {
        navigate('/login', { state: { from: '/teams' } });
      }, 1500);
      return;
    }
    action(...args);
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

  const fetchMyTeams = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/teams/my-teams`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        const teams = response.data.data.teams || [];
        console.log('📊 Fetched teams:', teams);
        teams.forEach(team => {
          console.log(`   Team: ${team.name}, Captain:`, team.captain);
        });
        setMyTeams(teams);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamInvitations = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/teams/invitations/my-invitations`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setTeamInvitations(response.data.data.invitations || []);
      }
    } catch (error) {
      console.error('Error fetching team invitations:', error);
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
        toast.success('Friend request sent! 🎮', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        
        // Update player status locally immediately
        setPlayers(players.map(p => 
          (p._id === playerId || p.id === playerId) ? { ...p, friendRequestSent: true } : p
        ));
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
        // If already friends, update the local state
        if (errorCode === 'ALREADY_FRIENDS') {
          setPlayers(players.map(p => 
            (p._id === playerId || p.id === playerId) ? { ...p, isFriend: true } : p
          ));
        }
      } else {
        toast.error(errorMessage, {
          duration: 3000,
          position: 'top-center'
        });
      }
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
        toast.success('Challenge sent! ⚔️', {
          duration: 3000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #00f0ff'
          }
        });
      }
    } catch (error) {
      console.error('Error sending challenge:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to send challenge', {
        duration: 3000,
        position: 'top-center'
      });
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
              <div className="flex items-center gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
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
                
                {/* Refresh Button */}
                <button
                  onClick={fetchPlayers}
                  disabled={loading}
                  className="px-4 py-2 bg-gaming-neon hover:bg-gaming-neon-blue text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh players list"
                >
                  <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">Refresh</span>
                </button>
              </div>
            </div>

            {/* Players List */}
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading players...</div>
            ) : (
              <div className="bg-gaming-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gaming-charcoal">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Player</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Level</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Wins</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-400">Games</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gaming-border">
                      {players.map((player) => (
                        <tr key={player._id} className="hover:bg-gaming-charcoal/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <UserAvatar user={player} size="sm" />
                              <span className="text-white font-medium">{player.username}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{player.level || 1}</td>
                          <td className="px-4 py-3 text-gaming-neon">{player.rank || 'Unranked'}</td>
                          <td className="px-4 py-3 text-gray-300">{player.wins || 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(player.games || []).slice(0, 3).map(game => (
                                <span key={game} className="px-2 py-0.5 bg-gaming-neon/20 text-gaming-neon text-xs rounded">
                                  {game.toUpperCase()}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => navigate(`/player/${player.username}`)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                                title="View Profile"
                              >
                                <FiEye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleActionWithLogin(sendFriendRequest, player._id || player.id)}
                                disabled={player.friendRequestSent || player.isFriend}
                                className={`px-3 py-1 text-sm rounded transition-colors ${
                                  player.isFriend
                                    ? 'bg-green-600/30 text-green-400 cursor-not-allowed border border-green-500/50'
                                    : player.friendRequestSent
                                    ? 'bg-yellow-600/30 text-yellow-400 cursor-not-allowed border border-yellow-500/50'
                                    : 'bg-gaming-gold hover:bg-yellow-500 text-black'
                                }`}
                                title={player.isFriend ? 'Friends' : player.friendRequestSent ? 'Request Pending' : 'Add Friend'}
                              >
                                {player.isFriend ? <FiCheckCircle className="w-4 h-4" /> : player.friendRequestSent ? <FiCheck className="w-4 h-4" /> : <FiUserPlus className="w-4 h-4" />}
                              </button>
                              
                              {/* Challenge Button with Dropdown */}
                              <div className="relative challenge-menu-container">
                                <button
                                  onClick={() => setOpenChallengeMenu(openChallengeMenu === player._id ? null : player._id)}
                                  className="px-3 py-1 bg-gaming-neon hover:bg-gaming-neon-blue text-white text-sm rounded transition-colors"
                                  title="Challenge"
                                >
                                  <FiTarget className="w-4 h-4" />
                                </button>
                                
                                {/* Dropdown Menu */}
                                {openChallengeMenu === player._id && (
                                  <div className="absolute right-0 mt-2 w-40 bg-gaming-charcoal border border-gaming-border rounded-lg shadow-xl z-50 overflow-hidden">
                                    <button
                                      onClick={() => {
                                        setOpenChallengeMenu(null);
                                        handleActionWithLogin(() => sendChallenge(player._id || player.id, 'bgmi'));
                                      }}
                                      className="w-full px-3 py-2 text-left text-white hover:bg-gaming-dark transition-colors flex items-center space-x-2 text-sm"
                                    >
                                      <span>🎮</span>
                                      <span>BGMI</span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenChallengeMenu(null);
                                        handleActionWithLogin(() => sendChallenge(player._id || player.id, 'cs2'));
                                      }}
                                      className="w-full px-3 py-2 text-left text-white hover:bg-gaming-dark transition-colors flex items-center space-x-2 text-sm"
                                    >
                                      <span>🔫</span>
                                      <span>CS2</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {players.length === 0 && (
                  <div className="text-center py-12">
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

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <MyTeamsTab
            teams={myTeams}
            invitations={teamInvitations}
            loading={loading}
            onRefresh={() => {
              fetchMyTeams();
              fetchTeamInvitations();
            }}
            token={token}
          />
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="space-y-6">
            <div className="card-gaming p-8 text-center">
              <FiTarget className="w-16 h-16 text-gaming-neon mx-auto mb-4" />
              <h3 className="text-white text-xl font-bold mb-2">Challenges Coming Soon!</h3>
              <p className="text-gray-400 mb-4">
                Challenge your friends to epic battles. This feature is under development.
              </p>
              <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gaming-neon/20 text-gaming-neon rounded-lg">
                <span className="text-sm">🎮 Stay tuned for updates!</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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

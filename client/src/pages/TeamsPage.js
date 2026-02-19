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
  FiRefreshCw,
  FiUserMinus
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
  const [friendFilter, setFriendFilter] = useState('all'); // 'all', 'friends', 'requested'
  const [myFriends, setMyFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const playersPerPage = 20;

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
      if (isAuthenticated) {
        fetchMyFriends();
        fetchSentRequests();
      }
    } else if (activeTab === 'friends') {
      fetchFriendRequests();
    } else if (activeTab === 'teams') {
      fetchMyTeams();
      fetchTeamInvitations();
    }
  }, [activeTab, selectedGame, searchQuery, currentPage]);

  // Reset to page 1 when filters change (but not when page changes)
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGame, searchQuery, friendFilter]);

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

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  // Friend Request Functions
  const acceptFriendRequest = async (requestId) => {
    try {
      await axios.post(
        `${API_URL}/api/users/friend-request/${requestId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Friend request accepted!');
      fetchFriendRequests(); // Refresh the list
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to accept request');
    }
  };

  const rejectFriendRequest = async (requestId) => {
    try {
      await axios.post(
        `${API_URL}/api/users/friend-request/${requestId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Friend request rejected');
      fetchFriendRequests(); // Refresh the list
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to reject request');
    }
  };

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
          game: selectedGame !== 'all' ? selectedGame : undefined,
          page: currentPage,
          limit: playersPerPage,
          fresh: 'true' // Always fetch fresh data to avoid cache issues
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      } : {
        params: {
          search: searchQuery,
          game: selectedGame !== 'all' ? selectedGame : undefined,
          page: currentPage,
          limit: playersPerPage
        }
      };
      
      const response = await axios.get(endpoint, config);
      
      if (response.data.success) {
        const { players, pagination } = response.data.data;
        console.log('Fetched players:', players.length);
        console.log('Pagination:', pagination);
        console.log('Cached:', response.data.cached);
        
        // Log friend status for each player
        players.forEach(p => {
          console.log(`Player: ${p.username}, isFriend: ${p.isFriend}, friendRequestSent: ${p.friendRequestSent}`);
        });
        
        setPlayers(players || []);
        
        // Update pagination state from backend response
        if (pagination) {
          setTotalPages(pagination.totalPages);
          setTotalPlayers(pagination.totalPlayers);
        }
      }
    } catch (error) {
      console.error('Error fetching players:', error);
      // Show error to user
      setPlayers([]);
      setTotalPages(1);
      setTotalPlayers(0);
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
        params: {
          fresh: 'true' // Always fetch fresh data to avoid cache issues
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        console.log('Fetched friend requests:', response.data.data.requests.length);
        console.log('Cached:', response.data.cached);
        setFriendRequests(response.data.data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyFriends = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/users/friends`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success || response.data.friends) {
        const friendsList = response.data.friends || response.data.data?.friends || [];
        setMyFriends(friendsList);
        console.log('Fetched friends:', friendsList.length);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      setMyFriends([]);
    }
  };

  const fetchSentRequests = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.get(`${API_URL}/api/users/friend-requests/sent`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success || response.data.data) {
        const requests = response.data.data?.requests || [];
        setSentRequests(requests);
        console.log('Fetched sent requests:', requests.length);
      }
    } catch (error) {
      console.error('Error fetching sent requests:', error);
      setSentRequests([]);
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
        console.log('Fetched teams:', teams.length);
        console.log('Cached:', response.data.cached);
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
        console.log('Fetched team invitations:', response.data.data.invitations.length);
        console.log('Cached:', response.data.cached);
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

  const cancelFriendRequest = async (playerId) => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      // First find the request ID
      const requestsResponse = await axios.get(`${API_URL}/api/users/friend-requests/sent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const sentRequest = requestsResponse.data.data?.requests?.find(
        req => req.recipient._id === playerId || req.recipient.id === playerId
      );
      
      if (!sentRequest) {
        toast.error('Friend request not found');
        return;
      }
      
      const response = await axios.post(
        `${API_URL}/api/users/friend-request/${sentRequest._id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Friend request cancelled', {
          duration: 2000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #FFD700'
          }
        });
        
        // Update local state
        setPlayers(players.map(p => 
          (p._id === playerId || p.id === playerId) ? { ...p, friendRequestSent: false } : p
        ));
      }
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to cancel request');
    }
  };

  const unfriend = async (playerId) => {
    if (!window.confirm('Are you sure you want to unfriend this player?')) {
      return;
    }
    
    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      const response = await axios.post(
        `${API_URL}/api/users/unfriend/${playerId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        toast.success('Friend removed', {
          duration: 2000,
          position: 'top-center',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '1px solid #ef4444'
          }
        });
        
        // Update local state
        setPlayers(players.map(p => 
          (p._id === playerId || p.id === playerId) ? { ...p, isFriend: false } : p
        ));
      }
    } catch (error) {
      console.error('Error unfriending:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to unfriend');
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-gaming font-bold text-white mb-1 md:mb-2">
            Teams & Players
          </h1>
          <p className="text-xs md:text-sm text-gray-400">
            Find players, send friend requests, and challenge opponents
          </p>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto space-x-2 md:space-x-4 mb-6 border-b border-gaming-border pb-3 md:pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-2 md:px-4 font-medium transition-colors flex items-center space-x-1 md:space-x-2 whitespace-nowrap text-xs md:text-sm ${
                activeTab === tab.id
                  ? 'text-gaming-gold border-b-2 border-gaming-gold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Players Tab */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="card-gaming p-4 md:p-6">
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                  {/* Search */}
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search players by username..."
                      className="w-full pl-10 pr-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none text-sm md:text-base"
                    />
                  </div>

                  {/* Friend Filter */}
                  <div className="relative">
                    <FiUsers className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <select
                      value={friendFilter}
                      onChange={(e) => setFriendFilter(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none text-sm md:text-base"
                      disabled={!isAuthenticated}
                    >
                      <option value="all">All Players</option>
                      <option value="friends">My Friends</option>
                      <option value="requested">Requested Friends</option>
                    </select>
                  </div>

                  {/* Game Filter */}
                  <div className="relative">
                    <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <select
                      value={selectedGame}
                      onChange={(e) => setSelectedGame(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gaming-charcoal border border-gaming-border rounded-lg text-white focus:border-gaming-gold focus:outline-none text-sm md:text-base"
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
                  onClick={() => {
                    fetchPlayers();
                    if (isAuthenticated) {
                      fetchMyFriends();
                      fetchSentRequests();
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-gaming-neon hover:bg-gaming-neon-blue text-white rounded-lg transition-colors flex items-center justify-center md:justify-start space-x-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
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
              <div className="bg-gaming-card rounded-lg overflow-hidden border border-gaming-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm md:text-base">
                    <thead className="bg-gaming-charcoal">
                      <tr>
                        <th className="px-2 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-400">Player</th>
                        <th className="hidden sm:table-cell px-2 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-400">Email</th>
                        <th className="hidden sm:table-cell px-2 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-400">Level</th>
                        <th className="hidden md:table-cell px-2 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-400">Rank</th>
                        <th className="hidden lg:table-cell px-2 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-400">Wins</th>
                        <th className="hidden lg:table-cell px-2 md:px-4 py-3 text-left text-xs md:text-sm font-medium text-gray-400">Games</th>
                        <th className="px-2 md:px-4 py-3 text-right text-xs md:text-sm font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gaming-border">
                      {(() => {
                        // Apply friend filter (frontend filtering for friend status)
                        let filteredPlayers = players;
                        
                        if (friendFilter === 'friends' && isAuthenticated) {
                          const friendIds = myFriends.map(f => f._id || f.id);
                          filteredPlayers = players.filter(p => friendIds.includes(p._id || p.id));
                        } else if (friendFilter === 'requested' && isAuthenticated) {
                          const requestedIds = sentRequests.map(r => r.recipient?._id || r.recipient?.id);
                          filteredPlayers = players.filter(p => requestedIds.includes(p._id || p.id));
                        }
                        
                        // No need to slice here - backend already sent paginated data
                        return filteredPlayers.map((player) => (
                          <tr key={player._id} className="hover:bg-gaming-charcoal/50 transition-colors">
                            <td className="px-2 md:px-4 py-3">
                              <div className="flex items-center space-x-2 md:space-x-3">
                                <UserAvatar user={player} size="sm" />
                                <span className="text-white font-medium text-xs md:text-base truncate">{player.username}</span>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-2 md:px-4 py-3 text-gray-300 text-xs md:text-base truncate">{player.email || 'N/A'}</td>
                            <td className="hidden sm:table-cell px-2 md:px-4 py-3 text-gray-300 text-xs md:text-base">{player.level || 1}</td>
                            <td className="hidden md:table-cell px-2 md:px-4 py-3 text-gaming-neon text-xs md:text-base">{player.rank || 'Unranked'}</td>
                            <td className="hidden lg:table-cell px-2 md:px-4 py-3 text-gray-300 text-xs md:text-base">{player.wins || 0}</td>
                            <td className="hidden lg:table-cell px-2 md:px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {(player.games || []).slice(0, 3).map(game => (
                                  <span key={game} className="px-2 py-0.5 bg-gaming-neon/20 text-gaming-neon text-xs rounded">
                                    {game.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-2 md:px-4 py-3">
                              <div className="flex justify-end space-x-1 md:space-x-2">
                                <button
                                  onClick={() => navigate(`/player/${player.username}`)}
                                  className="px-2 md:px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm rounded transition-colors"
                                  title="View Profile"
                                >
                                  <FiEye className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                                
                                {/* Friend Status Button */}
                                {player.isFriend ? (
                                  <button
                                    onClick={() => handleActionWithLogin(unfriend, player._id || player.id)}
                                    className="px-2 md:px-3 py-1 bg-red-600/80 hover:bg-red-700 text-white text-xs md:text-sm rounded transition-colors"
                                    title="Unfriend"
                                  >
                                    <FiUserMinus className="w-3 h-3 md:w-4 md:h-4" />
                                  </button>
                                ) : player.friendRequestSent ? (
                                  <button
                                    onClick={() => handleActionWithLogin(cancelFriendRequest, player._id || player.id)}
                                    className="px-2 md:px-3 py-1 bg-yellow-600/80 hover:bg-yellow-700 text-white text-xs md:text-sm rounded transition-colors"
                                    title="Cancel Request"
                                  >
                                    <FiX className="w-3 h-3 md:w-4 md:h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleActionWithLogin(sendFriendRequest, player._id || player.id)}
                                    className="px-2 md:px-3 py-1 bg-gaming-gold hover:bg-yellow-500 text-black text-xs md:text-sm rounded transition-colors"
                                    title="Add Friend"
                                  >
                                    <FiUserPlus className="w-3 h-3 md:w-4 md:h-4" />
                                  </button>
                                )}
                                
                                {/* Challenge Button with Dropdown */}
                                <div className="relative challenge-menu-container">
                                  <button
                                    onClick={() => setOpenChallengeMenu(openChallengeMenu === player._id ? null : player._id)}
                                    className="px-2 md:px-3 py-1 bg-gaming-neon hover:bg-gaming-neon-blue text-white text-xs md:text-sm rounded transition-colors"
                                    title="Challenge"
                                  >
                                    <FiTarget className="w-3 h-3 md:w-4 md:h-4" />
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
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  let filteredPlayers = players;
                  if (friendFilter === 'friends' && isAuthenticated) {
                    const friendIds = myFriends.map(f => f._id || f.id);
                    filteredPlayers = players.filter(p => friendIds.includes(p._id || p.id));
                  } else if (friendFilter === 'requested' && isAuthenticated) {
                    const requestedIds = sentRequests.map(r => r.recipient?._id || r.recipient?.id);
                    filteredPlayers = players.filter(p => requestedIds.includes(p._id || p.id));
                  }
                  
                  return filteredPlayers.length === 0 && (
                    <div className="text-center py-12">
                      <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">
                        {friendFilter === 'friends' ? 'No friends found' : 
                         friendFilter === 'requested' ? 'No requested friends found' : 
                         'No players found'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="card-gaming p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-400">
                  Showing {((currentPage - 1) * playersPerPage) + 1} to {Math.min(currentPage * playersPerPage, totalPlayers)} of {totalPlayers} players
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gaming-charcoal border border-gaming-border rounded-lg text-white hover:bg-gaming-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                      
                      if (endPage - startPage < maxVisiblePages - 1) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }
                      
                      if (startPage > 1) {
                        pages.push(
                          <button
                            key={1}
                            onClick={() => setCurrentPage(1)}
                            className="px-3 py-1 bg-gaming-charcoal border border-gaming-border rounded-lg text-white hover:bg-gaming-dark transition-colors"
                          >
                            1
                          </button>
                        );
                        if (startPage > 2) {
                          pages.push(<span key="ellipsis1" className="text-gray-400 px-2">...</span>);
                        }
                      }
                      
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`px-3 py-1 rounded-lg transition-colors ${
                              currentPage === i
                                ? 'bg-gaming-gold text-black font-medium'
                                : 'bg-gaming-charcoal border border-gaming-border text-white hover:bg-gaming-dark'
                            }`}
                          >
                            {i}
                          </button>
                        );
                      }
                      
                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(<span key="ellipsis2" className="text-gray-400 px-2">...</span>);
                        }
                        pages.push(
                          <button
                            key={totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            className="px-3 py-1 bg-gaming-charcoal border border-gaming-border rounded-lg text-white hover:bg-gaming-dark transition-colors"
                          >
                            {totalPages}
                          </button>
                        );
                      }
                      
                      return pages;
                    })()}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gaming-charcoal border border-gaming-border rounded-lg text-white hover:bg-gaming-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Friend Requests Tab */}
        {activeTab === 'friends' && (
          <div className="space-y-6">
            {/* Refresh Button */}
            <div className="flex justify-end">
              <button
                onClick={fetchFriendRequests}
                disabled={loading}
                className="px-4 py-2 bg-gaming-neon hover:bg-gaming-neon-blue text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh friend requests"
              >
                <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading requests...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {friendRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    onAccept={acceptFriendRequest}
                    onReject={rejectFriendRequest}
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
            currentUser={user}
            isAuthenticated={isAuthenticated}
            navigate={navigate}
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
const FriendRequestCard = ({ request, onAccept, onReject }) => {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onAccept(request.id);
    } catch (error) {
      console.error('Error accepting friend request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onReject(request.id);
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    } finally {
      setLoading(false);
    }
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
          disabled={loading}
          className="flex-1 flex items-center justify-center space-x-2 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <FiCheck className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">Accept</span>
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex-1 flex items-center justify-center space-x-2 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <FiX className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">Reject</span>
        </button>
      </div>
    </motion.div>
  );
};

export default TeamsPage;

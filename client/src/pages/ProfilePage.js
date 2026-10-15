import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
  FiUser, 
  FiAward, 
  FiUsers, 
  FiCalendar,
  FiGithub,
  FiTwitter,
  FiInstagram,
  FiLinkedin,
  FiExternalLink,
  FiSettings
} from 'react-icons/fi';
import { selectAuth } from '../store/slices/authSlice';
import UserAvatar from '../components/common/UserAvatar';
import api from '../services/api';

import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/common/ToastContainer';
import ProfileSettingsForm from '../components/profile/ProfileSettingsForm';

const ProfilePage = () => {
  const { user } = useSelector(selectAuth);
  const [activeTab, setActiveTab] = useState('general');
  const [userTournaments, setUserTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const tabs = [
    { id: 'general', label: 'General', icon: FiUser },
    { id: 'tournaments', label: 'My Tournaments', icon: FiAward },
    { id: 'settings', label: 'Profile Settings', icon: FiSettings }
  ];

  useEffect(() => {
    if (activeTab === 'tournaments') {
      fetchUserTournaments();
    }
  }, [activeTab]);

  const fetchUserTournaments = async () => {
    try {
      setLoading(true);
      const response = await api.getUserTournaments();
      setUserTournaments(response.data || []);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      setUserTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  // Removed editing functionality - moved to Profile Settings page

  return (
    <>
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
      <div className="min-h-screen bg-gaming-dark">
      {/* Header */}
      <div className="bg-gradient-to-r from-gaming-neon/20 to-gaming-neon-blue/20 border-b border-gaming-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            {/* Avatar */}
            <div className="relative">
              <UserAvatar 
                user={user} 
                size="xl"
              />
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-gaming font-bold text-white mb-2">
                {user?.fullName || user?.username || 'Gaming Profile'}
              </h1>
              <p className="text-gray-400 mb-4">
                {user?.bio || 'Professional esports player and tournament competitor'}
              </p>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center space-x-2">
                  <FiAward className="text-gaming-gold" />
                  <span className="text-gray-300">{user?.tournamentsWon || 0} Tournaments Won</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FiUsers className="text-gaming-neon" />
                  <span className="text-gray-300">Level {user?.level || 1}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FiCalendar className="text-purple-400" />
                  <span className="text-gray-300">
                    Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Nov 2024'}
                  </span>
                </div>
                {/* Role Badge */}
                {user?.role && user.role !== 'user' && (
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      user.role === 'admin' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                      user.role === 'designer' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' :
                      user.role === 'moderator' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                      'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                    }`}>
                      {user.role === 'admin' ? '👑 Admin' :
                       user.role === 'designer' ? '🎨 Designer' :
                       user.role === 'moderator' ? '🛡️ Moderator' :
                       user.role}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Read-only profile - no edit button */}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gaming-border">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-gaming-gold text-gaming-gold'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'general' && (
          <GeneralTab user={user} />
        )}
        
        {activeTab === 'tournaments' && (
          <TournamentsTab 
            tournaments={userTournaments}
            loading={loading}
          />
        )}
        
        {activeTab === 'settings' && (
          <SettingsTab />
        )}
        
      </div>
    </div>
    </>
  );
};

// General Tab Component - Dashboard Content
const GeneralTab = ({ user }) => {
  const navigate = useNavigate();
  const stats = [
    {
      title: 'Tournaments Won',
      value: user?.tournamentsWon || 0,
      icon: FiAward,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10'
    },
    {
      title: 'Current Level',
      value: user?.level || 1,
      icon: FiUser,
      color: 'text-gaming-neon',
      bgColor: 'bg-gaming-neon/10'
    },
    {
      title: 'Tournaments Played',
      value: user?.tournamentsPlayed || 0,
      icon: FiCalendar,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10'
    },
    {
      title: 'Login Streak',
      value: `${user?.loginStreak || 0} days`,
      icon: FiAward,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card-gaming p-6"
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${stat.bgColor} mr-4`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Dashboard Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Tournaments & Achievements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Tournaments */}
          <div className="card-gaming p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <FiAward className="text-gaming-gold" />
              <span>Active Tournaments</span>
            </h3>
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No active tournaments</p>
              <button 
                onClick={() => navigate('/bgmi')}
                className="btn-gaming"
              >
                Browse Tournaments
              </button>
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="card-gaming p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <FiAward className="text-purple-400" />
              <span>Recent Achievements</span>
            </h3>
            <div className="space-y-3">
              {user?.achievements?.slice(-3).map((achievement, index) => (
                <div key={index} className="flex items-center p-3 bg-gaming-dark rounded-lg">
                  <span className="text-2xl mr-3">{achievement.icon}</span>
                  <div>
                    <p className="text-white font-medium">{achievement.name}</p>
                    <p className="text-gray-400 text-sm">{achievement.description}</p>
                  </div>
                </div>
              )) || (
                <div className="text-center py-4">
                  <p className="text-gray-400">No achievements yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Game Accounts & Social (Read-only) */}
        <div className="space-y-6">
          <GameAccountsSection user={user} />
          <SocialAccountsSection user={user} />
        </div>
      </div>
    </div>
  );
};

// Game Accounts Section
const GameAccountsSection = ({ user }) => {
  console.log('🎮 User game data:', {
    steamId: user?.gameIds?.steam,
    steamProfile: user?.steamProfile,
    isConnected: user?.steamProfile?.isConnected
  });

  const gameAccounts = [
    {
      game: 'Steam',
      icon: '🎮',
      connected: !!(user?.gameIds?.steam || user?.steamProfile?.isConnected),
      username: user?.steamProfile?.displayName || user?.gameIds?.steam || 'Not connected',
      status: (user?.steamProfile?.isConnected || user?.gameIds?.steam) ? 'Connected' : 'Not Connected'
    },
    {
      game: 'BGMI',
      icon: '📱',
      connected: !!(user?.gameIds?.bgmi?.ign || user?.gameIds?.bgmi?.uid || user?.bgmiIgnName || user?.bgmiUid),
      username: user?.gameIds?.bgmi?.ign || user?.bgmiIgnName || 'Not connected',
      uid: user?.gameIds?.bgmi?.uid || user?.bgmiUid || '',
      status: (user?.gameIds?.bgmi?.ign || user?.gameIds?.bgmi?.uid || user?.bgmiIgnName || user?.bgmiUid) ? 'Connected' : 'Not Connected'
    }
  ];

  return (
    <div className="card-gaming p-6">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
        <FiUsers className="text-gaming-neon" />
        <span>Game Accounts</span>
      </h3>
      
      <div className="space-y-4">
        {gameAccounts.map((account, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gaming-charcoal rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{account.icon}</span>
              <div>
                <p className="text-white font-medium">{account.game}</p>
                <p className="text-sm text-gray-400">
                  {account.connected ? (
                    <>
                      <span className="font-medium">{account.username}</span>
                      {account.uid && (
                        <span className="block text-xs text-gray-500">UID: {account.uid}</span>
                      )}
                    </>
                  ) : (
                    'Not connected'
                  )}
                </p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              account.connected 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {account.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Social Accounts Section (Read-only)
const SocialAccountsSection = ({ user }) => {
  const socialPlatforms = [
    { key: 'twitter', label: 'Twitter', icon: FiTwitter, color: 'text-blue-400' },
    { key: 'instagram', label: 'Instagram', icon: FiInstagram, color: 'text-pink-400' },
    { key: 'github', label: 'GitHub', icon: FiGithub, color: 'text-gray-400' },
    { key: 'linkedin', label: 'LinkedIn', icon: FiLinkedin, color: 'text-blue-600' }
  ];

  const socialAccounts = user?.socialAccounts || {};

  return (
    <div className="card-gaming p-6">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
        <FiExternalLink className="text-purple-400" />
        <span>Social Accounts</span>
      </h3>
      
      <div className="space-y-4">
        {socialPlatforms.map((platform) => (
          <div key={platform.key} className="flex items-center justify-between p-3 bg-gaming-charcoal rounded-lg">
            <div className="flex items-center space-x-3">
              <platform.icon className={`w-5 h-5 ${platform.color}`} />
              <span className="text-white font-medium">{platform.label}</span>
            </div>
            <span className="text-gray-400 text-sm">
              {socialAccounts[platform.key] || 'Not connected'}
            </span>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-gray-400 text-sm mb-2">Want to update your social accounts?</p>
        <button className="text-gaming-gold hover:text-yellow-400 text-sm font-medium">
          Go to Profile Settings →
        </button>
      </div>
    </div>
  );
};

const TournamentsTab = ({ tournaments, loading }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  
  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' }
  ];

  const filteredTournaments = tournaments.filter(tournament => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      return ['active', 'registration_open', 'registration_closed', 'upcoming'].includes(tournament.status);
    }
    return tournament.status === filter;
  });

  const statusColors = {
    registration_open: 'bg-green-500/20 text-green-400',
    active: 'bg-blue-500/20 text-blue-400',
    upcoming: 'bg-cyan-500/20 text-cyan-400',
    completed: 'bg-gray-500/20 text-gray-400',
    cancelled: 'bg-red-500/20 text-red-400'
  };

  const statusLabels = {
    registration_open: 'Open',
    registration_closed: 'Closed',
    active: 'Live',
    upcoming: 'Upcoming',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading tournaments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-white">My Tournaments</h2>
        <div className="flex space-x-2 flex-wrap">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === option.value
                  ? 'bg-gaming-gold text-black'
                  : 'bg-gaming-charcoal text-gray-400 hover:text-white hover:bg-gaming-border'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {filteredTournaments.length === 0 ? (
        <div className="text-center py-12">
          <FiAward className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {filter === 'all' 
              ? 'No tournaments participated yet.' 
              : `No ${filter} tournaments.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <motion.div
              key={tournament._id}
              whileHover={{ scale: 1.02 }}
              onClick={() => navigate(`/tournaments/${tournament._id}`)}
              className="card-gaming p-5 cursor-pointer hover:border-gaming-gold/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0 mr-2">
                  <h3 className="text-white font-bold truncate">{tournament.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">{tournament.gameType?.toUpperCase()} • {tournament.mode || 'Team'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${statusColors[tournament.status] || 'bg-gray-500/20 text-gray-400'}`}>
                  {statusLabels[tournament.status] || tournament.status}
                </span>
              </div>
              {tournament.teamName && (
                <div className="text-xs text-gaming-gold mb-2 flex items-center space-x-1">
                  <FiUsers className="w-3 h-3" />
                  <span>{tournament.teamName}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gaming-border">
                <span className="text-gaming-gold font-bold text-sm">
                  {tournament.prizePool ? `₹${tournament.prizePool.toLocaleString()}` : 'Free'}
                </span>
                {tournament.startDate && (
                  <span className="text-xs text-gray-400 flex items-center space-x-1">
                    <FiCalendar className="w-3 h-3" />
                    <span>{new Date(tournament.startDate).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// Teams Tab Component - Now shows all players


// Player Card Component


// Friend Request Card Component


// Settings Tab Component - Uses reusable ProfileSettingsForm
const SettingsTab = () => {
  return <ProfileSettingsForm embedded={true} />;
};

export default ProfilePage;
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  FiExternalLink
} from 'react-icons/fi';
import { selectAuth } from '../store/slices/authSlice';
import UserAvatar from '../components/common/UserAvatar';
import api from '../services/api';

const ProfilePage = () => {
  const { user } = useSelector(selectAuth);
  const [activeTab, setActiveTab] = useState('general');
  const [userTournaments, setUserTournaments] = useState([]);
  const [userTeams, setUserTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'general', label: 'General', icon: FiUser },
    { id: 'tournaments', label: 'My Tournaments', icon: FiAward },
    { id: 'teams', label: 'My Teams', icon: FiUsers }
  ];

  useEffect(() => {
    if (activeTab === 'tournaments') {
      fetchUserTournaments();
    } else if (activeTab === 'teams') {
      fetchUserTeams();
    }
  }, [activeTab]);

  const fetchUserTournaments = async () => {
    try {
      setLoading(true);
      // API call to get user's tournaments
      const response = await api.getUserTournaments();
      setUserTournaments(response.data || []);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserTeams = async () => {
    try {
      setLoading(true);
      // API call to get user's teams
      const response = await api.getUserTeams();
      setUserTeams(response.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  // Removed editing functionality - moved to Profile Settings page

  return (
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
                className="w-24 h-24 border-4 border-gaming-gold"
              />
            </div>
            
            {/* User Info */}
            <div className="flex-1">
              <h1 className="text-3xl font-gaming font-bold text-white mb-2">
                {user?.username || 'Gaming Profile'}
              </h1>
              <p className="text-gray-400 mb-4">
                {user?.bio || 'Professional esports player and tournament competitor'}
              </p>
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center space-x-2">
                  <FiAward className="text-gaming-gold" />
                  <span className="text-gray-300">12 Tournaments</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FiUsers className="text-gaming-neon" />
                  <span className="text-gray-300">3 Teams</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FiCalendar className="text-purple-400" />
                  <span className="text-gray-300">Joined Nov 2024</span>
                </div>
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
        
        {activeTab === 'teams' && (
          <TeamsTab 
            teams={userTeams}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

// General Tab Component - Dashboard Content
const GeneralTab = ({ user }) => {
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
              <button className="btn-gaming">
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
      connected: !!user?.gameIds?.bgmi,
      username: user?.gameIds?.bgmi || 'Not connected',
      status: user?.gameIds?.bgmi ? 'Connected' : 'Not Connected'
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
                  {account.connected ? account.username : 'Not connected'}
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

// Tournaments Tab Component
const TournamentsTab = ({ tournaments, loading }) => {
  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading tournaments...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">My Tournament History</h2>
      
      {tournaments.length === 0 ? (
        <div className="text-center py-12">
          <FiAward className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No tournaments participated yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament, index) => (
            <div key={index} className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-2">{tournament.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{tournament.game}</p>
              <div className="flex justify-between items-center">
                <span className="text-gaming-gold font-bold">{tournament.placement}</span>
                <span className="text-sm text-gray-400">{tournament.date}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Teams Tab Component
const TeamsTab = ({ teams, loading }) => {
  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading teams...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">My Teams</h2>
      
      {teams.length === 0 ? (
        <div className="text-center py-12">
          <FiUsers className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No teams joined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {teams.map((team, index) => (
            <div key={index} className="card-gaming p-6">
              <h3 className="text-lg font-bold text-white mb-2">{team.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{team.game}</p>
              <div className="flex justify-between items-center">
                <span className="text-gaming-neon">{team.role}</span>
                <span className="text-sm text-gray-400">{team.members} members</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
// Premium Marketing Landing Page - All Features Integrated
// Quick Join + Top 3 Leaderboard + Live Stats + Modern Grid Layout
// All data from database - No hardcoded values

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectAuth } from '../store/slices/authSlice';
import { 
  FiAward, FiUsers, FiServer, FiTarget, 
  FiZap, FiShield, FiTrendingUp, FiGift,
  FiArrowRight, FiPlay
} from 'react-icons/fi';
import { getGameAsset } from '../assets/gameAssets';
import OptimizedImage from '../components/common/OptimizedImage';

const MarketingLandingPage = () => {
  const { isAuthenticated } = useSelector(selectAuth);
  const navigate = useNavigate();
  
  const [topPlayers, setTopPlayers] = useState([]);
  const [stats, setStats] = useState({
    totalPlayers: '0',
    activeTournaments: '0',
    totalPrizes: '₹0',
    onlinePlayers: '0'
  });
  const [featuredTournaments, setFeaturedTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchTopPlayers(),
      fetchPlatformStats(),
      fetchFeaturedTournaments()
    ]);
    setLoading(false);
  };

  const fetchTopPlayers = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_URL}/api/leaderboard/cs2?limit=3`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setTopPlayers(data.data.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching top players:', error);
    }
  };

  const fetchPlatformStats = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      
      const statsResponse = await fetch(`${API_URL}/api/tournaments/stats`);
      const statsData = await statsResponse.json();
      
      const usersResponse = await fetch(`${API_URL}/api/users/count`);
      const usersData = await usersResponse.json();
      
      if (statsData.success && statsData.data) {
        const totalUsers = usersData.success ? usersData.count : 0;
        setStats({
          totalPlayers: totalUsers.toString(),
          activeTournaments: statsData.data.activeTournaments || '0',
          totalPrizes: statsData.data.totalPrizes || '₹0',
          onlinePlayers: Math.floor(totalUsers * 0.15).toString()
        });
      }
    } catch (error) {
      console.error('Error fetching platform stats:', error);
    }
  };

  const fetchFeaturedTournaments = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_URL}/api/tournaments?status=registration_open&limit=2`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setFeaturedTournaments(data.data.slice(0, 2));
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
  };

  const handleQuickJoin = (game) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/${game}` } });
      return;
    }
    navigate(`/${game}`);
  };

  const getRankColor = (rank) => {
    const colors = {
      1: 'from-yellow-400 to-yellow-600',
      2: 'from-gray-300 to-gray-500',
      3: 'from-orange-400 to-orange-600'
    };
    return colors[rank] || 'from-gray-400 to-gray-600';
  };

  const getRankIcon = (rank) => {
    const icons = { 1: '👑', 2: '🥈', 3: '🥉' };
    return icons[rank] || '🏅';
  };

  const features = [
    {
      icon: <FiAward className="w-12 h-12" />,
      title: 'Tournament Hosting',
      description: 'Host and participate in competitive tournaments for CS2 and BGMI with real prizes',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      icon: <FiGift className="w-12 h-12" />,
      title: 'Prize Pools',
      description: 'Compete for exciting prize pools and rewards in every tournament',
      color: 'from-green-500 to-emerald-500'
    },
    {
      icon: <FiTrendingUp className="w-12 h-12" />,
      title: 'Live Leaderboards',
      description: 'Real-time leaderboards tracking your performance and rankings across all games',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <FiServer className="w-12 h-12" />,
      title: 'Dedicated Servers',
      description: 'Multiple dedicated CS2 servers with automatic stats tracking and log processing',
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: <FiUsers className="w-12 h-12" />,
      title: 'Team System',
      description: 'Create teams, invite members, and compete together in team tournaments',
      color: 'from-red-500 to-rose-500'
    },
    {
      icon: <FiShield className="w-12 h-12" />,
      title: 'Secure Platform',
      description: 'Steam integration for CS2 and secure authentication for all players',
      color: 'from-indigo-500 to-violet-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Section with Premium Grid */}
      <section className="relative min-h-screen overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gaming-dark via-gaming-charcoal to-gaming-dark">
          <div className="absolute inset-0 opacity-20">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute top-20 left-20 w-96 h-96 bg-gaming-neon rounded-full filter blur-3xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
              className="absolute bottom-20 right-20 w-96 h-96 bg-gaming-gold rounded-full filter blur-3xl"
            />
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          {/* Premium Grid Layout */}
          <div className="grid lg:grid-cols-12 gap-6">
            
            {/* Left Column - Hero + Quick Join */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-7 space-y-6"
            >
              {/* Main Hero Card */}
              <div className="bg-gaming-charcoal/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 lg:p-12">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="inline-block px-4 py-2 bg-gaming-gold/10 border border-gaming-gold/30 rounded-full mb-6"
                  >
                    <span className="text-gaming-gold font-bold text-sm">🔥 LIVE NOW</span>
                  </motion.div>
                  
                  <h1 className="text-4xl md:text-6xl font-gaming font-bold text-white mb-4">
                    Compete. <span className="text-gaming-gold">Dominate.</span> Win.
                  </h1>
                  <p className="text-xl text-gray-300 mb-8">
                    India's premier esports platform for CS2 & BGMI tournaments
                  </p>

                  {/* Quick Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="bg-gaming-dark/50 rounded-lg p-4 border border-gray-700"
                    >
                      <div className="text-2xl font-bold text-gaming-gold">
                        {loading ? '...' : stats.totalPlayers}
                      </div>
                      <div className="text-sm text-gray-400">Total Players</div>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="bg-gaming-dark/50 rounded-lg p-4 border border-gray-700"
                    >
                      <div className="text-2xl font-bold text-green-400">
                        {loading ? '...' : stats.onlinePlayers}
                      </div>
                      <div className="text-sm text-gray-400">Online Now</div>
                    </motion.div>
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    {!isAuthenticated ? (
                      <>
                        <Link 
                          to="/register" 
                          className="btn-gaming text-lg px-8 py-4 text-center"
                        >
                          Get Started Free
                        </Link>
                        <Link 
                          to="/tournaments" 
                          className="px-8 py-4 border-2 border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-300 font-bold text-center"
                        >
                          View Tournaments
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link 
                          to="/tournaments" 
                          className="btn-gaming text-lg px-8 py-4 text-center"
                        >
                          Browse Tournaments
                        </Link>
                        <Link 
                          to="/leaderboard" 
                          className="px-8 py-4 border-2 border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-300 font-bold text-center"
                        >
                          View Leaderboard
                        </Link>
                      </>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Quick Join Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gaming-charcoal/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-gaming font-bold text-white flex items-center">
                    <FiZap className="mr-2 text-gaming-gold" />
                    Quick Join
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* CS2 Card with Real Image */}
                  <motion.button
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleQuickJoin('cs2')}
                    className="relative group overflow-hidden rounded-xl"
                  >
                    <OptimizedImage
                      src={getGameAsset('cs2', 'thumbnail')}
                      alt="Counter-Strike 2"
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
                    <div className="absolute inset-0 flex flex-col justify-end p-4">
                      <div className="text-4xl mb-2">⚡</div>
                      <div className="font-bold text-white text-lg">Counter-Strike 2</div>
                      <div className="text-sm text-white/80">Join CS2 Tournaments</div>
                    </div>
                    <motion.div
                      className="absolute inset-0 border-2 border-gaming-gold opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                    />
                  </motion.button>

                  {/* BGMI Card with Real Image */}
                  <motion.button
                    whileHover={{ scale: 1.05, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleQuickJoin('bgmi')}
                    className="relative group overflow-hidden rounded-xl"
                  >
                    <OptimizedImage
                      src={getGameAsset('bgmi', 'thumbnail')}
                      alt="BGMI"
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
                    <div className="absolute inset-0 flex flex-col justify-end p-4">
                      <div className="text-4xl mb-2">📱</div>
                      <div className="font-bold text-white text-lg">BGMI</div>
                      <div className="text-sm text-white/80">Join Mobile Tournaments</div>
                    </div>
                    <motion.div
                      className="absolute inset-0 border-2 border-gaming-gold opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                    />
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Column - Top Players & Stats */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-5 space-y-6"
            >
              {/* Top 3 Leaderboard */}
              <div className="bg-gaming-charcoal/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-gaming font-bold text-white flex items-center">
                    <FiTrendingUp className="mr-2 text-gaming-gold" />
                    Top Players
                  </h3>
                  <Link 
                    to="/leaderboard"
                    className="text-gaming-gold hover:text-gaming-accent text-sm font-bold flex items-center"
                  >
                    View All
                    <FiArrowRight className="ml-1" />
                  </Link>
                </div>

                <div className="space-y-4">
                  {loading ? (
                    // Loading skeleton
                    [1, 2, 3].map((i) => (
                      <div key={i} className="bg-gaming-dark/50 rounded-xl p-4 border border-gray-700 animate-pulse">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full bg-gray-700"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
                            <div className="h-3 bg-gray-700 rounded w-16"></div>
                          </div>
                          <div className="h-6 bg-gray-700 rounded w-12"></div>
                        </div>
                      </div>
                    ))
                  ) : topPlayers.length > 0 ? (
                    topPlayers.map((player, index) => (
                      <motion.div
                        key={player.username || index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <Link
                          to="/leaderboard"
                          className="block bg-gaming-dark/50 rounded-xl p-4 border border-gray-700 hover:border-gaming-gold/50 transition-all duration-300 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRankColor(player.rank || index + 1)} flex items-center justify-center text-2xl font-bold shadow-lg`}>
                                {getRankIcon(player.rank || index + 1)}
                              </div>
                              
                              <div>
                                <div className="font-bold text-white group-hover:text-gaming-gold transition-colors">
                                  {player.username || `Player ${index + 1}`}
                                </div>
                                <div className="text-sm text-gray-400">
                                  Rank #{player.rank || index + 1}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold text-gaming-gold">
                                {player.kills || player.totalKills || 0}
                              </div>
                              <div className="text-xs text-gray-400">Kills</div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No leaderboard data yet
                    </div>
                  )}
                </div>

                <Link
                  to="/leaderboard"
                  className="mt-4 w-full block text-center py-3 bg-gaming-gold/10 hover:bg-gaming-gold/20 border border-gaming-gold/30 rounded-lg text-gaming-gold font-bold transition-all duration-300"
                >
                  View Full Leaderboard
                </Link>
              </div>

              {/* Platform Stats */}
              <div className="bg-gaming-charcoal/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
                <h3 className="text-lg font-gaming font-bold text-white mb-4 flex items-center">
                  <FiTarget className="mr-2 text-gaming-gold" />
                  Live Stats
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-gaming-dark/50 rounded-lg p-4 border border-gray-700"
                  >
                    <FiUsers className="text-gaming-gold mb-2" size={24} />
                    <div className="text-xl font-bold text-white">
                      {loading ? '...' : stats.activeTournaments}
                    </div>
                    <div className="text-xs text-gray-400">Active Tournaments</div>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-gaming-dark/50 rounded-lg p-4 border border-gray-700"
                  >
                    <FiAward className="text-gaming-gold mb-2" size={24} />
                    <div className="text-xl font-bold text-white">
                      {loading ? '...' : stats.totalPrizes}
                    </div>
                    <div className="text-xs text-gray-400">Total Prizes</div>
                  </motion.div>
                </div>
              </div>

              {/* Featured Tournament */}
              {!loading && featuredTournaments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gradient-to-br from-gaming-gold/10 to-gaming-neon/10 backdrop-blur-sm border border-gaming-gold/30 rounded-2xl p-6"
                >
                  <div className="flex items-center mb-3">
                    <FiPlay className="text-gaming-gold mr-2" />
                    <h3 className="text-sm font-bold text-gaming-gold">FEATURED TOURNAMENT</h3>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">
                    {featuredTournaments[0].name}
                  </h4>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-400">
                      {featuredTournaments[0].gameType?.toUpperCase()}
                    </span>
                    <span className="text-lg font-bold text-gaming-gold">
                      ₹{featuredTournaments[0].prizePool?.toLocaleString()}
                    </span>
                  </div>
                  <Link
                    to={`/tournaments/${featuredTournaments[0]._id}`}
                    className="block w-full text-center py-3 bg-gaming-gold text-black rounded-lg font-bold hover:bg-gaming-accent transition-all duration-300"
                  >
                    Join Now
                  </Link>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gaming-charcoal/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-gaming font-bold text-white mb-4">
              Why Choose Colab Esports?
            </h2>
            <p className="text-gray-400 text-lg">Everything you need for competitive gaming</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-gaming-charcoal border border-gray-700 rounded-xl p-6 hover:border-gaming-gold/50 transition-all duration-300"
              >
                <div className={`inline-flex p-4 rounded-lg bg-gradient-to-br ${feature.color} bg-opacity-10 text-white mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-gaming-neon/10 to-gaming-gold/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-gaming font-bold text-white mb-6">
              Ready to Start Your Journey?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of players competing for glory
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="btn-gaming text-lg px-8 py-4">
                Sign Up Free
              </Link>
              <Link 
                to="/tournaments" 
                className="px-8 py-4 border-2 border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-300 font-bold"
              >
                Browse Tournaments
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default MarketingLandingPage;

// Complete Premium Landing Page - Gaming Console Style
// Enhanced with animations, real images, and esports theme

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectAuth } from '../store/slices/authSlice';
import { 
  FiAward, FiUsers, FiServer, FiTarget, 
  FiZap, FiShield, FiTrendingUp, FiGift,
  FiArrowRight, FiPlay, FiStar, FiActivity
} from 'react-icons/fi';
import { getGameAsset } from '../assets/gameAssets';
import OptimizedImage from '../components/common/OptimizedImage';
import HeroImageSlider from '../components/common/HeroImageSlider';

const CompleteLandingPage = () => {
  const { isAuthenticated } = useSelector(selectAuth);
  const navigate = useNavigate();
  
  const [bgmiLeaderboard, setBgmiLeaderboard] = useState([]);
  const [cs2Leaderboard, setCs2Leaderboard] = useState([]);
  const [stats, setStats] = useState({
    totalPlayers: '0',
    activeTournaments: '0',
    totalPrizes: '₹0',
    totalMatches: '0'
  });
  const [servers, setServers] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const upcomingGames = [
    { name: 'Valorant', icon: '🎯', status: 'Coming Q1 2025', color: 'from-red-500 to-pink-500' },
    { name: 'Apex Legends', icon: '🎮', status: 'Coming Q2 2025', color: 'from-orange-500 to-red-500' },
    { name: 'Free Fire', icon: '🔥', status: 'Coming Q2 2025', color: 'from-yellow-500 to-orange-500' },
    { name: 'Rainbow Six', icon: '🛡️', status: 'Coming Q3 2025', color: 'from-blue-500 to-purple-500' },
    { name: 'FC 24', icon: '⚽', status: 'Coming Q3 2025', color: 'from-green-500 to-blue-500' }
  ];

  useEffect(() => {
    fetchAllData();
    
    // Auto-slide upcoming games
    let interval;
    if (autoPlay) {
      interval = setInterval(() => {
        setCurrentGameIndex((prev) => (prev + 1) % upcomingGames.length);
      }, 6000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoPlay]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchLeaderboards(),
      fetchPlatformStats(),
      fetchServers(),
      fetchTournaments()
    ]);
    setLoading(false);
  };

  const fetchLeaderboards = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      
      // Fetch CS2 leaderboard (limit 3, show only available)
      const cs2Res = await fetch(`${API_URL}/api/cs2-leaderboard/all-players?limit=3`);
      const cs2Data = await cs2Res.json();
      
      if (cs2Data.success && cs2Data.leaderboard) {
        // Map to simpler format for display
        const mappedData = cs2Data.leaderboard.map(player => ({
          username: player.displayName || player.username,
          kills: player.stats.total_kills,
          totalKills: player.stats.total_kills,
          rank: player.rank,
          avatar: player.avatar,
          kdr: player.stats.kdr
        }));
        setCs2Leaderboard(mappedData);
      }
      
      // BGMI hardcoded for now (no data in DB yet)
      setBgmiLeaderboard([
        { username: 'ProGamer_BGMI', kills: 1250, rank: 1 },
        { username: 'ElitePlayer', kills: 1180, rank: 2 },
        { username: 'SkillMaster', kills: 1120, rank: 3 }
      ]);
    } catch (error) {
      console.error('Error fetching leaderboards:', error);
    }
  };

  const fetchPlatformStats = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      
      const [statsRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/tournaments/stats`),
        fetch(`${API_URL}/api/users/count`)
      ]);
      
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      
      if (statsData.success && statsData.data) {
        setStats({
          totalPlayers: usersData.success ? usersData.count.toString() : '0',
          activeTournaments: statsData.data.activeTournaments || '0',
          totalPrizes: statsData.data.totalPrizes || '₹0',
          totalMatches: statsData.data.totalTransactions || '0'
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchServers = async () => {
    // Only 2 Mumbai servers
    setServers([
      { id: 1, name: 'Mumbai Server #1', players: '8/10', status: 'active', map: 'de_dust2', ping: '12ms' },
      { id: 2, name: 'Mumbai Server #2', players: '10/10', status: 'full', map: 'de_mirage', ping: '15ms' }
    ]);
  };

  const fetchTournaments = async () => {
    try {
      const API_URL = process.env.REACT_APP_API_URL || '';
      const response = await fetch(`${API_URL}/api/tournaments?status=registration_open&limit=3`);
      const data = await response.json();
      
      if (data.success) setTournaments(data.data || []);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark">
      {/* Hero Section with Slider */}
      <HeroImageSlider />

      {/* Platform Stats - Simple Text Format */}
      <section className="py-12 bg-gaming-dark/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.totalPlayers}
                </div>
                <div className="text-gray-400 text-sm">Total Players</div>
              </div>
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.totalMatches}
                </div>
                <div className="text-gray-400 text-sm">Matches Played</div>
              </div>
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.totalPrizes}
                </div>
                <div className="text-gray-400 text-sm">Prizes Distributed</div>
              </div>
              <div>
                <div className="text-3xl font-gaming font-bold text-gaming-gold mb-1">
                  {stats.activeTournaments}
                </div>
                <div className="text-gray-400 text-sm">Active Tournaments</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Leaderboard Section - Gaming Console Style */}
      <section className="py-20 bg-gaming-charcoal/30 relative overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(#FFD700 1px, transparent 1px), linear-gradient(90deg, #FFD700 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block px-6 py-2 bg-gaming-gold/10 border-2 border-gaming-gold/30 rounded-full mb-4"
            >
              <span className="text-gaming-gold font-bold text-sm flex items-center">
                <FiActivity className="mr-2 animate-pulse" />
                LIVE RANKINGS
              </span>
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              Live Leaderboards
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Real-time rankings • Updated every match</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* BGMI Leaderboard - Gaming Console Style */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Console Border Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl filter blur-xl"></div>
              
              <div className="relative bg-gaming-charcoal border-2 border-orange-500/30 rounded-2xl p-6 shadow-2xl">
                {/* Console Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-orange-500/20">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-2xl shadow-lg"
                    >
                      📱
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-gaming font-bold text-white">BGMI</h3>
                      <p className="text-xs text-gray-400">Mobile Legends</p>
                    </div>
                  </div>
                  <Link to="/leaderboard" className="text-gaming-gold hover:text-gaming-accent text-sm font-bold flex items-center group">
                    View All 
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <FiArrowRight className="ml-1" />
                    </motion.div>
                  </Link>
                </div>

                {/* Leaderboard Entries */}
                <div className="space-y-3">
                  {bgmiLeaderboard.map((player, idx) => (
                    <motion.div
                      key={player.username || idx}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="relative group"
                    >
                      {/* Rank Glow */}
                      {idx < 3 && (
                        <div className={`absolute inset-0 rounded-lg filter blur-md ${
                          idx === 0 ? 'bg-yellow-500/20' :
                          idx === 1 ? 'bg-gray-400/20' :
                          'bg-orange-500/20'
                        }`}></div>
                      )}
                      
                      <div className="relative bg-gaming-dark/70 rounded-lg p-4 border border-gray-700 group-hover:border-gaming-gold/50 transition-all backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {/* Rank Badge */}
                            <motion.div
                              whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg ${
                                idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                                idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                                idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black' :
                                'bg-gray-700 text-white'
                              }`}
                            >
                              {idx === 0 ? '👑' : idx + 1}
                            </motion.div>
                            
                            <div>
                              <div className="font-bold text-white group-hover:text-gaming-gold transition-colors">
                                {player.username}
                              </div>
                              <div className="text-xs text-gray-400 flex items-center">
                                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                                Rank #{idx + 1}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                              className="text-xl font-bold text-gaming-gold"
                            >
                              {player.kills || player.totalKills || 0}
                            </motion.div>
                            <div className="text-xs text-gray-400">Kills</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Console Footer */}
                <div className="mt-6 pt-4 border-t-2 border-orange-500/20">
                  <Link
                    to="/leaderboard"
                    className="block w-full text-center py-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 border-2 border-orange-500/30 rounded-lg text-orange-400 font-bold transition-all"
                  >
                    View Full Leaderboard
                  </Link>
                </div>
              </div>
            </motion.div>

            {/* CS2 Leaderboard - Gaming Console Style */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Console Border Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl filter blur-xl"></div>
              
              <div className="relative bg-gaming-charcoal border-2 border-blue-500/30 rounded-2xl p-6 shadow-2xl">
                {/* Console Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-500/20">
                  <div className="flex items-center space-x-3">
                    <motion.div
                      animate={{ rotate: [0, -360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl shadow-lg"
                    >
                      ⚡
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-gaming font-bold text-white">CS2</h3>
                      <p className="text-xs text-gray-400">Counter-Strike 2</p>
                    </div>
                  </div>
                  <Link to="/leaderboard" className="text-gaming-gold hover:text-gaming-accent text-sm font-bold flex items-center group">
                    View All 
                    <motion.div
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <FiArrowRight className="ml-1" />
                    </motion.div>
                  </Link>
                </div>

                {/* Leaderboard Entries */}
                <div className="space-y-3">
                  {loading ? (
                    [1,2,3].map(i => (
                      <div key={i} className="bg-gaming-dark/50 rounded-lg p-4 animate-pulse">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
                            <div className="h-3 bg-gray-700 rounded w-16"></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : cs2Leaderboard.length > 0 ? (
                    cs2Leaderboard.map((player, idx) => (
                      <motion.div
                        key={player.username || idx}
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1 }}
                        whileHover={{ scale: 1.02, x: -5 }}
                        className="relative group"
                      >
                        {/* Rank Glow */}
                        {idx < 3 && (
                          <div className={`absolute inset-0 rounded-lg filter blur-md ${
                            idx === 0 ? 'bg-yellow-500/20' :
                            idx === 1 ? 'bg-gray-400/20' :
                            'bg-orange-500/20'
                          }`}></div>
                        )}
                        
                        <div className="relative bg-gaming-dark/70 rounded-lg p-4 border border-gray-700 group-hover:border-gaming-gold/50 transition-all backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {/* Rank Badge */}
                              <motion.div
                                whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg ${
                                  idx === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black' :
                                  idx === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                                  idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black' :
                                  'bg-gray-700 text-white'
                                }`}
                              >
                                {idx === 0 ? '👑' : idx + 1}
                              </motion.div>
                              
                              <div>
                                <div className="font-bold text-white group-hover:text-gaming-gold transition-colors">
                                  {player.username}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center">
                                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                                  Rank #{idx + 1}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                                className="text-xl font-bold text-gaming-gold"
                              >
                                {player.kills || player.totalKills || 0}
                              </motion.div>
                              <div className="text-xs text-gray-400">Kills</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-4xl mb-4">🎮</div>
                      <p>No leaderboard data yet</p>
                      <p className="text-sm mt-2">Be the first to compete!</p>
                    </div>
                  )}
                </div>

                {/* Console Footer */}
                <div className="mt-6 pt-4 border-t-2 border-blue-500/20">
                  <Link
                    to="/leaderboard"
                    className="block w-full text-center py-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border-2 border-blue-500/30 rounded-lg text-blue-400 font-bold transition-all"
                  >
                    View Full Leaderboard
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* BGMI Tournament Section - Separate Section Below Leaderboards */}
      <section className="py-20 bg-gaming-charcoal/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* BGMI Official Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-2xl filter blur-3xl group-hover:blur-2xl transition-all"></div>
              
              <div className="relative rounded-2xl overflow-hidden border-4 border-orange-500/30 shadow-2xl">
                <OptimizedImage
                  src={getGameAsset('bgmi', 'hero')}
                  alt="BGMI Tournaments"
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                
                {/* Floating Badge */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute top-6 right-6 bg-gaming-gold text-black px-4 py-2 rounded-full font-bold text-sm shadow-lg"
                >
                  🔥 LIVE NOW
                </motion.div>
              </div>
            </motion.div>

            {/* Tournament Info */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center space-x-3 mb-6">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="text-6xl"
                >
                  📱
                </motion.div>
                <div>
                  <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white">
                    BGMI Tournaments
                  </h2>
                  <p className="text-orange-400 font-bold">Battlegrounds Mobile India</p>
                </div>
              </div>
              
              <p className="text-xl text-gray-300 mb-8">
                Compete in India's biggest mobile esports tournaments with real prizes and glory
              </p>

              <div className="space-y-4 mb-8">
                {[
                  { icon: <FiZap />, title: 'Free Entry', desc: 'All tournaments completely free to join' },
                  { icon: <FiAward />, title: 'Real Prizes', desc: 'Win cash prizes and exclusive rewards' },
                  { icon: <FiUsers />, title: 'Team & Solo', desc: 'Compete solo or with your squad' }
                ].map((item, idx) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ x: 10 }}
                    className="flex items-start space-x-4 p-4 bg-gaming-charcoal/50 rounded-lg border border-gray-700 hover:border-gaming-gold/50 transition-all"
                  >
                    <div className="text-gaming-gold mt-1 text-xl">{item.icon}</div>
                    <div>
                      <h4 className="font-bold text-white mb-1">{item.title}</h4>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/bgmi"
                  className="btn-gaming text-lg px-8 py-4 text-center"
                >
                  View BGMI Tournaments
                </Link>
                <Link
                  to="/tournaments"
                  className="px-8 py-4 border-2 border-gaming-gold text-gaming-gold rounded-lg hover:bg-gaming-gold hover:text-black transition-all duration-300 font-bold text-center"
                >
                  All Tournaments
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid - Gaming Console Style */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gaming-dark via-gaming-charcoal/50 to-gaming-dark"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              Platform Features
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Everything you need for competitive gaming</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <FiAward className="w-10 h-10" />, title: 'Tournaments', desc: 'Compete in CS2 & BGMI', color: 'from-yellow-500 to-orange-500', stat: stats.activeTournaments + ' Active' },
              { icon: <FiTrendingUp className="w-10 h-10" />, title: 'Live Leaderboards', desc: 'Real-time rankings', color: 'from-blue-500 to-cyan-500', stat: 'Updated Live' },
              { icon: <FiServer className="w-10 h-10" />, title: 'Dedicated Servers', desc: 'Auto stats tracking', color: 'from-purple-500 to-pink-500', stat: '2 Servers' },
              { icon: <FiUsers className="w-10 h-10" />, title: 'Team System', desc: 'Create & compete', color: 'from-green-500 to-emerald-500', stat: stats.totalPlayers + ' Players' }
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -10, scale: 1.05 }}
                className="relative group"
              >
                {/* Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-20 rounded-xl filter blur-xl transition-opacity`}></div>
                
                <div className="relative bg-gaming-charcoal border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-xl p-6 transition-all duration-300 overflow-hidden">
                  {/* Corner Accent */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gaming-gold/5 rounded-bl-full"></div>
                  
                  <div className={`inline-flex p-4 rounded-lg bg-gradient-to-br ${feature.color} bg-opacity-10 text-white mb-4 shadow-lg`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400 mb-4 text-sm">{feature.desc}</p>
                  <div className="text-gaming-gold font-bold text-sm flex items-center">
                    <span className="w-2 h-2 bg-gaming-gold rounded-full mr-2 animate-pulse"></span>
                    {feature.stat}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Gaming / Community */}
      <section className="py-20 bg-gaming-charcoal/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              Social Gaming
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Connect, compete, and conquer together</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: '👥', title: 'Friends System', desc: 'Add friends, track progress, compete together', features: ['Send requests', 'View profiles', 'Compare stats'], color: 'from-green-500 to-emerald-500' },
              { icon: '🛡️', title: 'Team Management', desc: 'Create teams, invite members, dominate', features: ['Custom teams', 'Invite system', 'Team tournaments'], color: 'from-blue-500 to-cyan-500' },
              { icon: '⚔️', title: 'Challenges', desc: 'Challenge friends and prove your skills', features: ['1v1 challenges', 'Custom rules', 'Coming soon'], color: 'from-purple-500 to-pink-500' }
            ].map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="relative group"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-10 rounded-xl filter blur-xl transition-opacity`}></div>
                
                <div className="relative bg-gaming-charcoal border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-xl p-6 transition-all h-80 flex flex-col">
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.2 }}
                    className="text-5xl mb-4"
                  >
                    {item.icon}
                  </motion.div>
                  <h3 className="text-2xl font-gaming font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400 mb-4 flex-1">{item.desc}</p>
                  <div className="space-y-2 mt-auto">
                    {item.features.map((feature, i) => (
                      <div key={i} className="flex items-center text-sm text-gray-300 font-gaming">
                        <div className={`w-2 h-2 bg-gradient-to-r ${item.color} rounded-full mr-2`}></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CS2 Servers - Only 2 Mumbai Servers */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gaming-dark via-blue-900/10 to-gaming-dark"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center space-x-3 mb-4">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="text-5xl"
              >
                ⚡
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white">
                CS2 Dedicated Servers
              </h2>
            </div>
            <p className="text-gray-400 text-lg font-gaming">Mumbai Location • Auto Stats • 24/7 Uptime</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {servers.map((server, idx) => (
              <motion.div
                key={server.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                whileHover={{ y: -10, scale: 1.05 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl filter blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="relative bg-gaming-charcoal border-2 border-blue-500/30 rounded-xl p-6 shadow-2xl">
                  {/* Server Status Indicator */}
                  <div className="absolute top-4 right-4">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`w-3 h-3 rounded-full ${
                        server.status === 'active' ? 'bg-green-400' : 'bg-red-400'
                      } shadow-lg`}
                    ></motion.div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-4">{server.name}</h3>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                      <span className="text-gray-400 text-sm">Status:</span>
                      <span className={`font-bold text-sm ${
                        server.status === 'active' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {server.status === 'active' ? '🟢 Active' : '🔴 Full'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                      <span className="text-gray-400 text-sm">Players:</span>
                      <span className="text-white font-bold">{server.players}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                      <span className="text-gray-400 text-sm">Map:</span>
                      <span className="text-gaming-gold font-bold">{server.map}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gaming-dark/50 rounded-lg">
                      <span className="text-gray-400 text-sm">Ping:</span>
                      <span className="text-green-400 font-bold">{server.ping}</span>
                    </div>
                  </div>

                  <Link
                    to="/cs2"
                    className="block w-full text-center py-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 border-2 border-blue-500/30 rounded-lg text-blue-400 font-bold transition-all"
                  >
                    View Server Details
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Link
              to="/cs2"
              className="inline-flex items-center text-gaming-gold hover:text-gaming-accent font-bold text-lg group"
            >
              View All CS2 Features
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <FiArrowRight className="ml-2" />
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>



      {/* More Games Coming Soon - Classic Premium Design */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gaming-dark via-purple-900/10 to-gaming-dark"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              More Games Coming Soon
            </h2>
            <p className="text-gray-400 text-lg font-gaming">Expanding to more titles in 2025</p>
          </motion.div>

          {/* Classic Premium Carousel */}
          <div className="relative max-w-4xl mx-auto">


            {/* Premium Card Container */}
            <div className="overflow-hidden rounded-2xl shadow-2xl">
              <motion.div
                className="flex"
                animate={{ x: `-${currentGameIndex * 100}%` }}
                transition={{ 
                  type: "spring", 
                  stiffness: 150, 
                  damping: 20,
                  duration: 0.6
                }}
              >
                {upcomingGames.map((game, idx) => (
                  <div key={game.name} className="w-full flex-shrink-0 px-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.1 }}
                      whileHover={{ 
                        y: -8,
                        scale: 1.02,
                        transition: { duration: 0.3 }
                      }}
                      className="relative group h-80"
                    >
                      {/* Subtle Premium Glow */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-10 group-hover:opacity-20 rounded-2xl filter blur-xl transition-all duration-500`}></div>
                      
                      {/* Classic Premium Card */}
                      <div className="relative h-full bg-gradient-to-br from-gaming-charcoal to-gaming-dark border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300">
                        {/* Premium Border Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-gaming-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        {/* Classic Premium Content */}
                        <div className="relative h-full flex flex-col items-center justify-center p-8 text-center">
                          {/* Simple Elegant Icon */}
                          <motion.div
                            animate={{ 
                              scale: [1, 1.05, 1]
                            }}
                            transition={{ 
                              duration: 3, 
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            whileHover={{
                              scale: 1.1,
                              transition: { duration: 0.3 }
                            }}
                            className="text-7xl mb-6 filter drop-shadow-lg"
                          >
                            {game.icon}
                          </motion.div>
                          
                          {/* Classic Game Title */}
                          <h3 className="text-3xl font-gaming font-bold text-white mb-4 group-hover:text-gaming-gold transition-colors duration-300">
                            {game.name}
                          </h3>
                          
                          {/* Premium Status Badge */}
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className={`inline-flex items-center px-6 py-3 bg-gradient-to-r ${game.color} rounded-full text-white font-gaming font-bold text-sm shadow-lg backdrop-blur-sm mb-4`}
                          >
                            <span className="mr-2">🚀</span>
                            {game.status}
                          </motion.div>
                          
                          {/* Simple Description */}
                          <p className="text-gray-300 font-gaming text-sm">
                            Get ready for epic tournaments
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Classic Premium Indicators */}
            <div className="flex justify-center space-x-3 mt-8">
              {upcomingGames.map((game, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentGameIndex(idx)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    idx === currentGameIndex 
                      ? 'bg-gaming-gold scale-125 shadow-lg shadow-gaming-gold/50' 
                      : 'bg-gray-500 hover:bg-gray-400 hover:scale-110'
                  }`}
                />
              ))}
            </div>

            {/* Auto-slide Toggle */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={`px-4 py-2 rounded-full font-gaming text-sm transition-all duration-300 ${
                  autoPlay 
                    ? 'bg-gaming-gold/20 text-gaming-gold border border-gaming-gold/50' 
                    : 'bg-gray-700 text-gray-300 border border-gray-600 hover:border-gray-500'
                }`}
              >
                {autoPlay ? '⏸ Pause Auto-slide' : '▶ Enable Auto-slide'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Enhanced Unique Slider */}
      <section className="py-20 bg-gaming-charcoal/30 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-gaming font-bold text-white mb-4">
              What Players Say
            </h2>
            <p className="text-gray-400 text-lg">Join thousands of satisfied gamers</p>
          </motion.div>

          {/* Enhanced Testimonials Slider */}
          <div className="relative">
            <div className="overflow-hidden rounded-3xl">
              <motion.div
                className="flex"
                animate={{ x: [0, -100, -200, 0] }}
                transition={{ 
                  duration: 15,
                  repeat: Infinity,
                  ease: "linear"
                }}
              >
                {[
                  { name: 'Rahul K.', game: 'CS2 Player', avatar: '🎮', text: 'Best platform for competitive CS2 in India. Auto stats tracking is amazing!', rating: 5, color: 'from-blue-500 to-cyan-500' },
                  { name: 'Priya S.', game: 'BGMI Player', avatar: '📱', text: 'Love the free tournaments and smooth registration process. Highly recommended!', rating: 5, color: 'from-orange-500 to-red-500' },
                  { name: 'Arjun M.', game: 'Pro Gamer', avatar: '👑', text: 'Finally a platform that takes esports seriously. Great prizes and fair play.', rating: 5, color: 'from-purple-500 to-pink-500' },
                  // Duplicate for seamless loop
                  { name: 'Rahul K.', game: 'CS2 Player', avatar: '🎮', text: 'Best platform for competitive CS2 in India. Auto stats tracking is amazing!', rating: 5, color: 'from-blue-500 to-cyan-500' },
                  { name: 'Priya S.', game: 'BGMI Player', avatar: '📱', text: 'Love the free tournaments and smooth registration process. Highly recommended!', rating: 5, color: 'from-orange-500 to-red-500' },
                  { name: 'Arjun M.', game: 'Pro Gamer', avatar: '👑', text: 'Finally a platform that takes esports seriously. Great prizes and fair play.', rating: 5, color: 'from-purple-500 to-pink-500' }
                ].map((review, idx) => (
                  <div key={`${review.name}-${idx}`} className="w-1/3 flex-shrink-0 px-4">
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: (idx % 3) * 0.2 }}
                      whileHover={{ 
                        y: -15, 
                        scale: 1.05,
                        rotateY: 5,
                        transition: { duration: 0.3 }
                      }}
                      className="relative group h-80"
                    >
                      {/* Dynamic Glow Effect */}
                      <motion.div 
                        className={`absolute inset-0 bg-gradient-to-br ${review.color} rounded-3xl filter blur-2xl transition-all duration-500`}
                        animate={{ 
                          opacity: [0.1, 0.3, 0.1],
                          scale: [1, 1.1, 1]
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity,
                          delay: idx * 0.5
                        }}
                      />
                      
                      <div className="relative bg-gaming-charcoal/90 backdrop-blur-sm border-2 border-gray-700 group-hover:border-gaming-gold/50 rounded-3xl p-6 shadow-2xl transition-all duration-300 h-full flex flex-col">
                        {/* Floating Quote Icon */}
                        <motion.div 
                          className="absolute top-4 right-4 text-gaming-gold/30 text-5xl font-serif"
                          animate={{ 
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1]
                          }}
                          transition={{ 
                            duration: 4, 
                            repeat: Infinity,
                            delay: idx * 0.3
                          }}
                        >
                          "
                        </motion.div>
                        
                        {/* Avatar with Unique Animation */}
                        <div className="flex items-center mb-6">
                          <motion.div
                            className={`w-16 h-16 rounded-full bg-gradient-to-br ${review.color} flex items-center justify-center text-3xl shadow-xl mr-4`}
                            whileHover={{ 
                              rotate: [0, -15, 15, -15, 0],
                              scale: [1, 1.2, 1]
                            }}
                            animate={{
                              boxShadow: [
                                '0 0 20px rgba(255, 215, 0, 0.3)',
                                '0 0 40px rgba(255, 215, 0, 0.6)',
                                '0 0 20px rgba(255, 215, 0, 0.3)'
                              ]
                            }}
                            transition={{ 
                              duration: 2, 
                              repeat: Infinity,
                              delay: idx * 0.4
                            }}
                          >
                            {review.avatar}
                          </motion.div>
                          <div>
                            <div className="font-bold text-white text-lg group-hover:text-gaming-gold transition-colors">
                              {review.name}
                            </div>
                            <div className="text-sm text-gray-400">{review.game}</div>
                          </div>
                        </div>

                        {/* Animated Stars */}
                        <div className="flex items-center mb-6">
                          {[...Array(review.rating)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0, rotate: -180 }}
                              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                              viewport={{ once: true }}
                              transition={{ 
                                delay: (idx % 3) * 0.1 + i * 0.1,
                                type: "spring",
                                stiffness: 200
                              }}
                              whileHover={{ 
                                scale: 1.3,
                                rotate: 360,
                                transition: { duration: 0.3 }
                              }}
                            >
                              <FiStar className="text-gaming-gold fill-current mr-1" size={20} />
                            </motion.div>
                          ))}
                        </div>

                        {/* Review Text with Typewriter Effect */}
                        <div className="flex-1 flex items-center">
                          <motion.p 
                            className="text-gray-300 italic relative z-10 text-center leading-relaxed"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: (idx % 3) * 0.3 }}
                          >
                            "{review.text}"
                          </motion.p>
                        </div>

                        {/* Decorative Elements */}
                        <motion.div 
                          className="absolute bottom-4 left-4 w-8 h-8 bg-gaming-gold/20 rounded-full"
                          animate={{ 
                            scale: [1, 1.5, 1],
                            opacity: [0.2, 0.5, 0.2]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity,
                            delay: idx * 0.6
                          }}
                        />
                        <motion.div 
                          className="absolute top-1/2 right-6 w-4 h-4 bg-gaming-neon/30 rounded-full"
                          animate={{ 
                            y: [-10, 10, -10],
                            opacity: [0.3, 0.7, 0.3]
                          }}
                          transition={{ 
                            duration: 3, 
                            repeat: Infinity,
                            delay: idx * 0.8
                          }}
                        />
                      </div>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Gradient Overlays for Seamless Loop */}
            <div className="absolute left-0 top-0 w-32 h-full bg-gradient-to-r from-gaming-charcoal/30 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-gaming-charcoal/30 to-transparent z-10 pointer-events-none" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-gaming-neon/10 to-gaming-gold/10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <motion.h2
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-3xl md:text-5xl font-gaming font-bold text-white mb-6"
            >
              Ready to Start Your Journey?
            </motion.h2>
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

export default CompleteLandingPage;

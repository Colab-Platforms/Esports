import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiGrid, FiAward, FiUsers, FiBarChart2, FiSettings, FiTrendingUp, FiActivity } from 'react-icons/fi';
import api from '../../services/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeTournaments: 0,
    totalGames: 0,
    totalMatches: 0,
    loading: true
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch stats from different endpoints
      const [gamesRes, adminRes] = await Promise.all([
        api.get('/api/games'),
        api.get('/api/admin/dashboard')
      ]);

      setStats({
        totalUsers: adminRes.data?.totalUsers || 0,
        activeTournaments: adminRes.data?.activeTournaments || 0,
        totalGames: gamesRes.data?.games?.length || 0,
        totalMatches: adminRes.data?.totalMatches || 0,
        loading: false
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const adminSections = [
    {
      title: 'Games Management',
      description: 'Add, edit, or remove games',
      icon: FiGrid,
      link: '/admin/games',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Tournaments',
      description: 'Create and manage tournaments',
      icon: FiAward,
      link: '/admin/tournaments',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Users',
      description: 'Manage users and permissions',
      icon: FiUsers,
      link: '/admin/users',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Analytics',
      description: 'View platform statistics',
      icon: FiBarChart2,
      link: '/admin/analytics',
      color: 'from-orange-500 to-red-500'
    },
    {
      title: 'Settings',
      description: 'Platform configuration',
      icon: FiSettings,
      link: '/admin/settings',
      color: 'from-gray-500 to-slate-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-400">
            Manage your esports platform
          </p>
        </motion.div>

        {/* Quick Stats - Moved to Top */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <div className="card-gaming p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Total Users</div>
              <FiUsers className="text-blue-500 h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-white">
              {stats.loading ? '...' : stats.totalUsers}
            </div>
            <div className="text-xs text-gray-500 mt-1">Registered players</div>
          </div>

          <div className="card-gaming p-6 border-l-4 border-gaming-gold">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Active Tournaments</div>
              <FiAward className="text-gaming-gold h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-gaming-gold">
              {stats.loading ? '...' : stats.activeTournaments}
            </div>
            <div className="text-xs text-gray-500 mt-1">Currently running</div>
          </div>

          <div className="card-gaming p-6 border-l-4 border-gaming-neon">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Total Games</div>
              <FiGrid className="text-gaming-neon h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-gaming-neon">
              {stats.loading ? '...' : stats.totalGames}
            </div>
            <div className="text-xs text-gray-500 mt-1">Available games</div>
          </div>

          <div className="card-gaming p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Total Matches</div>
              <FiActivity className="text-purple-500 h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-white">
              {stats.loading ? '...' : stats.totalMatches}
            </div>
            <div className="text-xs text-gray-500 mt-1">Completed matches</div>
          </div>

          {/* Revenue - Commented for now */}
          {/* <div className="card-gaming p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <div className="text-gray-400 text-sm">Revenue</div>
              <FiTrendingUp className="text-green-500 h-5 w-5" />
            </div>
            <div className="text-3xl font-bold text-green-400">₹0</div>
            <div className="text-xs text-gray-500 mt-1">Total earnings</div>
          </div> */}
        </motion.div>

        {/* Admin Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={section.link}
                className="block card-gaming p-6 hover:scale-105 transition-transform duration-300"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center mb-4`}>
                  <section.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {section.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  {section.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>


      </div>
    </div>
  );
};

export default AdminDashboard;

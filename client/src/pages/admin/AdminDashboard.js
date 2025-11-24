import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiGrid, FiTrophy, FiUsers, FiBarChart2, FiSettings } from 'react-icons/fi';

const AdminDashboard = () => {
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
      icon: FiTrophy,
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

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          <div className="card-gaming p-6">
            <div className="text-gray-400 text-sm mb-1">Total Users</div>
            <div className="text-3xl font-bold text-white">0</div>
          </div>
          <div className="card-gaming p-6">
            <div className="text-gray-400 text-sm mb-1">Active Tournaments</div>
            <div className="text-3xl font-bold text-gaming-gold">0</div>
          </div>
          <div className="card-gaming p-6">
            <div className="text-gray-400 text-sm mb-1">Total Games</div>
            <div className="text-3xl font-bold text-gaming-neon">0</div>
          </div>
          <div className="card-gaming p-6">
            <div className="text-gray-400 text-sm mb-1">Revenue</div>
            <div className="text-3xl font-bold text-green-400">₹0</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;

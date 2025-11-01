import React from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiAward, FiTarget, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { selectUser } from '../store/slices/authSlice';

const DashboardPage = () => {
  const user = useSelector(selectUser);

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
      icon: FiTarget,
      color: 'text-gaming-neon',
      bgColor: 'bg-gaming-neon/10'
    },
    {
      title: 'Total Earnings',
      value: `₹${user?.totalEarnings || 0}`,
      icon: FiDollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10'
    },
    {
      title: 'Login Streak',
      value: `${user?.loginStreak || 0} days`,
      icon: FiTrendingUp,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10'
    }
  ];

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-gaming font-bold text-white mb-2">
            Welcome back, {user?.username}! 🎮
          </h1>
          <p className="text-gray-400">
            Ready to dominate the arena? Check out your stats and join tournaments.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Active Tournaments */}
          <div className="card-gaming p-6">
            <h2 className="text-xl font-bold text-white mb-4">Active Tournaments</h2>
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No active tournaments</p>
              <button className="btn-gaming">
                Browse Tournaments
              </button>
            </div>
          </div>

          {/* Recent Achievements */}
          <div className="card-gaming p-6">
            <h2 className="text-xl font-bold text-white mb-4">Recent Achievements</h2>
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
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardPage;
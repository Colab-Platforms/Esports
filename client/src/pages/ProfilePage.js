import React from 'react';
import { motion } from 'framer-motion';

const ProfilePage = () => {
  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl font-gaming font-bold text-white mb-4">
            Profile
          </h1>
          <p className="text-gray-400 mb-8">
            Profile management and settings coming soon!
          </p>
          <div className="card-gaming p-8">
            <h2 className="text-xl font-bold text-white mb-4">👤 Profile Settings</h2>
            <p className="text-gray-400">
              Update your profile, link game accounts, and manage preferences.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfilePage;
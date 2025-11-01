import React from 'react';
import { motion } from 'framer-motion';
import { getRandomHeroBackground } from '../../assets/tournamentBanners';

const LoadingScreen = ({ message = 'Loading...', showBackground = true }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background */}
      {showBackground && (
        <div className="absolute inset-0">
          <img 
            src={getRandomHeroBackground()}
            alt="Loading Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/80" />
        </div>
      )}
      
      {/* Loading Content */}
      <div className="relative z-10 text-center">
        {/* Gaming Logo */}
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
          }}
          className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-gaming-neon to-gaming-neon-blue rounded-full flex items-center justify-center shadow-2xl"
        >
          <span className="text-3xl">🎮</span>
        </motion.div>

        {/* Loading Text */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-gaming font-bold text-white mb-4"
        >
          COLAB ESPORTS
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-300 mb-8"
        >
          {message}
        </motion.p>

        {/* Loading Bar */}
        <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden mx-auto">
          <motion.div
            className="h-full bg-gradient-to-r from-gaming-neon to-gaming-neon-blue"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          />
        </div>

        {/* Gaming Icons */}
        <div className="flex justify-center space-x-4 mt-8">
          {['🎯', '⚡', '🏆', '🔥'].map((icon, index) => (
            <motion.div
              key={index}
              animate={{ 
                y: [0, -10, 0],
                opacity: [0.5, 1, 0.5]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: index * 0.2 
              }}
              className="text-2xl"
            >
              {icon}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
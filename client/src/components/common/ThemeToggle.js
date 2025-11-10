import React from 'react';
import { motion } from 'framer-motion';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../../contexts/ThemeContext';

const ThemeToggle = ({ size = 'md', showLabel = false }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="flex items-center space-x-2">
      <motion.button
        onClick={toggleTheme}
        className={`${sizeClasses[size]} rounded-lg bg-theme-card border border-theme-border hover:border-gaming-gold transition-all duration-300 flex items-center justify-center group`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      >
        <motion.div
          initial={false}
          animate={{ 
            rotate: isDark ? 180 : 0,
            scale: isDark ? 1 : 1
          }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          {isDark ? (
            <FiMoon className={`${iconSizes[size]} text-gaming-gold group-hover:text-white transition-colors`} />
          ) : (
            <FiSun className={`${iconSizes[size]} text-gaming-gold group-hover:text-white transition-colors`} />
          )}
        </motion.div>
      </motion.button>
      
      {showLabel && (
        <span className="text-sm text-theme-text-secondary">
          {isDark ? 'Dark' : 'Light'} Mode
        </span>
      )}
    </div>
  );
};

export default ThemeToggle;
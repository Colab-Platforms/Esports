import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiUser } from 'react-icons/fi';

const UserAvatar = ({
  user,
  size = 'md',
  showStatus = false,
  showLevel = false,
  className = '',
  onClick = null
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20',
    '3xl': 'w-24 h-24'
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl'
  };

  const getAvatarImage = () => {
    if (user?.avatarUrl && !imageError) {
      return user.avatarUrl;
    }

    // Generate avatar based on username
    if (user?.username) {
      const seed = user.username.toLowerCase();
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=1e293b&clothesColor=3b82f6`;
    }

    return null;
  };

  const getInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const getUserLevel = () => {
    return user?.level || 1;
  };

  const getUserRank = () => {
    const level = getUserLevel();
    if (level >= 50) return { name: 'Diamond', color: 'text-blue-400', bg: 'bg-blue-400/20' };
    if (level >= 30) return { name: 'Gold', color: 'text-yellow-400', bg: 'bg-yellow-400/20' };
    if (level >= 15) return { name: 'Silver', color: 'text-gray-400', bg: 'bg-gray-400/20' };
    return { name: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-400/20' };
  };

  const isOnline = user?.isOnline || false;

  return (
    <div className={`relative inline-block ${className}`}>
      <motion.div
        whileHover={{ scale: onClick ? 1.05 : 1 }}
        className={`
          ${sizeClasses[size]} 
          rounded-full 
          overflow-hidden 
          border-2 
          border-gray-600 
          hover:border-gaming-gold 
          transition-colors 
          duration-200
          ${onClick ? 'cursor-pointer' : ''}
        `}
        onClick={onClick}
      >
        {getAvatarImage() ? (
          <img
            src={getAvatarImage()}
            alt={user?.username || 'User'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gaming-neon/20 to-gaming-neon-blue/20 flex items-center justify-center">
            {user?.username ? (
              <span className={`font-bold text-white ${textSizes[size]}`}>
                {getInitials()}
              </span>
            ) : (
              <FiUser className={`text-gray-400 ${size === 'xs' ? 'w-3 h-3' :
                  size === 'sm' ? 'w-4 h-4' :
                    size === 'md' ? 'w-5 h-5' :
                      size === 'lg' ? 'w-6 h-6' :
                        size === 'xl' ? 'w-8 h-8' :
                          size === '2xl' ? 'w-10 h-10' :
                            'w-12 h-12'
                }`} />
            )}
          </div>
        )}
      </motion.div>

      {/* Online Status */}
      {showStatus && (
        <div className={`
          absolute 
          -bottom-1 
          -right-1 
          w-3 
          h-3 
          rounded-full 
          border-2 
          border-gaming-dark
          ${isOnline ? 'bg-green-500' : 'bg-gray-500'}
        `} />
      )}

      {/* Level Badge */}
      {/* {showLevel && (
        <div className="absolute -top-1 -right-1">
          <div className={`
            px-2 
            py-1 
            rounded-full 
            text-xs 
            font-bold 
            ${getUserRank().bg} 
            ${getUserRank().color}
            border 
            border-current
          `}>
            {getUserLevel()}
          </div>
        </div>
      )} */}

      {/* Rank Badge */}
      {showLevel && size !== 'xs' && size !== 'sm' && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
          <div className={`
            px-2 
            py-1 
            rounded-full 
            text-xs 
            font-bold 
            ${getUserRank().bg} 
            ${getUserRank().color}
            border 
            border-current
            whitespace-nowrap
          `}>
            {getUserRank().name}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
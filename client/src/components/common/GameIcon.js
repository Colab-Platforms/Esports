import React from 'react';
import { getGameInfo } from '../../assets/gameAssets';

const GameIcon = ({ 
  gameType, 
  size = 'md', 
  showName = false, 
  className = '',
  style = 'icon' // 'icon', 'logo', 'thumbnail', 'cdn'
}) => {
  const gameInfo = getGameInfo(gameType);
  
  const sizeClasses = {
    xs: 'text-sm w-4 h-4',
    sm: 'text-base w-6 h-6', 
    md: 'text-lg w-8 h-8',
    lg: 'text-xl w-10 h-10',
    xl: 'text-2xl w-12 h-12',
    '2xl': 'text-3xl w-16 h-16'
  };

  // Use CDN icon if available and style is 'icon' or 'cdn'
  if ((style === 'icon' || style === 'cdn') && gameInfo.cdnIcon) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <img 
          src={gameInfo.cdnIcon} 
          alt={gameInfo.name}
          className={`${sizeClasses[size]} object-contain`}
        />
        {showName && (
          <span className="font-medium text-white">{gameInfo.name}</span>
        )}
      </div>
    );
  }

  if (style === 'logo' || style === 'thumbnail') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <img 
          src={gameInfo[style]} 
          alt={gameInfo.name}
          className={`${sizeClasses[size]} object-cover rounded`}
        />
        {showName && (
          <span className="font-medium text-white">{gameInfo.name}</span>
        )}
      </div>
    );
  }

  // Fallback to emoji icon
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span 
        className={`${sizeClasses[size]} flex items-center justify-center`}
        style={{ color: gameInfo.color }}
      >
        {gameInfo.icon}
      </span>
      {showName && (
        <span className="font-medium text-white">{gameInfo.name}</span>
      )}
    </div>
  );
};

export default GameIcon;
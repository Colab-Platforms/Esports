import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = ({ 
  size = 'md', 
  text = 'Loading...', 
  showText = true,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg', 
    xl: 'text-xl'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <motion.div
        className={`${sizeClasses[size]} flex items-center justify-center`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <img 
          src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Without_Text_Infinity_Logo.png?v=1766727294"
          alt="Loading..."
          className="w-full h-full object-contain"
          style={{ filter: 'hue-rotate(45deg) saturate(1.5) brightness(1.2)' }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'block';
          }}
        />
        {/* Fallback spinning infinity symbol */}
        <motion.span 
          className="hidden text-gaming-gold font-bold text-2xl"
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          ∞
        </motion.span>
      </motion.div>
      
      {showText && (
        <motion.p 
          className={`text-gray-300 mt-3 ${textSizes[size]}`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

export default LoadingSpinner;
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CountdownTimer = ({ 
  targetDate, 
  onComplete, 
  format = 'full', // 'full', 'compact', 'minimal'
  size = 'md',
  showLabels = true,
  className = ''
}) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0
  });

  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, total: difference });
        setIsComplete(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        if (!isComplete) {
          setIsComplete(true);
          if (onComplete) onComplete();
        }
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onComplete, isComplete]);

  const formatNumber = (num) => num.toString().padStart(2, '0');

  const sizeClasses = {
    sm: {
      container: 'text-sm',
      number: 'text-lg font-bold',
      label: 'text-xs'
    },
    md: {
      container: 'text-base',
      number: 'text-xl font-bold',
      label: 'text-sm'
    },
    lg: {
      container: 'text-lg',
      number: 'text-2xl font-bold',
      label: 'text-base'
    }
  };

  if (isComplete) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`flex items-center space-x-2 ${className}`}
      >
        <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-lg">
          <span className="text-red-400 font-semibold text-sm">EXPIRED</span>
        </div>
      </motion.div>
    );
  }

  if (format === 'minimal') {
    const totalHours = timeLeft.days * 24 + timeLeft.hours;
    return (
      <div className={`${sizeClasses[size].container} ${className}`}>
        <span className="text-theme-text-primary font-mono">
          {totalHours > 0 && `${totalHours}h `}
          {formatNumber(timeLeft.minutes)}m {formatNumber(timeLeft.seconds)}s
        </span>
      </div>
    );
  }

  if (format === 'compact') {
    return (
      <div className={`flex items-center space-x-1 ${sizeClasses[size].container} ${className}`}>
        {timeLeft.days > 0 && (
          <>
            <span className="text-gaming-gold font-mono">{timeLeft.days}</span>
            <span className="text-theme-text-muted text-xs">d</span>
          </>
        )}
        <span className="text-gaming-gold font-mono">{formatNumber(timeLeft.hours)}</span>
        <span className="text-theme-text-muted text-xs">h</span>
        <span className="text-gaming-gold font-mono">{formatNumber(timeLeft.minutes)}</span>
        <span className="text-theme-text-muted text-xs">m</span>
        <span className="text-gaming-gold font-mono">{formatNumber(timeLeft.seconds)}</span>
        <span className="text-theme-text-muted text-xs">s</span>
      </div>
    );
  }

  // Full format
  return (
    <div className={`flex items-center space-x-2 md:space-x-4 ${className}`}>
      {timeLeft.days > 0 && (
        <motion.div
          key={timeLeft.days}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className={`${sizeClasses[size].number} text-gaming-gold font-mono`}>
            {formatNumber(timeLeft.days)}
          </div>
          {showLabels && (
            <div className={`${sizeClasses[size].label} text-theme-text-muted uppercase tracking-wider`}>
              Days
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        key={timeLeft.hours}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        className="text-center"
      >
        <div className={`${sizeClasses[size].number} text-gaming-gold font-mono`}>
          {formatNumber(timeLeft.hours)}
        </div>
        {showLabels && (
          <div className={`${sizeClasses[size].label} text-theme-text-muted uppercase tracking-wider`}>
            Hours
          </div>
        )}
      </motion.div>

      <div className="text-theme-text-muted">:</div>

      <motion.div
        key={timeLeft.minutes}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        className="text-center"
      >
        <div className={`${sizeClasses[size].number} text-gaming-gold font-mono`}>
          {formatNumber(timeLeft.minutes)}
        </div>
        {showLabels && (
          <div className={`${sizeClasses[size].label} text-theme-text-muted uppercase tracking-wider`}>
            Minutes
          </div>
        )}
      </motion.div>

      <div className="text-theme-text-muted">:</div>

      <motion.div
        key={timeLeft.seconds}
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        className="text-center"
      >
        <div className={`${sizeClasses[size].number} text-gaming-gold font-mono`}>
          {formatNumber(timeLeft.seconds)}
        </div>
        {showLabels && (
          <div className={`${sizeClasses[size].label} text-theme-text-muted uppercase tracking-wider`}>
            Seconds
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CountdownTimer;
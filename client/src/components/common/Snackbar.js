import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const Snackbar = ({ message, type = 'info', duration = 3000, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-500/20',
          border: 'border-green-500/50',
          text: 'text-green-400',
          icon: '✓'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-500/20',
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          icon: '⚠️'
        };
      case 'error':
        return {
          bg: 'bg-red-500/20',
          border: 'border-red-500/50',
          text: 'text-red-400',
          icon: '✕'
        };
      default:
        return {
          bg: 'bg-blue-500/20',
          border: 'border-blue-500/50',
          text: 'text-blue-400',
          icon: 'ℹ️'
        };
    }
  };

  const styles = getStyles();

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`fixed top-4 right-4 z-[9999] ${styles.bg} border ${styles.border} rounded-lg p-4 max-w-sm`}
        >
          <div className="flex items-center space-x-3">
            <span className="text-lg">{styles.icon}</span>
            <p className={`${styles.text} font-medium text-sm`}>{message}</p>
            <button
              onClick={onClose}
              className={`ml-2 ${styles.text} hover:opacity-70 transition-opacity`}
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Snackbar;

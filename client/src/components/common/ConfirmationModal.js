import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  type = 'default', // 'default', 'danger', 'warning', 'success'
  loading = false
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: '!',
          confirmBg: 'bg-red-600 hover:bg-red-700',
          titleColor: 'text-red-400',
          borderColor: 'border-red-500/30'
        };
      case 'warning':
        return {
          icon: '!',
          confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
          titleColor: 'text-yellow-400',
          borderColor: 'border-yellow-500/30'
        };
      case 'success':
        return {
          icon: '✓',
          confirmBg: 'bg-green-600 hover:bg-green-700',
          titleColor: 'text-green-400',
          borderColor: 'border-green-500/30'
        };
      default:
        return {
          icon: '?',
          confirmBg: 'bg-gaming-neon hover:bg-gaming-neon/90',
          titleColor: 'text-gaming-neon',
          borderColor: 'border-gaming-neon/30'
        };
    }
  };

  const styles = getTypeStyles();

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`bg-gaming-dark border ${styles.borderColor} rounded-lg p-6 max-w-md w-full shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center space-x-3 mb-4">
            <span className="text-2xl">{styles.icon}</span>
            <h3 className={`text-lg font-bold ${styles.titleColor}`}>
              {title}
            </h3>
          </div>

          {/* Message */}
          <div className="mb-6">
            <p className="text-gray-300 whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2 ${styles.confirmBg} text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium`}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConfirmationModal;
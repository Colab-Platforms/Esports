import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const InputModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  title, 
  message, 
  placeholder = 'Enter text...', 
  submitText = 'Submit', 
  cancelText = 'Cancel',
  type = 'default', // 'default', 'danger', 'warning', 'success'
  loading = false,
  required = true,
  multiline = false,
  maxLength = 500
}) => {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          icon: '!',
          submitBg: 'bg-red-600 hover:bg-red-700',
          titleColor: 'text-red-400',
          borderColor: 'border-red-500/30'
        };
      case 'warning':
        return {
          icon: '!',
          submitBg: 'bg-yellow-600 hover:bg-yellow-700',
          titleColor: 'text-yellow-400',
          borderColor: 'border-yellow-500/30'
        };
      case 'success':
        return {
          icon: '✓',
          submitBg: 'bg-green-600 hover:bg-green-700',
          titleColor: 'text-green-400',
          borderColor: 'border-green-500/30'
        };
      default:
        return {
          icon: 'i',
          submitBg: 'bg-gaming-neon hover:bg-gaming-neon/90',
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

  const handleSubmit = () => {
    if (required && !inputValue.trim()) {
      return;
    }
    onSubmit(inputValue.trim());
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSubmit();
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
          {message && (
            <div className="mb-4">
              <p className="text-gray-300 whitespace-pre-line">
                {message}
              </p>
            </div>
          )}

          {/* Input */}
          <div className="mb-6">
            {multiline ? (
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={placeholder}
                maxLength={maxLength}
                rows={4}
                className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-gaming-neon focus:outline-none resize-none"
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                maxLength={maxLength}
                className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-gaming-neon focus:outline-none"
                autoFocus
              />
            )}
            {maxLength && (
              <div className="text-right text-xs text-gray-500 mt-1">
                {inputValue.length}/{maxLength}
              </div>
            )}
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
              onClick={handleSubmit}
              disabled={loading || (required && !inputValue.trim())}
              className={`flex-1 px-4 py-2 ${styles.submitBg} text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium`}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                submitText
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InputModal;
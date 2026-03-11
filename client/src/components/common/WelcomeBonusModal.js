import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDollarSign, FiX, FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const WelcomeBonusModal = ({ isOpen, onClose, bonusAmount = 100, userName = 'Player' }) => {
  const navigate = useNavigate();
  const [showCoins, setShowCoins] = useState(false);
  const [coinCount, setCoinCount] = useState(0);

  // Debug props
  useEffect(() => {
    console.log('🎁 WelcomeBonusModal props:', { isOpen, bonusAmount, userName });
  }, [isOpen, bonusAmount, userName]);

  // Animate coin counter
  useEffect(() => {
    if (isOpen && showCoins) {
      let start = 0;
      const increment = bonusAmount / 50; // Animate over 50 steps
      const timer = setInterval(() => {
        start += increment;
        if (start >= bonusAmount) {
          setCoinCount(bonusAmount);
          clearInterval(timer);
        } else {
          setCoinCount(Math.floor(start));
        }
      }, 30);

      return () => clearInterval(timer);
    }
  }, [isOpen, showCoins, bonusAmount]);

  // Show coins animation after modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setShowCoins(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCheckWallet = () => {
    toast.success('🎉 Welcome to Colab Esports! Your coins are ready!');
    onClose();
    setTimeout(() => {
      navigate('/wallet');
    }, 300); // Small delay for smooth transition
  };

  const handleContinue = () => {
    toast.success('🎮 Welcome to the arena! Let\'s get started!');
    onClose();
    setTimeout(() => {
      navigate('/dashboard');
    }, 300); // Small delay for smooth transition
  };

  // Floating coins animation
  const FloatingCoin = ({ delay = 0 }) => (
    <motion.div
      initial={{ y: 50, opacity: 0, rotate: 0 }}
      animate={{ 
        y: [-10, -30, -10], 
        opacity: [0, 1, 0.8],
        rotate: [0, 360, 720]
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        repeatType: "reverse"
      }}
      className="absolute text-2xl"
      style={{
        left: `${20 + Math.random() * 60}%`,
        top: `${20 + Math.random() * 40}%`
      }}
    >
      🪙
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 50 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="bg-gradient-to-br from-gaming-dark via-gaming-charcoal to-gaming-dark border-2 border-gaming-gold rounded-2xl max-w-md w-full relative overflow-hidden"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-br from-gaming-gold/20 to-transparent"></div>
              {/* Floating Coins Background */}
              {showCoins && (
                <>
                  <FloatingCoin delay={0} />
                  <FloatingCoin delay={0.2} />
                  <FloatingCoin delay={0.4} />
                  <FloatingCoin delay={0.6} />
                  <FloatingCoin delay={0.8} />
                  <FloatingCoin delay={1.0} />
                  <FloatingCoin delay={1.2} />
                </>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            >
              <FiX className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative z-10 p-8 text-center">
              {/* Welcome Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="mb-6"
              >
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-gaming-gold to-yellow-600 rounded-full flex items-center justify-center text-4xl shadow-lg">
                  🎉
                </div>
              </motion.div>

              {/* Welcome Message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mb-6"
              >
                <h2 className="text-2xl font-gaming font-bold text-white mb-2">
                  Welcome to Colab Esports!
                </h2>
                <p className="text-gray-300 text-sm">
                  Hey {userName}, your gaming journey starts here! 🎮
                </p>
              </motion.div>

              {/* Coins Section */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
                className="mb-8"
              >
                <div className="bg-gaming-charcoal/50 border border-gaming-gold/30 rounded-xl p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-center space-x-3 mb-3">
                    <motion.div
                      animate={{ rotate: showCoins ? 360 : 0 }}
                      transition={{ duration: 1, delay: 0.8 }}
                      className="w-12 h-12 bg-gradient-to-br from-gaming-gold to-yellow-600 rounded-full flex items-center justify-center"
                    >
                      <FiDollarSign className="w-6 h-6 text-gaming-dark font-bold" />
                    </motion.div>
                    <div>
                      <div className="text-3xl font-gaming font-bold text-gaming-gold">
                        {showCoins ? (
                          <motion.span
                            key={coinCount}
                            initial={{ scale: 1.2 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            {coinCount}
                          </motion.span>
                        ) : (
                          '0'
                        )}
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">
                        Colab Coins
                      </div>
                    </div>
                  </div>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-gaming-gold font-medium text-sm"
                  >
                    🎁 Welcome Bonus Credited!
                  </motion.p>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.4 }}
                    className="text-gray-400 text-xs mt-2"
                  >
                    Use these coins in our store or save them for future tournaments
                  </motion.p>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6 }}
                className="space-y-3"
              >
                <button
                  onClick={handleCheckWallet}
                  className="w-full bg-gradient-to-r from-gaming-gold to-yellow-600 hover:from-yellow-600 hover:to-gaming-gold text-gaming-dark font-gaming font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 shadow-lg"
                >
                  <FiDollarSign className="w-5 h-5" />
                  <span>Check Your Wallet</span>
                  <FiArrowRight className="w-4 h-4" />
                </button>
                
                <button
                  onClick={handleContinue}
                  className="w-full bg-gaming-charcoal/50 hover:bg-gaming-charcoal border border-gaming-border hover:border-gaming-gold text-white font-gaming py-3 px-6 rounded-lg transition-all duration-300"
                >
                  Continue to Dashboard
                </button>
              </motion.div>

              {/* Fun Facts */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="mt-6 text-xs text-gray-500"
              >
                <p>💡 Tip: Earn more coins by participating in tournaments!</p>
              </motion.div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gaming-gold via-yellow-500 to-gaming-gold"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-gaming-gold via-yellow-500 to-gaming-gold"></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeBonusModal;
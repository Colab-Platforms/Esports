import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDollarSign, FiX, FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const WelcomeBonusModal = ({ 
  isOpen, 
  onClose, 
  bonusAmount = 100, 
  userName = 'Player',
  referralBonus = null // { received: false, amount: 0, referralCode: null }
}) => {
  const navigate = useNavigate();
  const [showCoins, setShowCoins] = useState(false);
  const [coinCount, setCoinCount] = useState(0);
  
  // Calculate total bonus amount
  const totalBonusAmount = bonusAmount + (referralBonus?.received ? referralBonus.amount : 0);
  const hasReferralBonus = referralBonus?.received && referralBonus.amount > 0;

  // Animate coin counter
  useEffect(() => {
    if (isOpen && showCoins) {
      let start = 0;
      const increment = totalBonusAmount / 50; // Animate over 50 steps
      const timer = setInterval(() => {
        start += increment;
        if (start >= totalBonusAmount) {
          setCoinCount(totalBonusAmount);
          clearInterval(timer);
        } else {
          setCoinCount(Math.floor(start));
        }
      }, 30);

      return () => clearInterval(timer);
    }
  }, [isOpen, showCoins, totalBonusAmount]);

  // Show coins animation after modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setShowCoins(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleCheckWallet = () => {
    toast.success('🎉 Welcome to Colab Esports! Your coins are ready!');
    onClose();
    setTimeout(() => {
      navigate('/wallet');
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
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-4 right-4 z-20 p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10 cursor-pointer"
              type="button"
              aria-label="Close modal"
            >
              <FiX className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative z-10 p-8 pt-12 text-center">
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
                  <div className="flex items-center justify-center space-x-3 mb-4">
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
                  
                  {/* Bonus Breakdown */}
                  <div className="space-y-2 mb-4">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.2 }}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gaming-gold flex items-center space-x-2">
                        <span>🎁</span>
                        <span>Welcome Bonus</span>
                      </span>
                      <span className="text-white font-medium">+{bonusAmount}</span>
                    </motion.div>
                    
                    {hasReferralBonus && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.4 }}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gaming-neon flex items-center space-x-2">
                          <span>🤝</span>
                          <span>Referral Bonus</span>
                        </span>
                        <span className="text-white font-medium">+{referralBonus.amount}</span>
                      </motion.div>
                    )}
                    
                    {hasReferralBonus && (
                      <div className="border-t border-gaming-border/30 pt-2">
                        <div className="flex items-center justify-between text-sm font-bold">
                          <span className="text-gaming-gold">Total Bonus</span>
                          <span className="text-gaming-gold">+{totalBonusAmount}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: hasReferralBonus ? 1.6 : 1.2 }}
                    className="text-gaming-gold font-medium text-sm text-center"
                  >
                    {hasReferralBonus ? (
                      <>🎉 Welcome & Referral Bonuses Credited!</>
                    ) : (
                      <>🎁 Welcome Bonus Credited!</>
                    )}
                  </motion.p>
                  
                  {hasReferralBonus && referralBonus.referralCode && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.8 }}
                      className="text-gaming-neon text-xs mt-2 text-center"
                    >
                      Thanks for using referral code: <span className="font-bold">{referralBonus.referralCode}</span>
                    </motion.p>
                  )}
                  
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: hasReferralBonus ? 2.0 : 1.4 }}
                    className="text-gray-400 text-xs mt-2 text-center"
                  >
                    Use these coins in our store or save them for future tournaments
                  </motion.p>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: hasReferralBonus ? 2.2 : 1.6 }}
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
              </motion.div>

              {/* Fun Facts */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: hasReferralBonus ? 2.4 : 2 }}
                className="mt-6 text-xs text-gray-500"
              >
                <p>💡 Tip: {hasReferralBonus ? 'Share your referral code to earn more coins!' : 'Earn more coins by participating in tournaments!'}</p>
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
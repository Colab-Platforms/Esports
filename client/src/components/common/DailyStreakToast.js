import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiZap } from 'react-icons/fi';

const MAX_DISPLAY_STREAK = 7;

const DailyStreakToast = ({ streak = 1, coins = 10, onClaim, onClose, claiming = false }) => {
  const displayStreak = Math.min(streak + 1, MAX_DISPLAY_STREAK); // next streak after claim
  const filledDots = Math.min(streak, MAX_DISPLAY_STREAK);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.85 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="relative flex items-center gap-3 p-4 pr-5 rounded-2xl shadow-2xl min-w-[320px] max-w-sm overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #252525 100%)',
          border: '1px solid rgba(241, 196, 15, 0.35)',
          boxShadow: '0 0 30px rgba(241,196,15,0.12), 0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {/* Gold shimmer top border */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, transparent, #f1c40f, #f39c12, transparent)' }}
        />

        {/* Flame icon */}
        <div
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(241,196,15,0.18), rgba(243,156,18,0.08))',
            border: '1px solid rgba(241,196,15,0.25)',
            boxShadow: '0 0 16px rgba(241,196,15,0.18)',
          }}
        >
          🔥
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: '#f1c40f', fontFamily: 'Orbitron, sans-serif', fontSize: '10px' }}
            >
              Day {displayStreak} Streak
            </span>
            {/* Streak dots */}
            <div className="flex gap-1">
              {[...Array(MAX_DISPLAY_STREAK)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: i < filledDots ? '#f1c40f' : '#3a3a3a',
                    boxShadow: i < filledDots ? '0 0 5px #f1c40f' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
          <p className="text-white text-sm font-medium leading-tight">
            Claim your daily{' '}
            <span style={{ color: '#f1c40f' }}>+{coins} coins</span>
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onClaim}
          disabled={claiming}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold text-black transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #f1c40f, #f39c12)',
            boxShadow: '0 4px 14px rgba(241,196,15,0.35)',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '10px',
          }}
        >
          <FiZap className="w-3 h-3" />
          {claiming ? '...' : 'Claim'}
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-300 transition-colors"
        >
          <FiX className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default DailyStreakToast;

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PremiumSplashScreen = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [phase, setPhase] = useState('glitch'); // glitch -> grid -> reveal -> complete

  useEffect(() => {
    const glitchTimer = setTimeout(() => setPhase('grid'), 800);
    const gridTimer = setTimeout(() => setPhase('reveal'), 1800);
    const completeTimer = setTimeout(() => setPhase('complete'), 3500);
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onComplete?.(), 500);
    }, 4000);

    return () => {
      clearTimeout(glitchTimer);
      clearTimeout(gridTimer);
      clearTimeout(completeTimer);
      clearTimeout(hideTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] bg-black overflow-hidden"
        >
          {/* Animated Grid Background */}
          <div className="absolute inset-0">
            {/* Perspective grid */}
            <svg className="absolute inset-0 w-full h-full" style={{ perspective: '1000px' }}>
              <defs>
                <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
                  <stop offset="50%" stopColor="#00f0ff" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Horizontal lines - Reduced for mobile */}
              {[...Array(10)].map((_, i) => (
                <motion.line
                  key={`h-${i}`}
                  x1="0"
                  y1={`${(i / 10) * 100}%`}
                  x2="100%"
                  y2={`${(i / 10) * 100}%`}
                  stroke="url(#gridGradient)"
                  strokeWidth="1"
                  initial={{ opacity: 0 }}
                  animate={phase !== 'glitch' ? { opacity: 0.2 } : {}}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                />
              ))}
              
              {/* Vertical lines - Reduced for mobile */}
              {[...Array(10)].map((_, i) => (
                <motion.line
                  key={`v-${i}`}
                  x1={`${(i / 10) * 100}%`}
                  y1="0"
                  x2={`${(i / 10) * 100}%`}
                  y2="100%"
                  stroke="url(#gridGradient)"
                  strokeWidth="1"
                  initial={{ opacity: 0 }}
                  animate={phase !== 'glitch' ? { opacity: 0.2 } : {}}
                  transition={{ duration: 0.8, delay: i * 0.05 }}
                />
              ))}
            </svg>
          </div>

          {/* Crosshair/Aim Icons - Gaming Style */}
          {phase !== 'glitch' && (
            <div className="absolute inset-0 opacity-20">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={`aim-${i}`}
                  className="absolute"
                  style={{
                    left: `${(i % 4) * 25 + 12.5}%`,
                    top: `${Math.floor(i / 4) * 50 + 25}%`,
                    width: '60px',
                    height: '60px'
                  }}
                  initial={{ scale: 0, rotate: 0, opacity: 0 }}
                  animate={{ scale: 1, rotate: 360, opacity: 0.3 }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                >
                  {/* Crosshair/Aim Icon */}
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    {/* Outer circle */}
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#FFD700" strokeWidth="2" />
                    <circle cx="50" cy="50" r="35" fill="none" stroke="#00f0ff" strokeWidth="1.5" />
                    {/* Crosshair lines */}
                    <line x1="50" y1="5" x2="50" y2="25" stroke="#FFD700" strokeWidth="2" />
                    <line x1="50" y1="75" x2="50" y2="95" stroke="#FFD700" strokeWidth="2" />
                    <line x1="5" y1="50" x2="25" y2="50" stroke="#00f0ff" strokeWidth="2" />
                    <line x1="75" y1="50" x2="95" y2="50" stroke="#00f0ff" strokeWidth="2" />
                    {/* Center dot */}
                    <circle cx="50" cy="50" r="3" fill="#FFD700" />
                  </svg>
                </motion.div>
              ))}
            </div>
          )}

          {/* Glitch Effect Bars - Reduced */}
          {phase === 'glitch' && (
            <>
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={`glitch-${i}`}
                  className="absolute w-full h-20 bg-gradient-to-r from-gaming-gold via-gaming-neon to-gaming-gold"
                  style={{
                    top: `${i * 25}%`,
                    mixBlendMode: 'screen'
                  }}
                  animate={{
                    x: [-window.innerWidth, window.innerWidth],
                    opacity: [0, 0.8, 0]
                  }}
                  transition={{
                    duration: 0.3,
                    delay: i * 0.15
                  }}
                />
              ))}
            </>
          )}

          {/* Scanning Lines */}
          {phase !== 'glitch' && (
            <>
              <motion.div
                className="absolute w-full h-1 bg-gaming-neon shadow-[0_0_20px_#00f0ff]"
                animate={{
                  y: [0, window.innerHeight]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
              <motion.div
                className="absolute w-1 h-full bg-gaming-gold shadow-[0_0_20px_#FFD700]"
                animate={{
                  x: [0, window.innerWidth]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </>
          )}

          {/* Main Content */}
          <div className="relative z-10 flex items-center justify-center h-full">
            {/* Phase 1: Glitch Logo - Colab Esports Logo */}
            {phase === 'glitch' && (
              <motion.div
                className="relative w-64 h-64 md:w-80 md:h-80"
                animate={{
                  x: [0, -10, 10, -5, 5, 0],
                  y: [0, 5, -5, 3, -3, 0]
                }}
                transition={{
                  duration: 0.5,
                  repeat: 1
                }}
              >
                {/* Main Logo */}
                <motion.img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Coloab_Esports_log_Yellow_2.0.png?v=1764827729"
                  alt="Colab Esports Logo"
                  className="w-full h-full object-contain"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 60px rgba(0, 240, 255, 0.4))'
                  }}
                />
                
                {/* Glitch clone - Cyan */}
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Coloab_Esports_log_Yellow_2.0.png?v=1764827729"
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain opacity-50"
                  style={{ 
                    transform: 'translate(-5px, -5px)',
                    filter: 'hue-rotate(180deg) brightness(1.2)'
                  }}
                />
                
                {/* Glitch clone - Red */}
                <img
                  src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/Coloab_Esports_log_Yellow_2.0.png?v=1764827729"
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain opacity-50"
                  style={{ 
                    transform: 'translate(5px, 5px)',
                    filter: 'hue-rotate(90deg) brightness(1.2)'
                  }}
                />
              </motion.div>
            )}

            {/* Phase 2 & 3: Text Reveal */}
            {(phase === 'grid' || phase === 'reveal' || phase === 'complete') && (
              <div className="text-center">
                {/* Main Title - Marvel Style Clean & Mobile Responsive */}
                <div className="relative mb-8 px-4">
                  <motion.h1
                    className="text-5xl sm:text-7xl md:text-8xl lg:text-[10rem] font-black tracking-wider relative uppercase whitespace-nowrap"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {/* Clean white/silver metallic text - Marvel style */}
                    <span className="relative inline-block">
                      {'COLAB ESPORTS'.split('').map((letter, i) => (
                        <motion.span
                          key={i}
                          className="inline-block"
                          initial={{ y: 50, opacity: 0, scale: 0.5 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          transition={{
                            duration: 0.4,
                            delay: i * 0.06,
                            ease: "easeOut"
                          }}
                          style={{
                            fontWeight: 900,
                            color: '#ffffff',
                            textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 5px 15px rgba(0, 0, 0, 0.5)',
                            letterSpacing: '0.02em'
                          }}
                        >
                          {letter}
                        </motion.span>
                      ))}
                    </span>
                  </motion.h1>

                  {/* Subtle underline glow */}
                  <motion.div
                    className="absolute -bottom-2 left-1/2 h-0.5"
                    initial={{ width: 0, x: '-50%' }}
                    animate={{ width: '80%', x: '-50%' }}
                    transition={{ duration: 0.8, delay: 1 }}
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)',
                      boxShadow: '0 0 10px rgba(255, 255, 255, 0.3)'
                    }}
                  />
                </div>

                {/* Subtitle */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5 }}
                  className="text-2xl tracking-[0.5em] text-gray-300 font-light mb-6"
                  style={{
                    textShadow: '0 0 10px rgba(0, 240, 255, 0.5)'
                  }}
                >
                  GAMING PLATFORM
                </motion.div>

                {/* Tagline with scan effect */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2 }}
                  className="relative inline-block"
                >
                  <span className="text-gaming-neon text-xl tracking-widest font-bold">
                    LEVEL UP YOUR GAME
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-50"
                    animate={{
                      x: [-200, 400]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  />
                </motion.div>
              </div>
            )}
          </div>

          {/* Corner HUD Elements */}
          {phase !== 'glitch' && (
            <>
              {/* Top Left HUD */}
              <motion.div
                className="absolute top-4 left-4 text-gaming-neon font-mono text-xs"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
              >
                <div className="border border-gaming-neon p-2 bg-black/50">
                  <div>SYSTEM: ONLINE</div>
                  <div>STATUS: LOADING...</div>
                </div>
              </motion.div>

              {/* Top Right HUD */}
              <motion.div
                className="absolute top-4 right-4 text-gaming-gold font-mono text-xs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2 }}
              >
                <div className="border border-gaming-gold p-2 bg-black/50">
                  <div>ESPORTS.COM</div>
                  <div>v2.0.0</div>
                </div>
              </motion.div>
            </>
          )}

          <style jsx>{`
            @keyframes shimmer {
              0% { background-position: 0% center; }
              100% { background-position: 200% center; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumSplashScreen;

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [phase, setPhase] = useState('intro'); // intro -> reveal -> complete

  useEffect(() => {
    // Phase 1: Intro (0-1.5s)
    const introTimer = setTimeout(() => {
      setPhase('reveal');
    }, 1500);

    // Phase 2: Reveal (1.5-3.5s)
    const revealTimer = setTimeout(() => {
      setPhase('complete');
    }, 3500);

    // Phase 3: Fade out (3.5-4s)
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 500);
    }, 4000);

    return () => {
      clearTimeout(introTimer);
      clearTimeout(revealTimer);
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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
          style={{
            perspective: '1000px'
          }}
        >
          {/* Cinematic Background with Light Rays */}
          <div className="absolute inset-0">
            {/* Radial gradient background */}
            <div className="absolute inset-0 bg-gradient-radial from-gaming-charcoal/50 via-black to-black"></div>
            
            {/* Light rays */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={`ray-${i}`}
                className="absolute top-1/2 left-1/2 w-1 h-full origin-top"
                style={{
                  background: `linear-gradient(to bottom, rgba(255, 215, 0, ${0.1 + Math.random() * 0.2}), transparent)`,
                  transform: `rotate(${i * 30}deg)`,
                  transformOrigin: 'top center'
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{
                  scaleY: phase === 'intro' ? 0 : [0, 1.5, 1],
                  opacity: phase === 'intro' ? 0 : [0, 0.6, 0.3],
                  rotate: [i * 30, i * 30 + 360]
                }}
                transition={{
                  scaleY: { duration: 1, delay: 0.5 },
                  opacity: { duration: 1, delay: 0.5 },
                  rotate: { duration: 20, repeat: Infinity, ease: "linear" }
                }}
              />
            ))}
          </div>

          {/* Particle Explosion Effect */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(50)].map((_, i) => {
              const angle = (i / 50) * Math.PI * 2;
              const distance = 100 + Math.random() * 400;
              return (
                <motion.div
                  key={`particle-${i}`}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#00f0ff' : '#fff',
                    boxShadow: `0 0 10px ${i % 3 === 0 ? '#FFD700' : i % 3 === 1 ? '#00f0ff' : '#fff'}`
                  }}
                  initial={{
                    x: '50vw',
                    y: '50vh',
                    scale: 0,
                    opacity: 0
                  }}
                  animate={phase !== 'intro' ? {
                    x: `calc(50vw + ${Math.cos(angle) * distance}px)`,
                    y: `calc(50vh + ${Math.sin(angle) * distance}px)`,
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0]
                  } : {}}
                  transition={{
                    duration: 1.5,
                    delay: 0.3 + Math.random() * 0.5,
                    ease: "easeOut"
                  }}
                />
              );
            })}
          </div>

          {/* Main Content - Cinematic Reveal */}
          <div className="relative z-10 text-center">
            {/* Phase 1: Logo Intro */}
            {phase === 'intro' && (
              <motion.div
                initial={{ scale: 0, rotateY: -180 }}
                animate={{ scale: 1, rotateY: 0 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative"
              >
                {/* Glowing Ring */}
                <motion.div
                  className="absolute inset-0 -m-20"
                  animate={{
                    rotate: 360,
                    scale: [1, 1.2, 1]
                  }}
                  transition={{
                    rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                >
                  <div className="w-full h-full rounded-full border-4 border-gaming-gold opacity-30 blur-sm"></div>
                </motion.div>

                {/* Logo */}
                <motion.div
                  className="w-32 h-32 mx-auto relative"
                  animate={{
                    rotateY: [0, 360]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gaming-gold via-gaming-neon to-gaming-gold rounded-full blur-2xl opacity-60 animate-pulse"></div>
                  <div className="relative w-full h-full bg-gradient-to-br from-gaming-gold to-gaming-neon rounded-full flex items-center justify-center shadow-2xl">
                    <span className="text-6xl">🎮</span>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Phase 2: Epic Text Reveal */}
            {phase === 'reveal' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Main Title with 3D Effect */}
                <div className="relative mb-8">
                  {/* Shadow layers for 3D depth */}
                  {[...Array(5)].map((_, i) => (
                    <motion.h1
                      key={`shadow-${i}`}
                      className="absolute inset-0 text-7xl md:text-9xl font-black"
                      style={{
                        transform: `translateZ(${-i * 10}px) translateY(${i * 2}px)`,
                        opacity: 0.1 - i * 0.02,
                        color: '#FFD700',
                        textShadow: '0 0 30px rgba(255, 215, 0, 0.5)'
                      }}
                      initial={{ y: 100, opacity: 0 }}
                      animate={{ y: 0, opacity: 0.1 - i * 0.02 }}
                      transition={{ duration: 0.8, delay: i * 0.05 }}
                    >
                      ESPORTS
                    </motion.h1>
                  ))}

                  {/* Main text with letter animation */}
                  <h1 className="relative text-7xl md:text-9xl font-black">
                    {'ESPORTS'.split('').map((letter, i) => (
                      <motion.span
                        key={i}
                        className="inline-block"
                        style={{
                          background: 'linear-gradient(45deg, #FFD700, #00f0ff, #FFD700)',
                          backgroundSize: '200% auto',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          textShadow: '0 0 80px rgba(255, 215, 0, 0.8)',
                          filter: 'drop-shadow(0 0 20px rgba(0, 240, 255, 0.6))'
                        }}
                        initial={{ 
                          y: -100, 
                          opacity: 0,
                          rotateX: -90,
                          scale: 0
                        }}
                        animate={{ 
                          y: 0, 
                          opacity: 1,
                          rotateX: 0,
                          scale: 1
                        }}
                        transition={{
                          duration: 0.6,
                          delay: i * 0.1,
                          type: "spring",
                          stiffness: 200
                        }}
                      >
                        {letter}
                      </motion.span>
                    ))}
                  </h1>

                  {/* Glowing underline */}
                  <motion.div
                    className="absolute -bottom-4 left-1/2 h-1 bg-gradient-to-r from-transparent via-gaming-gold to-transparent"
                    initial={{ width: 0, x: '-50%' }}
                    animate={{ width: '80%', x: '-50%' }}
                    transition={{ duration: 1, delay: 0.8 }}
                    style={{
                      boxShadow: '0 0 20px rgba(255, 215, 0, 0.8)'
                    }}
                  />
                </div>

                {/* Subtitle with typewriter effect */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 }}
                  className="text-xl md:text-2xl tracking-[0.3em] text-gray-300 font-light mb-8"
                >
                  {'GAMING PLATFORM'.split('').map((letter, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 + i * 0.05 }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </motion.div>

                {/* Epic tagline */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2, duration: 0.8 }}
                  className="text-gaming-neon text-lg tracking-widest font-semibold"
                  style={{
                    textShadow: '0 0 20px rgba(0, 240, 255, 0.8)'
                  }}
                >
                  LEVEL UP YOUR GAME
                </motion.p>
              </motion.div>
            )}
          </div>

          {/* Cinematic Corner Frames */}
          {phase !== 'intro' && (
            <>
              {/* Top Left */}
              <motion.div
                className="absolute top-0 left-0 w-40 h-40"
                initial={{ x: -100, y: -100, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gaming-gold to-transparent"></div>
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-gaming-gold to-transparent"></div>
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-gaming-gold opacity-50"></div>
              </motion.div>

              {/* Top Right */}
              <motion.div
                className="absolute top-0 right-0 w-40 h-40"
                initial={{ x: 100, y: -100, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-gaming-neon to-transparent"></div>
                <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-gaming-neon to-transparent"></div>
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-gaming-neon opacity-50"></div>
              </motion.div>

              {/* Bottom Left */}
              <motion.div
                className="absolute bottom-0 left-0 w-40 h-40"
                initial={{ x: -100, y: 100, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7 }}
              >
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-gaming-neon to-transparent"></div>
                <div className="absolute bottom-0 left-0 w-1 h-full bg-gradient-to-t from-gaming-neon to-transparent"></div>
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-gaming-neon opacity-50"></div>
              </motion.div>

              {/* Bottom Right */}
              <motion.div
                className="absolute bottom-0 right-0 w-40 h-40"
                initial={{ x: 100, y: 100, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-l from-gaming-gold to-transparent"></div>
                <div className="absolute bottom-0 right-0 w-1 h-full bg-gradient-to-t from-gaming-gold to-transparent"></div>
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-gaming-gold opacity-50"></div>
              </motion.div>
            </>
          )}

          {/* Vignette Effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black opacity-60"></div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;

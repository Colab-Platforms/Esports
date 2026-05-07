import React, { useState, useEffect } from 'react';
import { HiDownload } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';

const InstallPWA = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      console.log("PWA install prompt intercepted");
      setSupportsPWA(true);
      setPromptInstall(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setSupportsPWA(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onClick = (evt) => {
    evt.preventDefault();
    if (!promptInstall) {
      return;
    }
    promptInstall.prompt();
    promptInstall.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setSupportsPWA(false);
      } else {
        console.log('User dismissed the install prompt');
      }
    });
  };

  return (
    <AnimatePresence>
      {supportsPWA && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-[9999]"
        >
          <button
            onClick={onClick}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold rounded-full shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)] transition-all duration-300 group"
          >
            <HiDownload className="text-xl group-hover:bounce" />
            <span className="hidden md:inline">Install App</span>
            <span className="md:hidden">Install</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPWA;

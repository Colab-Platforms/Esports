import React, { useState, useEffect } from 'react';
import { HiDownload } from 'react-icons/hi';
import { MdClose } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';

// Detect iOS (iPhone / iPad / iPod)
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ reports as MacIntel with touch
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Detect if already running as a standalone PWA
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const DISMISSED_KEY = 'pwaInstallDismissed';
const ENGAGED_KEY = 'pwaInstallEngaged';
export const PWA_ENGAGEMENT_EVENT = 'pwaEngagement';

// Call after a meaningful action (e.g. joining a tournament) to allow the install prompt.
export const markPwaEngaged = () => {
  try {
    localStorage.setItem(ENGAGED_KEY, 'true');
  } catch (e) { /* storage unavailable */ }
  window.dispatchEvent(new Event(PWA_ENGAGEMENT_EVENT));
};

const readFlag = (key) => {
  try {
    return localStorage.getItem(key) === 'true';
  } catch (e) {
    return false;
  }
};

// `suppressed` hides the prompt while another floating prompt is on screen.
// `onVisibleChange` lets the page reserve space so the pill never covers content.
const InstallPWA = ({ suppressed = false, onVisibleChange }) => {
  const [promptInstall, setPromptInstall] = useState(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(() => readFlag(DISMISSED_KEY));
  const [engaged, setEngaged] = useState(() => readFlag(ENGAGED_KEY));
  const [showIOSModal, setShowIOSModal] = useState(false);

  const showBanner = canPrompt && engaged && !dismissed && !suppressed;

  useEffect(() => {
    if (onVisibleChange) onVisibleChange(showBanner);
  }, [showBanner, onVisibleChange]);

  useEffect(() => {
    const handleEngaged = () => setEngaged(true);
    window.addEventListener(PWA_ENGAGEMENT_EVENT, handleEngaged);
    return () => window.removeEventListener(PWA_ENGAGEMENT_EVENT, handleEngaged);
  }, []);

  useEffect(() => {
    // Already installed or previously dismissed → do nothing
    if (isStandalone() || readFlag(DISMISSED_KEY)) return;

    // ── Android / Windows / Desktop Chrome / Edge ──────────────────────────
    // The global script in index.html captures the event before React mounts.
    // Read it here first, then also listen for future deliveries.

    const handlePrompt = (e) => {
      // e can be the native BeforeInstallPromptEvent or our CustomEvent
      const nativePrompt = e instanceof Event && e.type === 'pwaInstallReady'
        ? window.__pwaInstallPrompt
        : e;

      if (nativePrompt && typeof nativePrompt.prompt === 'function') {
        setPromptInstall(nativePrompt);
        setCanPrompt(true);
      }
    };

    // Already captured before React mounted?
    if (window.__pwaInstallPrompt) {
      setPromptInstall(window.__pwaInstallPrompt);
      setCanPrompt(true);
    }

    // Listen for future prompt events (first load) and our custom relay
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('pwaInstallReady', handlePrompt);

    // ── iOS Safari ─────────────────────────────────────────────────────────
    // iOS never fires beforeinstallprompt. Show the banner with instructions.
    if (isIOS()) {
      setCanPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('pwaInstallReady', handlePrompt);
    };
  }, []);

  // ── Click handlers ────────────────────────────────────────────────────────

  const handleInstallClick = async () => {
    if (isIOS()) {
      // Show the step-by-step iOS modal instead of an alert
      setShowIOSModal(true);
      return;
    }

    if (promptInstall) {
      try {
        promptInstall.prompt();
        const { outcome } = await promptInstall.userChoice;
        console.log('[PWA] Install outcome:', outcome);
        // Whether accepted or dismissed, clean up
        window.__pwaInstallPrompt = null;
        setPromptInstall(null);
        persistDismissed();
      } catch (err) {
        console.error('[PWA] prompt() error:', err);
      }
    }
  };

  // Dismissal is kept across visits (localStorage), not just the session.
  const persistDismissed = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch (e) { /* storage unavailable */ }
  };

  const handleDismiss = () => persistDismissed();

  const handleIOSClose = () => {
    setShowIOSModal(false);
    persistDismissed();
  };

  // Don't render anything if already installed
  if (isStandalone()) return null;

  return (
    <>
      {/* ── Install Banner (bottom-right floating pill) ── */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            key="pwa-banner"
            initial={{ opacity: 0, y: 80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-[9998]"
          >
            <div className="flex items-center gap-2 pl-4 pr-2 py-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black font-bold rounded-full shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:shadow-[0_0_30px_rgba(234,179,8,0.7)] transition-all duration-300">
              <button
                id="pwa-install-btn"
                onClick={handleInstallClick}
                className="flex items-center gap-2 group"
                aria-label="Install App"
              >
                <HiDownload className="text-xl group-hover:animate-bounce" />
                <span className="hidden md:inline text-sm">Install App</span>
                <span className="md:hidden text-sm">Install</span>
              </button>
              <button
                id="pwa-dismiss-btn"
                onClick={handleDismiss}
                className="ml-1 p-1 rounded-full hover:bg-black/20 transition-colors"
                aria-label="Dismiss install banner"
              >
                <MdClose className="text-base" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── iOS Instructions Modal ── */}
      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            key="ios-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 backdrop-blur-sm pb-6"
            onClick={handleIOSClose}
          >
            <motion.div
              key="ios-modal-card"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(234,179,8,0.3)',
                boxShadow: '0 0 40px rgba(234,179,8,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/colab_esport_logo.png"
                    alt="Colab Esports"
                    className="w-10 h-10 rounded-xl object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div>
                    <p className="text-white font-bold text-base leading-tight">Install Colab Esports</p>
                    <p className="text-yellow-400 text-xs">Add to Home Screen</p>
                  </div>
                </div>
                <button
                  onClick={handleIOSClose}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  aria-label="Close"
                >
                  <MdClose className="text-xl" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-yellow-400/20 mx-5" />

              {/* Steps */}
              <div className="px-5 py-4 space-y-4">
                {[
                  {
                    step: '1',
                    icon: '⬆️',
                    text: (
                      <>
                        Tap the <span className="text-yellow-400 font-semibold">Share</span> button at the bottom of Safari
                      </>
                    ),
                  },
                  {
                    step: '2',
                    icon: '➕',
                    text: (
                      <>
                        Scroll down and tap{' '}
                        <span className="text-yellow-400 font-semibold">"Add to Home Screen"</span>
                      </>
                    ),
                  },
                  {
                    step: '3',
                    icon: '✅',
                    text: (
                      <>
                        Tap <span className="text-yellow-400 font-semibold">"Add"</span> in the top-right corner
                      </>
                    ),
                  },
                ].map(({ step, icon, text }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black"
                      style={{ background: 'linear-gradient(135deg, #facc15, #ca8a04)' }}
                    >
                      {step}
                    </div>
                    <p className="text-gray-200 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              {/* Footer hint */}
              <div className="px-5 pb-5">
                <p className="text-gray-500 text-xs text-center">
                  Open in Safari for the best experience
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default InstallPWA;

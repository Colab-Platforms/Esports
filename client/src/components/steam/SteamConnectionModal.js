import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiExternalLink, FiCheck, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';
import { getSteamAuthUrl } from '../../utils/apiConfig';

const SteamConnectionModal = ({ isOpen, onClose, onSuccess, gameType = 'cs2' }) => {
  const [loading, setLoading] = useState(false);
  const [steamStatus, setSteamStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      checkSteamStatus();
    }
  }, [isOpen]);

  const checkSteamStatus = async () => {
    try {
      setLoading(true);
      const status = await api.get('/api/steam/status');
      setSteamStatus(status);
      
      // If already connected and eligible, close modal
      if (status.isConnected && status.steamGames?.cs2?.verified) {
        onSuccess(status);
        onClose();
      }
    } catch (error) {
      console.error('Error checking Steam status:', error);
      setError('Failed to check Steam connection status');
    } finally {
      setLoading(false);
    }
  };

  const connectSteam = () => {
    // Get userId from auth token
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in first');
      return;
    }
    
    // Decode token to get userId
    let userId;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.userId || payload.id;
    } catch (error) {
      setError('Invalid authentication. Please log in again.');
      return;
    }
    
    if (!userId) {
      setError('Please log in first');
      return;
    }
    
    // Try to open Steam app first (if installed)
    const openSteamApp = () => {
      try {
        // Steam protocol URL to open Steam client
        const steamUrl = 'steam://open/main';
        
        // Create a temporary link to trigger Steam app
        const link = document.createElement('a');
        link.href = steamUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show user-friendly message
        setError('');
        setLoading(true);
        
        // Wait a moment then redirect to web OAuth as fallback - uses dynamic URL
        setTimeout(() => {
          window.location.href = getSteamAuthUrl(userId);
        }, 1500);
        
      } catch (error) {
        console.log('Steam app not available, using web OAuth');
        // Fallback to web OAuth - uses dynamic URL
        window.location.href = getSteamAuthUrl(userId);
      }
    };

    // Show confirmation dialog
    const userConfirmed = window.confirm(
      'Steam ID is required for CS2 tournaments.\n\n' +
      'Click OK to:\n' +
      '1. Open Steam app (if installed)\n' +
      '2. Login to Steam\n' +
      '3. Connect your account\n\n' +
      'Continue?'
    );

    if (userConfirmed) {
      openSteamApp();
    }
  };

  const checkEligibility = async () => {
    try {
      setLoading(true);
      const eligibility = await api.get('/api/steam/cs2/eligibility');
      
      if (eligibility.eligible) {
        onSuccess(eligibility);
        onClose();
      } else {
        setError(eligibility.reason || 'Not eligible for CS2 tournaments');
      }
    } catch (error) {
      console.error('Error checking eligibility:', error);
      setError('Failed to check tournament eligibility');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gaming-card rounded-xl p-6 w-full max-w-md border border-gaming-border shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center">
              <span className="text-2xl mr-2">🎮</span>
              Steam Required
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-gold mx-auto mb-4"></div>
              <p className="text-gray-300">Checking Steam connection...</p>
            </div>
          ) : !steamStatus?.isConnected ? (
            // Not Connected
            <div>
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🔗</div>
                <h4 className="text-lg font-bold text-white mb-2">Connect Steam Account</h4>
                <p className="text-gray-400 text-sm">
                  CS2 tournaments require a connected Steam account with CS2 ownership and minimum playtime.
                </p>
              </div>

              <div className="bg-gaming-dark p-4 rounded-lg mb-6">
                <h5 className="text-white font-bold mb-3">Requirements:</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                    Steam account connection
                  </div>
                  <div className="flex items-center text-gray-300">
                    <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                    CS2 game ownership
                  </div>
                  <div className="flex items-center text-gray-300">
                    <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                    Minimum 2 hours playtime
                  </div>
                  <div className="flex items-center text-gray-300">
                    <FiCheck className="h-4 w-4 text-green-400 mr-2" />
                    Account age 7+ days
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <div className="flex items-center text-red-400 text-sm">
                    <FiAlertCircle className="h-4 w-4 mr-2" />
                    {error}
                  </div>
                </div>
              )}

              <button
                onClick={connectSteam}
                className="w-full btn-gaming flex items-center justify-center space-x-2"
              >
                <FiExternalLink className="h-5 w-5" />
                <span>Connect with Steam</span>
              </button>
            </div>
          ) : (
            // Connected but checking eligibility
            <div>
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">⚡</div>
                <h4 className="text-lg font-bold text-white mb-2">Steam Connected</h4>
                <p className="text-gray-400 text-sm">
                  Checking CS2 tournament eligibility...
                </p>
              </div>

              {/* Steam Profile */}
              <div className="bg-gaming-dark p-4 rounded-lg mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <img
                    src={steamStatus.steamProfile?.avatar}
                    alt="Steam Avatar"
                    className="w-12 h-12 rounded-full border-2 border-gaming-gold"
                  />
                  <div>
                    <div className="text-white font-bold">
                      {steamStatus.steamProfile?.displayName}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Steam ID: {steamStatus.steamId}
                    </div>
                  </div>
                </div>

                {/* CS2 Status */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">CS2 Owned:</span>
                    <span className={`flex items-center ${steamStatus.steamGames?.cs2?.owned ? 'text-green-400' : 'text-red-400'}`}>
                      {steamStatus.steamGames?.cs2?.owned ? <FiCheck className="h-4 w-4" /> : <FiX className="h-4 w-4" />}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Playtime:</span>
                    <span className="text-white">
                      {Math.floor((steamStatus.steamGames?.cs2?.playtime || 0) / 60)}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Tournament Eligible:</span>
                    <span className={`flex items-center ${steamStatus.steamGames?.cs2?.verified ? 'text-green-400' : 'text-red-400'}`}>
                      {steamStatus.steamGames?.cs2?.verified ? <FiCheck className="h-4 w-4" /> : <FiX className="h-4 w-4" />}
                    </span>
                  </div>
                </div>
              </div>

              {!steamStatus.steamGames?.cs2?.verified && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center text-yellow-400 text-sm">
                    <FiAlertCircle className="h-4 w-4 mr-2" />
                    {!steamStatus.steamGames?.cs2?.owned 
                      ? 'CS2 ownership required for tournaments'
                      : 'Minimum 2 hours of CS2 playtime required'
                    }
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={checkEligibility}
                  disabled={!steamStatus.steamGames?.cs2?.verified}
                  className="flex-1 btn-gaming disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SteamConnectionModal;
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

const SteamIntegration = ({ onSteamConnected, onCancel, gameType = 'cs2' }) => {
  const [steamId, setSteamId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [steamProfile, setSteamProfile] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('input'); // input, validating, profile, connecting

  const validateSteamId = async () => {
    if (!steamId.trim()) {
      setError('Please enter your Steam ID');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Validate Steam ID format
      const steamIdPattern = /^(STEAM_[0-5]:[01]:[0-9]+|7656119[0-9]{10})$/;
      if (!steamIdPattern.test(steamId.trim())) {
        throw new Error('Invalid Steam ID format. Please enter a valid Steam ID.');
      }

      // Mock API call for development
      const mockProfile = {
        steamid: steamId,
        personaname: `Player_${steamId.slice(-4)}`,
        profileurl: `https://steamcommunity.com/profiles/${steamId}`,
        avatar: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb.jpg',
        avatarmedium: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg',
        ownsCS2: true,
        lastLogoff: Date.now() / 1000 - 3600
      };

      setSteamProfile(mockProfile);
      setStep('profile');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const connectSteam = async () => {
    setStep('connecting');
    
    try {
      // Simulate API call to save Steam ID
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onSteamConnected({
        steamId: steamProfile.steamid,
        steamName: steamProfile.personaname,
        steamAvatar: steamProfile.avatar,
        ownsCS2: steamProfile.ownsCS2
      });
    } catch (error) {
      setError('Failed to connect Steam account. Please try again.');
      setStep('profile');
    }
  };

  const handleSteamLogin = () => {
    // In production, this would redirect to Steam OpenID
    const returnUrl = `${window.location.origin}/steam-callback`;
    const steamLoginUrl = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(window.location.origin)}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
    
    // For demo purposes, we'll simulate the login
    alert('In production, this would redirect to Steam for authentication. For demo, please enter your Steam ID manually.');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gaming-charcoal rounded-lg p-6 w-full max-w-md"
      >
        {step === 'input' && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-white mb-2">Connect Steam Account</h3>
              <p className="text-gray-300 text-sm">
                {gameType === 'cs2' 
                  ? 'CS2 tournaments require a Steam account with CS2 ownership'
                  : 'Connect your Steam account to participate'
                }
              </p>
            </div>

            <div className="space-y-4">
              {/* Steam Login Button */}
              <button
                onClick={handleSteamLogin}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <span>🔗</span>
                <span>Sign in through Steam</span>
              </button>

              <div className="flex items-center space-x-4">
                <div className="flex-1 h-px bg-gray-600"></div>
                <span className="text-gray-400 text-sm">OR</span>
                <div className="flex-1 h-px bg-gray-600"></div>
              </div>

              {/* Manual Steam ID Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Enter Steam ID Manually
                </label>
                <input
                  type="text"
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="STEAM_1:0:123456 or 76561198XXXXXXXXX"
                  className="w-full px-3 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Find your Steam ID at steamid.io or in your Steam profile
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <div className="text-red-400 text-sm">{error}</div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={validateSteamId}
                  disabled={isValidating || !steamId.trim()}
                  className="flex-1 btn-gaming disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Validating...
                    </span>
                  ) : (
                    'Validate Steam ID'
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'profile' && steamProfile && (
          <>
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-white mb-2">Steam Account Found</h3>
              <p className="text-gray-300 text-sm">
                Confirm this is your Steam account
              </p>
            </div>

            <div className="bg-gaming-dark rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-4">
                <img
                  src={steamProfile.avatarmedium}
                  alt="Steam Avatar"
                  className="w-16 h-16 rounded-full"
                />
                <div>
                  <div className="text-white font-bold">{steamProfile.personaname}</div>
                  <div className="text-gray-400 text-sm">Steam ID: {steamProfile.steamid}</div>
                  {gameType === 'cs2' && (
                    <div className={`text-sm ${steamProfile.ownsCS2 ? 'text-green-400' : 'text-red-400'}`}>
                      {steamProfile.ownsCS2 ? '✅ Owns CS2' : '❌ Does not own CS2'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {gameType === 'cs2' && !steamProfile.ownsCS2 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                <div className="text-red-400 font-medium mb-2">CS2 Required</div>
                <div className="text-gray-300 text-sm">
                  You need to own Counter-Strike 2 on Steam to participate in CS2 tournaments.
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setStep('input')}
                className="flex-1 px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
              >
                Back
              </button>
              <button
                onClick={connectSteam}
                disabled={gameType === 'cs2' && !steamProfile.ownsCS2}
                className="flex-1 btn-gaming disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect Account
              </button>
            </div>
          </>
        )}

        {step === 'connecting' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-white mb-2">Connecting Steam Account</h3>
            <p className="text-gray-300">Please wait while we set up your account...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SteamIntegration;
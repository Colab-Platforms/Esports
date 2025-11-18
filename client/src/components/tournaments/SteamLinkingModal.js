import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiExternalLink, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { SiSteam } from 'react-icons/si';

const SteamLinkingModal = ({ isOpen, onClose, onConfirm, tournamentName }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-gaming-card border-2 border-gaming-gold rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        >
          {/* Header with Steam Gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]"></div>
            </div>
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <FiX className="h-5 w-5 text-white" />
            </button>

            <div className="relative flex items-center space-x-4">
              <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <SiSteam className="h-10 w-10 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Link Steam Account</h2>
                <p className="text-blue-100 text-sm">Required for CS2 Tournaments</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Tournament Info */}
            <div className="bg-gaming-slate border border-gaming-border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <FiAlertCircle className="h-5 w-5 text-gaming-gold" />
                <span className="text-white font-semibold">Tournament Requirement</span>
              </div>
              <p className="text-gray-300 text-sm">
                <span className="text-gaming-gold font-semibold">{tournamentName}</span> requires a verified Steam account to participate.
              </p>
            </div>

            {/* What Happens */}
            <div>
              <h3 className="text-white font-bold mb-3 flex items-center space-x-2">
                <span>What will happen:</span>
              </h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Steam Login Page Opens</div>
                    <div className="text-gray-400 text-sm">You'll be redirected to Steam's official login page</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Authorize Colab Esports</div>
                    <div className="text-gray-400 text-sm">Grant permission to access your Steam profile</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium">Return to Tournament</div>
                    <div className="text-gray-400 text-sm">You'll be redirected back to complete registration</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Note */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <FiAlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-blue-400 font-semibold text-sm mb-1">Secure & Safe</div>
                  <div className="text-gray-300 text-xs">
                    We only access your public Steam profile. Your login credentials are never shared with us.
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gaming-slate hover:bg-gaming-border text-white rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/50 flex items-center justify-center space-x-2"
              >
                <SiSteam className="h-5 w-5" />
                <span>Connect Steam</span>
                <FiExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SteamLinkingModal;

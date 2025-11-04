import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheck, FiX, FiExternalLink, FiSettings } from 'react-icons/fi';
import api from '../../services/api';

const SteamStatusWidget = () => {
  const [steamData, setSteamData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSteamStatus();
  }, []);

  const fetchSteamStatus = async () => {
    try {
      const status = await api.getSteamStatus();
      setSteamData(status);
    } catch (error) {
      console.error('Error fetching Steam status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gaming-card rounded-lg border border-gaming-border p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gaming-card rounded-lg border border-gaming-border p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold flex items-center">
          <span className="text-lg mr-2">🎮</span>
          Steam Status
        </h3>
        <Link
          to="/steam-settings"
          className="p-1 text-gray-400 hover:text-gaming-gold transition-colors"
          title="Steam Settings"
        >
          <FiSettings className="h-4 w-4" />
        </Link>
      </div>

      {!steamData?.isConnected ? (
        <div className="text-center py-4">
          <div className="text-3xl mb-2">🔗</div>
          <p className="text-gray-400 text-sm mb-3">Connect Steam for CS2 tournaments</p>
          <Link
            to="/steam-settings"
            className="inline-flex items-center space-x-1 text-gaming-gold hover:text-white text-sm transition-colors"
          >
            <FiExternalLink className="h-3 w-3" />
            <span>Connect Steam</span>
          </Link>
        </div>
      ) : (
        <div>
          <div className="flex items-center space-x-3 mb-3">
            <img
              src={steamData.steamProfile?.avatar}
              alt="Steam Avatar"
              className="w-10 h-10 rounded-full border border-gaming-gold"
            />
            <div>
              <div className="text-white font-medium text-sm">
                {steamData.steamProfile?.displayName}
              </div>
              <div className="text-green-400 text-xs flex items-center">
                <FiCheck className="h-3 w-3 mr-1" />
                Connected
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">CS2 Owned:</span>
              <span className={`flex items-center ${steamData.steamGames?.cs2?.owned ? 'text-green-400' : 'text-red-400'}`}>
                {steamData.steamGames?.cs2?.owned ? <FiCheck className="h-3 w-3" /> : <FiX className="h-3 w-3" />}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Tournament Ready:</span>
              <span className={`flex items-center ${steamData.steamGames?.cs2?.verified ? 'text-green-400' : 'text-red-400'}`}>
                {steamData.steamGames?.cs2?.verified ? <FiCheck className="h-3 w-3" /> : <FiX className="h-3 w-3" />}
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SteamStatusWidget;
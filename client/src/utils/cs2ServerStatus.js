// CS2 Server Status Utility
// This utility provides server status information for CS2 tournaments

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Cache for server status
const statusCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Fetch server status from backend API
 * @param {string} ip - Server IP
 * @param {string} port - Server port
 * @returns {Promise<Object>} Server status
 */
async function fetchServerStatus(ip, port) {
  try {
    const response = await fetch(`${API_URL}/api/cs2-server/status/${ip}/${port}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data.server;
    }
    
    throw new Error(data.error?.message || 'Failed to fetch server status');
  } catch (error) {
    console.error('❌ Failed to fetch server status:', error);
    return {
      isOnline: false,
      currentPlayers: 0,
      maxPlayers: 0,
      map: 'Unknown',
      gameMode: 'Unknown',
      ping: 0,
      error: error.message
    };
  }
}

/**
 * Get server status for a CS2 tournament (with caching)
 * @param {Object} tournament - Tournament object with roomDetails
 * @returns {Promise<Object>} Server status information
 */
export const getCS2ServerStatus = async (tournament) => {
  if (!tournament || tournament.gameType !== 'cs2' || !tournament.roomDetails?.cs2) {
    return null;
  }

  const serverInfo = tournament.roomDetails.cs2;
  const cacheKey = `${serverInfo.serverIp}:${serverInfo.serverPort}`;
  
  // Check cache
  const cached = statusCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  // Fetch fresh data
  const status = await fetchServerStatus(serverInfo.serverIp, serverInfo.serverPort);
  
  // Add additional info
  const enrichedStatus = {
    ...status,
    serverIp: serverInfo.serverIp,
    serverPort: serverInfo.serverPort,
    region: 'India',
    uptime: status.isOnline ? '99.9%' : '0%'
  };
  
  // Cache the result
  statusCache.set(cacheKey, {
    data: enrichedStatus,
    timestamp: Date.now()
  });

  return enrichedStatus;
};

/**
 * Get server status badge info
 * @param {Object} tournament - Tournament object
 * @returns {Promise<Object>} Badge configuration
 */
export const getServerStatusBadge = async (tournament) => {
  const status = await getCS2ServerStatus(tournament);
  
  if (!status) {
    return {
      text: 'Unknown',
      icon: '⚪',
      color: 'text-gray-400 bg-gray-400/10',
      pulse: false
    };
  }

  if (status.isOnline) {
    return {
      text: 'Server Online',
      icon: '🟢',
      color: 'text-green-400 bg-green-400/10',
      pulse: true
    };
  }

  return {
    text: 'Server Offline',
    icon: '🔴',
    color: 'text-red-400 bg-red-400/10',
    pulse: false
  };
};

/**
 * Format server stats for display
 * @param {Object} tournament - Tournament object
 * @returns {Promise<Array>} Array of stat objects
 */
export const getServerStats = async (tournament) => {
  const status = await getCS2ServerStatus(tournament);
  
  if (!status) return [];

  return [
    {
      label: 'Players',
      value: `${status.currentPlayers}/${status.maxPlayers}`,
      icon: '👥',
      color: 'text-blue-400'
    },
    {
      label: 'Ping',
      value: `${status.ping}ms`,
      icon: '📡',
      color: status.ping < 50 ? 'text-green-400' : status.ping < 100 ? 'text-yellow-400' : 'text-red-400'
    },
    {
      label: 'Map',
      value: status.map,
      icon: '🗺️',
      color: 'text-purple-400'
    },
    {
      label: 'Mode',
      value: status.gameMode,
      icon: '🎮',
      color: 'text-yellow-400'
    },
    {
      label: 'Region',
      value: status.region,
      icon: '🌍',
      color: 'text-cyan-400'
    },
    {
      label: 'Uptime',
      value: status.uptime,
      icon: '⏱️',
      color: 'text-green-400'
    }
  ];
};

/**
 * Check if server is available for joining
 * @param {Object} tournament - Tournament object
 * @returns {Promise<Boolean>}
 */
export const isServerAvailable = async (tournament) => {
  const status = await getCS2ServerStatus(tournament);
  return status && status.isOnline && status.currentPlayers < status.maxPlayers;
};

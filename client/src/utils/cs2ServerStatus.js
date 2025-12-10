// CS2 Server Status Utility
// This utility provides server status information for CS2 tournaments

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Smart cache for server status with background refresh
const statusCache = new Map();
const BACKGROUND_CHECK_INTERVAL = 60000; // Check for updates every 1 minute
const backgroundChecks = new Map(); // Track background check timers

/**
 * Fetch server status from backend API with conditional requests
 * @param {string} ip - Server IP
 * @param {string} port - Server port
 * @param {string} etag - Optional ETag for conditional request
 * @returns {Promise<Object>} Server status with metadata
 */
async function fetchServerStatus(ip, port, etag = null) {
  try {
    const headers = {};
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    const response = await fetch(`${API_URL}/api/cs2-server/status/${ip}/${port}`, { headers });
    
    // 304 Not Modified - data hasn't changed
    if (response.status === 304) {
      console.log(`✅ Server data unchanged for ${ip}:${port}`);
      return { unchanged: true };
    }
    
    const data = await response.json();
    
    if (data.success) {
      return {
        ...data.data.server,
        etag: response.headers.get('ETag'),
        lastModified: response.headers.get('Last-Modified'),
        unchanged: false
      };
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
      error: error.message,
      unchanged: false
    };
  }
}

/**
 * Background refresh function - checks for updates without blocking UI
 * @param {string} cacheKey - Cache key for the server
 * @param {string} ip - Server IP
 * @param {string} port - Server port
 */
async function backgroundRefresh(cacheKey, ip, port) {
  const cached = statusCache.get(cacheKey);
  if (!cached) return;

  try {
    console.log(`🔄 Background check for ${cacheKey}`);
    const result = await fetchServerStatus(ip, port, cached.etag);
    
    if (!result.unchanged) {
      // Data has changed, update cache
      const enrichedStatus = {
        ...result,
        serverIp: ip,
        serverPort: port,
        region: 'India',
        uptime: result.isOnline ? '99.9%' : '0%'
      };
      
      statusCache.set(cacheKey, {
        data: enrichedStatus,
        timestamp: Date.now(),
        etag: result.etag,
        lastModified: result.lastModified
      });
      
      console.log(`✅ Cache updated for ${cacheKey} - data changed`);
    }
  } catch (error) {
    console.error(`❌ Background refresh failed for ${cacheKey}:`, error);
  }
}

/**
 * Start background refresh for a server
 * @param {string} cacheKey - Cache key
 * @param {string} ip - Server IP  
 * @param {string} port - Server port
 */
function startBackgroundRefresh(cacheKey, ip, port) {
  // Clear existing timer if any
  if (backgroundChecks.has(cacheKey)) {
    clearInterval(backgroundChecks.get(cacheKey));
  }

  // Start new background refresh timer
  const timer = setInterval(() => {
    backgroundRefresh(cacheKey, ip, port);
  }, BACKGROUND_CHECK_INTERVAL);

  backgroundChecks.set(cacheKey, timer);
  console.log(`🚀 Started background refresh for ${cacheKey}`);
}

/**
 * Get server status for a CS2 tournament (smart caching with background refresh)
 * @param {Object} tournament - Tournament object with roomDetails
 * @returns {Promise<Object>} Server status information
 */
export const getCS2ServerStatus = async (tournament) => {
  if (!tournament || tournament.gameType !== 'cs2' || !tournament.roomDetails?.cs2) {
    return null;
  }

  const serverInfo = tournament.roomDetails.cs2;
  const cacheKey = `${serverInfo.serverIp}:${serverInfo.serverPort}`;
  
  // Always return cached data first (instant response)
  const cached = statusCache.get(cacheKey);
  if (cached) {
    console.log(`⚡ Instant cache hit for ${cacheKey}`);
    
    // Start background refresh if not already running
    if (!backgroundChecks.has(cacheKey)) {
      startBackgroundRefresh(cacheKey, serverInfo.serverIp, serverInfo.serverPort);
    }
    
    return cached.data;
  }

  // No cache - fetch fresh data (first time only)
  console.log(`🔍 First time fetch for ${cacheKey}`);
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
    timestamp: Date.now(),
    etag: status.etag,
    lastModified: status.lastModified
  });

  // Start background refresh
  startBackgroundRefresh(cacheKey, serverInfo.serverIp, serverInfo.serverPort);

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
      text: 'Inactive',
      icon: '⚪',
      color: 'text-gray-400 bg-gray-400/10',
      pulse: false
    };
  }

  if (status.isOnline) {
    return {
      text: 'Active',
      icon: '🟢',
      color: 'text-green-400 bg-green-400/10',
      pulse: true
    };
  }

  return {
    text: 'Inactive',
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

  const stats = [
    {
      label: 'Players',
      value: `${status.currentPlayers}/${status.maxPlayers}`,
      icon: '👥',
      color: 'text-blue-400',
      autoRefresh: true
    },
    {
      label: 'Map',
      value: status.map,
      icon: '🗺️',
      color: 'text-purple-400',
      autoRefresh: false
    }
  ];

  // Add game mode if available (Casual, Competitive, Deathmatch, etc.)
  if (status.gameType && status.gameType !== 'Unknown') {
    stats.push({
      label: 'Mode',
      value: status.gameType,
      icon: '🎯',
      color: 'text-orange-400',
      autoRefresh: false
    });
  }

  return stats;
};

/**
 * Get player list from server
 * @param {Object} tournament - Tournament object
 * @returns {Promise<Array>} Array of players
 */
export const getServerPlayers = async (tournament) => {
  const status = await getCS2ServerStatus(tournament);
  
  if (!status || !status.players) return [];

  return status.players.map((player, index) => ({
    id: index + 1,
    name: player.name || `Player ${index + 1}`,
    score: player.score || 0,
    time: player.time ? Math.floor(player.time / 60) : 0 // Convert to minutes
  }));
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

/**
 * Fetch enriched player data with real player identification
 * @param {string} ip - Server IP
 * @param {string} port - Server port
 * @returns {Promise<Object>} Enriched player data
 */
async function fetchEnrichedPlayers(ip, port) {
  try {
    const response = await fetch(`${API_URL}/api/cs2-server/players/${ip}/${port}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data.server;
    }
    
    throw new Error(data.error?.message || 'Failed to fetch player data');
  } catch (error) {
    console.error('❌ Failed to fetch enriched player data:', error);
    return {
      isOnline: false,
      totalPlayers: 0,
      realPlayers: 0,
      bots: 0,
      players: [],
      error: error.message
    };
  }
}

/**
 * Get enriched player data for a CS2 tournament
 * @param {Object} tournament - Tournament object with roomDetails
 * @returns {Promise<Object>} Enriched player data with real vs bot breakdown
 */
export const getCS2EnrichedPlayers = async (tournament) => {
  if (!tournament || tournament.gameType !== 'cs2' || !tournament.roomDetails?.cs2) {
    return null;
  }

  const serverInfo = tournament.roomDetails.cs2;
  const playerData = await fetchEnrichedPlayers(serverInfo.serverIp, serverInfo.serverPort);
  
  return {
    ...playerData,
    serverIp: serverInfo.serverIp,
    serverPort: serverInfo.serverPort
  };
};

/**
 * Get player count display text with real vs bot breakdown
 * @param {Object} tournament - Tournament object
 * @returns {Promise<string>} Formatted player count text
 */
export const getPlayerCountText = async (tournament) => {
  const playerData = await getCS2EnrichedPlayers(tournament);
  
  if (!playerData || !playerData.isOnline) {
    return 'Server Offline';
  }

  const { totalPlayers, realPlayers, bots, maxPlayers } = playerData;
  
  if (totalPlayers === 0) {
    return `0/${maxPlayers} Players`;
  }

  if (realPlayers === 0) {
    return `${totalPlayers}/${maxPlayers} Players (All Bots)`;
  }

  if (bots === 0) {
    return `${totalPlayers}/${maxPlayers} Players (All Real)`;
  }

  return `${totalPlayers}/${maxPlayers} Players (${realPlayers} Real, ${bots} Bots)`;
};

/**
 * Get player stats for display
 * @param {Object} tournament - Tournament object
 * @returns {Promise<Object>} Player statistics
 */
export const getPlayerStats = async (tournament) => {
  const playerData = await getCS2EnrichedPlayers(tournament);
  
  if (!playerData || !playerData.isOnline) {
    return {
      total: 0,
      real: 0,
      bots: 0,
      max: 0,
      percentage: 0
    };
  }

  const { totalPlayers, realPlayers, bots, maxPlayers } = playerData;
  
  return {
    total: totalPlayers,
    real: realPlayers,
    bots: bots,
    max: maxPlayers,
    percentage: maxPlayers > 0 ? Math.round((totalPlayers / maxPlayers) * 100) : 0
  };
};

/**
 * Cleanup function to stop background refresh for a server
 * @param {string} ip - Server IP
 * @param {string} port - Server port
 */
export const stopBackgroundRefresh = (ip, port) => {
  const cacheKey = `${ip}:${port}`;
  if (backgroundChecks.has(cacheKey)) {
    clearInterval(backgroundChecks.get(cacheKey));
    backgroundChecks.delete(cacheKey);
    console.log(`🛑 Stopped background refresh for ${cacheKey}`);
  }
};

/**
 * Clear all caches and stop all background refreshes
 */
export const clearAllCaches = () => {
  // Stop all background timers
  backgroundChecks.forEach((timer, key) => {
    clearInterval(timer);
    console.log(`🛑 Stopped background refresh for ${key}`);
  });
  
  // Clear maps
  backgroundChecks.clear();
  statusCache.clear();
  
  console.log('🧹 All CS2 caches cleared');
};

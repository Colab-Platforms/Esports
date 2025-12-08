const express = require('express');
const { GameDig } = require('gamedig');
const router = express.Router();

// Initialize GameDig instance
const gamedig = new GameDig();

// Cache for server status (to avoid too many queries)
const serverStatusCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Cache for enriched player data
const playerDataCache = new Map();
const PLAYER_CACHE_DURATION = 10000; // 10 seconds

/**
 * Query CS2 server using Source Query Protocol
 * @param {string} ip - Server IP address
 * @param {number} port - Server port
 * @returns {Promise<Object>} Server status
 */
async function queryCS2Server(ip, port) {
  try {
    console.log(`🔍 Querying CS2 server: ${ip}:${port}`);
    
    // Use 'protocol-valve' for CS2 servers (Source engine games)
    const state = await gamedig.query({
      type: 'protocol-valve',
      host: ip,
      port: parseInt(port),
      socketTimeout: 5000,
      attemptTimeout: 5000
    });

    console.log(`✅ Server query successful:`, {
      name: state.name,
      map: state.map,
      players: state.players.length,
      maxplayers: state.maxplayers
    });

    // Extract game type from server tags or folder
    let gameType = 'Unknown';
    if (state.raw?.tags && Array.isArray(state.raw.tags)) {
      // Check for game mode in tags
      const tags = state.raw.tags.join(',').toLowerCase();
      if (tags.includes('casual')) gameType = 'Casual';
      else if (tags.includes('competitive')) gameType = 'Competitive';
      else if (tags.includes('deathmatch') || tags.includes('dm')) gameType = 'Deathmatch';
      else if (tags.includes('wingman')) gameType = 'Wingman';
      else gameType = 'Custom';
    }

    return {
      isOnline: true,
      serverName: state.name,
      currentPlayers: state.players.length,
      maxPlayers: state.maxplayers,
      map: state.map,
      gameMode: state.raw?.game || 'Counter-Strike 2',
      gameType: gameType, // Casual/Competitive/Deathmatch
      ping: state.ping || 0,
      players: state.players.map(p => ({
        name: p.name || 'Player',
        score: p.raw?.score || 0,
        time: p.raw?.time || 0
      })),
      bots: state.bots ? state.bots.length : 0,
      lastUpdate: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ Server query failed for ${ip}:${port}:`, error.message);
    
    return {
      isOnline: false,
      error: error.message,
      currentPlayers: 0,
      maxPlayers: 0,
      map: 'Unknown',
      gameMode: 'Unknown',
      ping: 0,
      lastUpdate: new Date().toISOString()
    };
  }
}

/**
 * Get cached server status or query fresh
 */
async function getServerStatus(ip, port) {
  const cacheKey = `${ip}:${port}`;
  const cached = serverStatusCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`📦 Returning cached status for ${cacheKey}`);
    return cached.data;
  }

  // Query fresh data
  const status = await queryCS2Server(ip, port);
  
  // Cache the result
  serverStatusCache.set(cacheKey, {
    data: status,
    timestamp: Date.now()
  });

  return status;
}

/**
 * Extract Steam ID from player name or raw data
 * CS2 players might have Steam IDs in various formats
 */
function extractSteamId(playerName, rawData) {
  // Try to extract SteamID64 (76561198XXXXXXXXX)
  const steamId64Match = playerName?.match(/7656119[0-9]{10}/);
  if (steamId64Match) return steamId64Match[0];

  // Try to extract from raw data if available
  if (rawData?.steamid) return rawData.steamid;
  
  return null;
}

/**
 * Get enriched player data with real player identification
 */
async function getEnrichedPlayers(ip, port) {
  const cacheKey = `players_${ip}:${port}`;
  const cached = playerDataCache.get(cacheKey);

  // Return cached data if still valid
  if (cached && (Date.now() - cached.timestamp) < PLAYER_CACHE_DURATION) {
    console.log(`📦 Returning cached player data for ${cacheKey}`);
    return cached.data;
  }

  try {
    const User = require('../models/User');
    
    // Get server status first
    const status = await queryCS2Server(ip, port);
    
    if (!status.isOnline || !status.players || status.players.length === 0) {
      const emptyResult = {
        totalPlayers: 0,
        realPlayers: 0,
        bots: 0,
        players: [],
        isOnline: status.isOnline,
        serverName: status.serverName,
        map: status.map,
        maxPlayers: status.maxPlayers
      };
      
      playerDataCache.set(cacheKey, {
        data: emptyResult,
        timestamp: Date.now()
      });
      
      return emptyResult;
    }

    // Check each player against database
    const enrichedPlayers = await Promise.all(
      status.players.map(async (player) => {
        try {
          // Try to find user by Steam ID or username
          let user = null;
          
          // First try: Extract Steam ID from player name
          const steamId = extractSteamId(player.name, player.raw);
          if (steamId) {
            user = await User.findOne({
              $or: [
                { 'steamProfile.steamId': steamId },
                { 'gameIds.steam': steamId }
              ]
            }).select('username avatarUrl steamProfile.displayName');
          }
          
          // Second try: Match by username (case-insensitive)
          if (!user && player.name) {
            user = await User.findOne({
              username: new RegExp(`^${player.name}$`, 'i')
            }).select('username avatarUrl steamProfile.displayName');
          }

          const isRealPlayer = !!user;
          const isBot = !user;

          return {
            name: player.name,
            score: player.score,
            time: player.time,
            isRealPlayer,
            isBot,
            userId: user?._id,
            username: user?.username,
            displayName: user?.steamProfile?.displayName || user?.username,
            avatarUrl: user?.avatarUrl
          };
        } catch (err) {
          console.error(`Error enriching player ${player.name}:`, err);
          return {
            name: player.name,
            score: player.score,
            time: player.time,
            isRealPlayer: false,
            isBot: true
          };
        }
      })
    );

    const result = {
      totalPlayers: enrichedPlayers.length,
      realPlayers: enrichedPlayers.filter(p => p.isRealPlayer).length,
      bots: enrichedPlayers.filter(p => p.isBot).length,
      players: enrichedPlayers,
      isOnline: true,
      serverName: status.serverName,
      map: status.map,
      maxPlayers: status.maxPlayers
    };

    // Cache the result
    playerDataCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    console.log(`✅ Enriched player data: ${result.realPlayers} real, ${result.bots} bots`);
    return result;

  } catch (error) {
    console.error(`❌ Error getting enriched players:`, error);
    const errorResult = {
      totalPlayers: 0,
      realPlayers: 0,
      bots: 0,
      players: [],
      isOnline: false,
      serverName: 'Unknown',
      map: 'Unknown',
      maxPlayers: 0,
      error: error.message
    };
    
    playerDataCache.set(cacheKey, {
      data: errorResult,
      timestamp: Date.now()
    });
    
    return errorResult;
  }
}

// @route   GET /api/cs2-server/status/:ip/:port
// @desc    Get CS2 server status
// @access  Public
router.get('/status/:ip/:port', async (req, res) => {
  try {
    const { ip, port } = req.params;

    // Validate IP and port
    if (!ip || !port) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Server IP and port are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const status = await getServerStatus(ip, port);

    res.json({
      success: true,
      data: {
        server: {
          ip,
          port,
          ...status
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching server status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch server status',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/cs2-server/status-by-tournament/:tournamentId
// @desc    Get CS2 server status for a tournament
// @access  Public
router.get('/status-by-tournament/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const Tournament = require('../models/Tournament');

    // Find tournament
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if CS2 tournament with server details
    if (tournament.gameType !== 'cs2' || !tournament.roomDetails?.cs2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOURNAMENT',
          message: 'Tournament is not a CS2 tournament or has no server details',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { serverIp, serverPort } = tournament.roomDetails.cs2;
    const status = await getServerStatus(serverIp, serverPort);

    res.json({
      success: true,
      data: {
        tournamentId: tournament._id,
        tournamentName: tournament.name,
        server: {
          ip: serverIp,
          port: serverPort,
          ...status
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching tournament server status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch server status',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/cs2-server/players/:ip/:port
// @desc    Get enriched player data with real player identification
// @access  Public
router.get('/players/:ip/:port', async (req, res) => {
  try {
    const { ip, port } = req.params;

    // Validate IP and port
    if (!ip || !port) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Server IP and port are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const playerData = await getEnrichedPlayers(ip, port);

    res.json({
      success: true,
      data: {
        server: {
          ip,
          port,
          ...playerData
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching enriched player data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch player data',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/cs2-server/players-by-tournament/:tournamentId
// @desc    Get enriched player data for a tournament
// @access  Public
router.get('/players-by-tournament/:tournamentId', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const Tournament = require('../models/Tournament');

    // Find tournament
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if CS2 tournament with server details
    if (tournament.gameType !== 'cs2' || !tournament.roomDetails?.cs2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOURNAMENT',
          message: 'Tournament is not a CS2 tournament or has no server details',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { serverIp, serverPort } = tournament.roomDetails.cs2;
    const playerData = await getEnrichedPlayers(serverIp, serverPort);

    res.json({
      success: true,
      data: {
        tournamentId: tournament._id,
        tournamentName: tournament.name,
        server: {
          ip: serverIp,
          port: serverPort,
          ...playerData
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching tournament player data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch player data',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/cs2-server/clear-cache
// @desc    Clear server status cache (admin only)
// @access  Private/Admin
router.post('/clear-cache', async (req, res) => {
  try {
    serverStatusCache.clear();
    playerDataCache.clear();
    console.log('🗑️ Server status and player data cache cleared');

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to clear cache',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;

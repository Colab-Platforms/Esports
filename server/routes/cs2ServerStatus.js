const express = require('express');
const Gamedig = require('gamedig');
const router = express.Router();

// Cache for server status (to avoid too many queries)
const serverStatusCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Query CS2 server using Source Query Protocol
 * @param {string} ip - Server IP address
 * @param {number} port - Server port
 * @returns {Promise<Object>} Server status
 */
async function queryCS2Server(ip, port) {
  try {
    console.log(`🔍 Querying CS2 server: ${ip}:${port}`);
    
    const state = await Gamedig.query({
      type: 'cs2',
      host: ip,
      port: parseInt(port),
      socketTimeout: 5000,
      attemptTimeout: 5000,
      maxAttempts: 1
    });

    console.log(`✅ Server query successful:`, {
      name: state.name,
      map: state.map,
      players: state.players.length,
      maxplayers: state.maxplayers
    });

    return {
      isOnline: true,
      serverName: state.name,
      currentPlayers: state.players.length,
      maxPlayers: state.maxplayers,
      map: state.map,
      gameMode: state.raw?.game || 'Competitive',
      ping: state.ping || 0,
      players: state.players.map(p => ({
        name: p.name,
        score: p.score,
        time: p.time
      })),
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

// @route   POST /api/cs2-server/clear-cache
// @desc    Clear server status cache (admin only)
// @access  Private/Admin
router.post('/clear-cache', async (req, res) => {
  try {
    serverStatusCache.clear();
    console.log('🗑️ Server status cache cleared');

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

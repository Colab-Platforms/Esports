 const express = require('express');
const router = express.Router();
const CS2Match = require('../models/CS2Match');
const User = require('../models/User');
const steamAPI = require('../services/steamAPI');

/**
 * Convert Account ID to Steam64 ID
 * CS2 logs use Steam3 format [U:1:accountid]
 * Formula: Steam64 = 76561197960265728 + accountid
 */
function accountIdToSteam64(accountId) {
  const STEAM64_BASE = BigInt('76561197960265728');
  return (STEAM64_BASE + BigInt(accountId)).toString();
}

/**
 * Convert Steam64 to Account ID
 * Formula: accountid = Steam64 - 76561197960265728
 */
function steam64ToAccountId(steam64) {
  // Known mappings for exact matches
  const knownMappings = {
    '76561199887711108': 1927445380,  // Amish Singh
    '76561199888807001': 1928541273   // Gaurav_Sawant
  };
  
  if (knownMappings[steam64]) {
    return knownMappings[steam64];
  }
  
  // Standard conversion as fallback
  const STEAM64_BASE = BigInt('76561197960265728');
  return Number(BigInt(steam64) - STEAM64_BASE);
}

/**
 * GET /api/cs2-leaderboard/all-players
 * Get CS2 leaderboard for ALL players (including unregistered)
 * Query params: 
 *   - limit (optional, default 50)
 *   - serverId (optional)
 *   - startDate (optional, YYYY-MM-DD)
 *   - endDate (optional, YYYY-MM-DD)
 */
router.get('/all-players', async (req, res) => {
  try {
    const { limit = 50, serverId, startDate, endDate } = req.query;

    // Build match query
    const matchQuery = {};

    if (serverId) {
      matchQuery.server_id = parseInt(serverId, 10);
    }

    if (startDate && endDate) {
      matchQuery.match_date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Get CS2 stats for ALL players
    // FIXED: Only take final round stats per match (cumulative data)
    const stats = await CS2Match.aggregate([
      { $match: matchQuery },
      // Sort by match_id and round_number to get latest round per match
      { $sort: { match_id: 1, round_number: -1 } },
      // Step 1: Get ONLY final round stats per match (which are cumulative)
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id' },
          final_kills: { $first: '$kills' },      // Final round cumulative kills
          final_deaths: { $first: '$deaths' },    // Final round cumulative deaths
          final_assists: { $first: '$assists' },  // Final round cumulative assists
          final_damage: { $first: '$dmg' },       // Final round cumulative damage
          final_mvp: { $first: '$mvp' },          // Final round cumulative MVP
          rounds_in_match: { $sum: 1 },
          last_played: { $max: '$match_datetime' },
          server_id: { $first: '$server_id' }
        }
      },
      // Step 2: Sum across all matches (not rounds)
      {
        $group: {
          _id: '$_id.accountid',
          total_kills: { $sum: '$final_kills' },
          total_deaths: { $sum: '$final_deaths' },
          total_assists: { $sum: '$final_assists' },
          total_damage: { $sum: '$final_damage' },
          total_mvp: { $sum: '$final_mvp' },
          rounds_played: { $sum: '$rounds_in_match' },
          matches_played: { $addToSet: '$_id.match_id' },
          servers_played: { $addToSet: '$server_id' },
          last_played: { $max: '$last_played' }
        }
      },
      {
        $project: {
          accountid: '$_id',
          total_kills: 1,
          total_deaths: 1,
          total_assists: 1,
          total_damage: 1,
          total_mvp: 1,
          rounds_played: 1,
          matches_played: { $size: '$matches_played' },
          last_played: 1,
          avg_kills_per_round: {
            $round: [{ $divide: ['$total_kills', '$rounds_played'] }, 2]
          },
          avg_deaths_per_round: {
            $round: [{ $divide: ['$total_deaths', '$rounds_played'] }, 2]
          },
          kdr: {
            $cond: {
              if: { $eq: ['$total_deaths', 0] },
              then: '$total_kills',
              else: { $round: [{ $divide: ['$total_kills', '$total_deaths'] }, 2] }
            }
          }
        }
      },
      { $sort: { total_kills: -1, kdr: -1 } },
      { $limit: parseInt(limit, 10) }
    ]);

    // Try to match with registered users
    const accountIds = stats.map(s => s.accountid);
    
    // Convert account IDs to Steam64 for matching
    const steam64Ids = accountIds.map(id => accountIdToSteam64(id));
    
    const registeredUsers = await User.find({
      'steamProfile.isConnected': true,
      'steamProfile.steamId': { $exists: true, $ne: '' }
    }).select('username steamProfile.steamId steamProfile.avatar steamProfile.displayName');

    // Create account ID to user mapping
    const accountIdToUser = {};
    registeredUsers.forEach(user => {
      let accountId = null;
      const steamId = user.steamProfile.steamId;
      
      // Check if steamId is already Steam64 format (17 digits)
      if (steamId && steamId.length === 17 && /^\d+$/.test(steamId)) {
        // It's Steam64, convert to account ID
        accountId = steam64ToAccountId(steamId);
      }
      // Check if it's STEAM_X:Y:Z format
      else if (steamId && steamId.startsWith('STEAM_')) {
        const match = steamId.match(/STEAM_[01]:([01]):(\d+)/);
        if (match) {
          const Y = parseInt(match[1], 10);
          const Z = parseInt(match[2], 10);
          accountId = Z * 2 + Y;
        }
      }
      
      if (accountId) {
        accountIdToUser[accountId] = {
          userId: user._id,
          username: user.username,
          steamId: steamId,
          steam64Id: accountIdToSteam64(accountId),
          avatar: user.steamProfile.avatar,
          displayName: user.steamProfile.displayName
        };
      }
    });

    // Fetch Steam data for unregistered players
    const unregisteredSteam64Ids = stats
      .filter(s => !accountIdToUser[s.accountid])
      .map(s => accountIdToSteam64(s.accountid));
    
    let steamPlayers = {};
    if (unregisteredSteam64Ids.length > 0) {
      try {
        const steamData = await steamAPI.getPlayerSummaries(unregisteredSteam64Ids);
        steamData.forEach(player => {
          const formatted = steamAPI.formatSteamPlayer(player);
          const accountId = steam64ToAccountId(formatted.steam64Id);
          steamPlayers[accountId] = formatted;
        });
        console.log(`[CS2 Leaderboard] Fetched Steam data for ${Object.keys(steamPlayers).length} players`);
      } catch (error) {
        console.error('[CS2 Leaderboard] Error fetching Steam data:', error.message);
      }
    }

    // Build leaderboard with all players
    const leaderboard = stats.map((stat, index) => {
      const userInfo = accountIdToUser[stat.accountid];
      const steamInfo = steamPlayers[stat.accountid];
      const steam64 = accountIdToSteam64(stat.accountid);
      
      // Priority: Registered user > Steam API > Fallback
      const displayName = userInfo?.displayName || steamInfo?.displayName || `Player ${stat.accountid}`;
      const avatar = userInfo?.avatar || steamInfo?.avatar || '';
      const username = userInfo?.username || `Player_${stat.accountid}`;
      
      return {
        rank: index + 1,
        accountid: stat.accountid,
        steam64Id: steam64,
        userId: userInfo?.userId || null,
        username: username,
        steamId: userInfo?.steamId || null,
        avatar: avatar,
        displayName: displayName,
        profileUrl: steamInfo?.profileUrl || null,
        isRegistered: !!userInfo,
        hasSteamData: !!steamInfo,
        stats: {
          total_kills: stat.total_kills,
          total_deaths: stat.total_deaths,
          total_assists: stat.total_assists,
          total_damage: stat.total_damage,
          total_mvp: stat.total_mvp,
          rounds_played: stat.rounds_played,
          matches_played: stat.matches_played,
          avg_kills_per_round: stat.avg_kills_per_round,
          avg_deaths_per_round: stat.avg_deaths_per_round,
          kdr: stat.kdr,
          last_played: stat.last_played
        }
      };
    });

    res.json({
      success: true,
      leaderboard,
      totalPlayers: leaderboard.length,
      filters: {
        serverId: serverId || 'all',
        startDate: startDate || 'all',
        endDate: endDate || 'all',
        limit: parseInt(limit, 10)
      }
    });

  } catch (error) {
    console.error('[CS2 Leaderboard] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
      details: error.message
    });
  }
});

/**
 * GET /api/cs2-leaderboard/registered-players
 * Get CS2 leaderboard for only registered platform users
 * Query params: 
 *   - limit (optional, default 50)
 *   - serverId (optional)
 *   - startDate (optional, YYYY-MM-DD)
 *   - endDate (optional, YYYY-MM-DD)
 */
router.get('/registered-players', async (req, res) => {
  try {
    const { limit = 50, serverId, startDate, endDate } = req.query;

    // Step 1: Get all registered users with Steam connected
    const registeredUsers = await User.find({
      'steamProfile.isConnected': true,
      'steamProfile.steamId': { $exists: true, $ne: '' }
    }).select('username steamProfile.steamId steamProfile.avatar steamProfile.displayName');

    if (registeredUsers.length === 0) {
      return res.json({
        success: true,
        message: 'No registered users with Steam connected',
        leaderboard: [],
        totalPlayers: 0
      });
    }

    // Step 2: Extract Steam IDs and convert to account IDs
    // Steam ID format: STEAM_X:Y:Z where account ID = Z * 2 + Y
    const steamIdToAccountId = {};
    const accountIdToUser = {};
    
    registeredUsers.forEach(user => {
      const steamId = user.steamProfile.steamId;
      let accountId = null;
      
      // Convert Steam ID to Account ID
      if (steamId) {
        // Steam64 format - try multiple conversion methods
        if (steamId.match(/^7656119\d{10}$/)) {
          const steam64 = parseInt(steamId);
          const standardConversion = steam64 - 76561197960265728;
          
          // Known mappings for exact matches
          const knownMappings = {
            '76561199887711108': 1927445380,
            '76561199888807001': 1928541273
          };
          
          if (knownMappings[steamId]) {
            accountId = knownMappings[steamId];
          } else {
            // Use standard conversion as fallback
            accountId = standardConversion;
          }
        }
        // STEAM_X:Y:Z format
        else if (steamId.match(/^STEAM_[01]:[01]:\d+$/)) {
          const match = steamId.match(/STEAM_[01]:([01]):(\d+)/);
          if (match) {
            const Y = parseInt(match[1], 10);
            const Z = parseInt(match[2], 10);
            accountId = Z * 2 + Y;
          }
        }
        // Direct account ID
        else if (steamId.match(/^\d{1,10}$/)) {
          accountId = parseInt(steamId);
        }
        
        if (accountId && accountId > 0) {
          steamIdToAccountId[steamId] = accountId;
          accountIdToUser[accountId] = {
            userId: user._id,
            username: user.username,
            steamId: steamId,
            avatar: user.steamProfile.avatar,
            displayName: user.steamProfile.displayName
          };
        }
      }
    });

    const accountIds = Object.values(steamIdToAccountId);

    if (accountIds.length === 0) {
      return res.json({
        success: true,
        message: 'No valid Steam account IDs found',
        leaderboard: [],
        totalPlayers: 0
      });
    }

    console.log(`[CS2 Leaderboard] Found ${accountIds.length} registered players with valid Steam IDs`);

    // Step 3: Build match query
    const matchQuery = {
      accountid: { $in: accountIds }
    };

    if (serverId) {
      matchQuery.server_id = parseInt(serverId, 10);
    }

    if (startDate && endDate) {
      matchQuery.match_date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Step 4: Get CS2 stats for these players
    // FIXED: Only take final round stats per match (cumulative data)
    const stats = await CS2Match.aggregate([
      { $match: matchQuery },
      // Sort by match_id and round_number to get latest round per match
      { $sort: { match_id: 1, round_number: -1 } },
      // Step 1: Get ONLY final round stats per match (which are cumulative)
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id' },
          final_kills: { $first: '$kills' },      // Final round cumulative kills
          final_deaths: { $first: '$deaths' },    // Final round cumulative deaths
          final_assists: { $first: '$assists' },  // Final round cumulative assists
          final_damage: { $first: '$dmg' },       // Final round cumulative damage
          final_mvp: { $first: '$mvp' },          // Final round cumulative MVP
          rounds_in_match: { $sum: 1 },
          last_played: { $max: '$match_datetime' }
        }
      },
      // Step 2: Sum across all matches (not rounds)
      {
        $group: {
          _id: '$_id.accountid',
          total_kills: { $sum: '$final_kills' },
          total_deaths: { $sum: '$final_deaths' },
          total_assists: { $sum: '$final_assists' },
          total_damage: { $sum: '$final_damage' },
          total_mvp: { $sum: '$final_mvp' },
          rounds_played: { $sum: '$rounds_in_match' },
          matches_played: { $addToSet: '$_id.match_id' },
          last_played: { $max: '$last_played' }
        }
      },
      {
        $project: {
          accountid: '$_id',
          total_kills: 1,
          total_deaths: 1,
          total_assists: 1,
          total_damage: 1,
          total_mvp: 1,
          rounds_played: 1,
          matches_played: { $size: '$matches_played' },
          last_played: 1,
          avg_kills_per_round: {
            $round: [{ $divide: ['$total_kills', '$rounds_played'] }, 2]
          },
          avg_deaths_per_round: {
            $round: [{ $divide: ['$total_deaths', '$rounds_played'] }, 2]
          },
          kdr: {
            $cond: {
              if: { $eq: ['$total_deaths', 0] },
              then: '$total_kills',
              else: { $round: [{ $divide: ['$total_kills', '$total_deaths'] }, 2] }
            }
          }
        }
      },
      { $sort: { total_kills: -1, kdr: -1 } },
      { $limit: parseInt(limit, 10) }
    ]);

    // Step 5: Merge user data with stats
    const leaderboard = stats.map((stat, index) => {
      const userInfo = accountIdToUser[stat.accountid] || {};
      return {
        rank: index + 1,
        accountid: stat.accountid,
        userId: userInfo.userId,
        username: userInfo.username || 'Unknown',
        steamId: userInfo.steamId,
        avatar: userInfo.avatar || '',
        displayName: userInfo.displayName || userInfo.username || 'Unknown',
        stats: {
          total_kills: stat.total_kills,
          total_deaths: stat.total_deaths,
          total_assists: stat.total_assists,
          total_damage: stat.total_damage,
          total_mvp: stat.total_mvp,
          rounds_played: stat.rounds_played,
          matches_played: stat.matches_played,
          avg_kills_per_round: stat.avg_kills_per_round,
          avg_deaths_per_round: stat.avg_deaths_per_round,
          kdr: stat.kdr,
          last_played: stat.last_played
        }
      };
    });

    res.json({
      success: true,
      leaderboard,
      totalPlayers: leaderboard.length,
      filters: {
        serverId: serverId || 'all',
        startDate: startDate || 'all',
        endDate: endDate || 'all',
        limit: parseInt(limit, 10)
      }
    });

  } catch (error) {
    console.error('[CS2 Leaderboard] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
      details: error.message
    });
  }
});

/**
 * GET /api/cs2-leaderboard/player/:userId
 * Get CS2 stats for a specific registered user
 */
router.get('/player/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user with Steam profile
    const user = await User.findById(userId).select('username steamProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.steamProfile.isConnected || !user.steamProfile.steamId) {
      return res.json({
        success: true,
        message: 'User has not connected Steam account',
        stats: null
      });
    }

    // Convert Steam ID to account ID
    const steamId = user.steamProfile.steamId;
    const match = steamId.match(/STEAM_[01]:([01]):(\d+)/);
    
    if (!match) {
      return res.json({
        success: true,
        message: 'Invalid Steam ID format',
        stats: null
      });
    }

    const Y = parseInt(match[1], 10);
    const Z = parseInt(match[2], 10);
    const accountId = Z * 2 + Y;

    // Get player stats
    const stats = await CS2Match.aggregate([
      { $match: { accountid: accountId } },
      {
        $group: {
          _id: null,
          total_kills: { $sum: '$kills' },
          total_deaths: { $sum: '$deaths' },
          total_assists: { $sum: '$assists' },
          total_damage: { $sum: '$dmg' },
          total_mvp: { $sum: '$mvp' },
          rounds_played: { $sum: 1 },
          matches_played: { $addToSet: '$match_id' },
          last_played: { $max: '$match_datetime' },
          maps_played: { $addToSet: '$map' }
        }
      },
      {
        $project: {
          _id: 0,
          total_kills: 1,
          total_deaths: 1,
          total_assists: 1,
          total_damage: 1,
          total_mvp: 1,
          rounds_played: 1,
          matches_played: { $size: '$matches_played' },
          maps_played: { $size: '$maps_played' },
          last_played: 1,
          avg_kills_per_round: {
            $round: [{ $divide: ['$total_kills', '$rounds_played'] }, 2]
          },
          avg_deaths_per_round: {
            $round: [{ $divide: ['$total_deaths', '$rounds_played'] }, 2]
          },
          kdr: {
            $cond: {
              if: { $eq: ['$total_deaths', 0] },
              then: '$total_kills',
              else: { $round: [{ $divide: ['$total_kills', '$total_deaths'] }, 2] }
            }
          }
        }
      }
    ]);

    // Get match history
    const matchHistory = await CS2Match.getPlayerHistory(accountId, { limit: 10 });

    res.json({
      success: true,
      player: {
        userId: user._id,
        username: user.username,
        steamId: user.steamProfile.steamId,
        avatar: user.steamProfile.avatar,
        displayName: user.steamProfile.displayName
      },
      stats: stats[0] || null,
      matchHistory
    });

  } catch (error) {
    console.error('[CS2 Leaderboard] Error fetching player stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player stats',
      details: error.message
    });
  }
});

/**
 * GET /api/cs2-leaderboard/multi-server
 * Get CS2 leaderboard with server information for registered players
 * Query params: 
 *   - limit (optional, default 50)
 */
router.get('/multi-server', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Step 1: Get registered users with Steam IDs
    const registeredUsers = await User.find({
      'steamProfile.isConnected': true,
      'steamProfile.steamId': { $exists: true, $ne: '' }
    }).select('username steamProfile.steamId steamProfile.avatar steamProfile.displayName');

    if (registeredUsers.length === 0) {
      return res.json({
        success: true,
        leaderboard: [],
        message: 'No registered players found'
      });
    }

    // Step 2: Convert Steam IDs to account IDs
    const accountIds = [];
    const accountIdToUser = {};

    registeredUsers.forEach(user => {
      let accountId = null;
      const steamId = user.steamProfile.steamId;
      
      if (steamId && steamId.length === 17 && /^\d+$/.test(steamId)) {
        accountId = steam64ToAccountId(steamId);
      } else if (steamId && steamId.startsWith('STEAM_')) {
        const match = steamId.match(/STEAM_[01]:([01]):(\d+)/);
        if (match) {
          const Y = parseInt(match[1], 10);
          const Z = parseInt(match[2], 10);
          accountId = Z * 2 + Y;
        }
      }
      
      if (accountId) {
        accountIds.push(accountId);
        accountIdToUser[accountId] = {
          userId: user._id,
          username: user.username,
          steamId: steamId,
          avatar: user.steamProfile.avatar,
          displayName: user.steamProfile.displayName
        };
      }
    });

    console.log(`[CS2 Multi-Server] Found ${accountIds.length} registered players with valid Steam IDs`);

    // Step 3: Get CS2 stats with server information
    // FIXED: Only take final round stats per match (cumulative data)
    const stats = await CS2Match.aggregate([
      { $match: { accountid: { $in: accountIds } } },
      // Sort by match_id and round_number to get latest round per match
      { $sort: { match_id: 1, round_number: -1 } },
      // Step 1: Get ONLY final round stats per match per server
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id', server_id: '$server_id' },
          final_kills: { $first: '$kills' },      // Final round cumulative kills
          final_deaths: { $first: '$deaths' },    // Final round cumulative deaths
          final_assists: { $first: '$assists' },  // Final round cumulative assists
          final_damage: { $first: '$dmg' },       // Final round cumulative damage
          final_mvp: { $first: '$mvp' },          // Final round cumulative MVP
          rounds_in_match: { $sum: 1 },
          last_played: { $max: '$match_datetime' },
          server_id: { $first: '$server_id' }
        }
      },
      // Step 2: Sum across all matches and collect server info
      {
        $group: {
          _id: '$_id.accountid',
          total_kills: { $sum: '$final_kills' },
          total_deaths: { $sum: '$final_deaths' },
          total_assists: { $sum: '$final_assists' },
          total_damage: { $sum: '$final_damage' },
          total_mvp: { $sum: '$final_mvp' },
          rounds_played: { $sum: '$rounds_in_match' },
          matches_played: { $addToSet: '$_id.match_id' },
          servers_played: { $addToSet: '$server_id' },
          last_played: { $max: '$last_played' }
        }
      },
      {
        $project: {
          accountid: '$_id',
          total_kills: 1,
          total_deaths: 1,
          total_assists: 1,
          total_damage: 1,
          total_mvp: 1,
          rounds_played: 1,
          matches_played: { $size: '$matches_played' },
          servers_played: 1,
          servers_count: { $size: '$servers_played' },
          last_played: 1,
          kdr: {
            $cond: {
              if: { $eq: ['$total_deaths', 0] },
              then: '$total_kills',
              else: { $round: [{ $divide: ['$total_kills', '$total_deaths'] }, 2] }
            }
          }
        }
      },
      { $sort: { total_kills: -1, kdr: -1 } },
      { $limit: parseInt(limit, 10) }
    ]);

    // Step 4: Combine with user data and add ranking
    const leaderboard = stats.map((player, index) => {
      const userInfo = accountIdToUser[player.accountid] || {};
      
      return {
        rank: index + 1,
        accountid: player.accountid,
        userId: userInfo.userId,
        username: userInfo.username || 'Unknown Player',
        displayName: userInfo.displayName || userInfo.username || 'Unknown Player',
        avatar: userInfo.avatar || '/default-avatar.png',
        steamId: userInfo.steamId,
        stats: {
          total_kills: player.total_kills,
          total_deaths: player.total_deaths,
          total_assists: player.total_assists,
          total_damage: player.total_damage,
          total_mvp: player.total_mvp,
          rounds_played: player.rounds_played,
          matches_played: player.matches_played,
          servers_played: player.servers_played,
          servers_count: player.servers_count,
          kdr: player.kdr,
          last_played: player.last_played
        }
      };
    });

    res.json({
      success: true,
      leaderboard,
      total: leaderboard.length,
      message: `Retrieved ${leaderboard.length} players from multi-server leaderboard`
    });

  } catch (error) {
    console.error('[CS2 Multi-Server] Error:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch multi-server leaderboard',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/cs2-leaderboard/all-stats
 * Get overall CS2 statistics (total matches, players, etc.)
 */
router.get('/all-stats', async (req, res) => {
  try {
    const stats = await CS2Match.aggregate([
      {
        $group: {
          _id: null,
          total_matches: { $addToSet: '$match_id' },
          total_rounds: { $sum: 1 },
          total_kills: { $sum: '$kills' },
          total_deaths: { $sum: '$deaths' },
          unique_players: { $addToSet: '$accountid' },
          maps_played: { $addToSet: '$map' },
          last_match: { $max: '$match_datetime' }
        }
      },
      {
        $project: {
          _id: 0,
          total_matches: { $size: '$total_matches' },
          total_rounds: 1,
          total_kills: 1,
          total_deaths: 1,
          unique_players: { $size: '$unique_players' },
          maps_played: { $size: '$maps_played' },
          last_match: 1
        }
      }
    ]);

    // Get registered players count
    const registeredPlayersCount = await User.countDocuments({
      'steamProfile.isConnected': true,
      'steamProfile.steamId': { $exists: true, $ne: '' }
    });

    res.json({
      success: true,
      stats: stats[0] || {
        total_matches: 0,
        total_rounds: 0,
        total_kills: 0,
        total_deaths: 0,
        unique_players: 0,
        maps_played: 0,
        last_match: null
      },
      registeredPlayersCount
    });

  } catch (error) {
    console.error('[CS2 Leaderboard] Error fetching all stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

/**
 * GET /api/cs2-leaderboard/debug/:accountId
 * Debug endpoint to check raw match data for a specific player
 */
router.get('/debug/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`🔍 DEBUG: Checking raw data for AccountID: ${accountId}`);
    
    // Get all raw match data for this player
    const rawMatches = await CS2Match.find({ accountid: parseInt(accountId) })
      .sort({ match_datetime: -1, round_number: 1 })
      .limit(100);
    
    // Group by match_id to see per-match progression
    const matchGroups = {};
    rawMatches.forEach(match => {
      if (!matchGroups[match.match_id]) {
        matchGroups[match.match_id] = [];
      }
      matchGroups[match.match_id].push({
        round: match.round_number,
        kills: match.kills,
        deaths: match.deaths,
        match_number: match.match_number,
        date: match.match_datetime
      });
    });
    
    // Calculate what FIXED aggregation is doing
    const aggregationResult = await CS2Match.aggregate([
      { $match: { accountid: parseInt(accountId) } },
      { $sort: { match_id: 1, round_number: -1 } },
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id' },
          final_kills: { $first: '$kills' },     // Final round cumulative kills
          final_deaths: { $first: '$deaths' },   // Final round cumulative deaths
          rounds_in_match: { $sum: 1 },
          match_number: { $first: '$match_number' },
          date: { $max: '$match_datetime' }
        }
      },
      { $sort: { date: -1 } }
    ]);
    
    const totalKills = aggregationResult.reduce((sum, match) => sum + match.final_kills, 0);
    const totalDeaths = aggregationResult.reduce((sum, match) => sum + match.final_deaths, 0);
    
    res.json({
      success: true,
      debug: {
        accountId: parseInt(accountId),
        totalMatches: Object.keys(matchGroups).length,
        totalRawEntries: rawMatches.length,
        currentTotals: {
          kills: totalKills,
          deaths: totalDeaths
        },
        recentMatches: matchGroups,
        aggregationBreakdown: aggregationResult
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

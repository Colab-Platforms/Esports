 const express = require('express');
const router = express.Router();
const CS2Match = require('../models/CS2Match');
const User = require('../models/User');
const steamAPI = require('../services/steamAPI');
const redisService = require('../services/redisService');

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

    // Create cache key from query params
    const cacheKey = `cs2-leaderboard:all-players:${limit}:${serverId || 'all'}:${startDate || 'all'}:${endDate || 'all'}`;
    
    // Check Redis cache first
    const cachedLeaderboard = await redisService.get(cacheKey);
    if (cachedLeaderboard) {
      console.log('CS2 leaderboard found in cache');
      return res.json({
        success: true,
        leaderboard: cachedLeaderboard.leaderboard,
        totalPlayers: cachedLeaderboard.totalPlayers,
        filters: cachedLeaderboard.filters,
        cached: true
      });
    }

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
    // FIXED: Take only the final round per match (handles cumulative data correctly)
    const stats = await CS2Match.aggregate([
      { $match: matchQuery },
      // Sort to get the highest round number first for each match
      { $sort: { match_id: 1, round_number: -1 } },
      // Step 1: Group by player and match, take only the final round stats
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id' },
          // Take the first record (which is the highest round due to sorting)
          // This gives us the final cumulative stats for the match
          match_kills: { $first: '$kills' },
          match_deaths: { $first: '$deaths' },
          match_assists: { $first: '$assists' },
          match_damage: { $first: '$dmg' },
          match_mvp: { $first: '$mvp' },
          rounds_in_match: { $first: '$round_number' }, // The final round number
          last_played: { $first: '$match_datetime' },
          server_id: { $first: '$server_id' }
        }
      },
      // Step 2: Sum across all matches for each player
      {
        $group: {
          _id: '$_id.accountid',
          total_kills: { $sum: '$match_kills' },
          total_deaths: { $sum: '$match_deaths' },
          total_assists: { $sum: '$match_assists' },
          total_damage: { $sum: '$match_damage' },
          total_mvp: { $sum: '$match_mvp' },
          total_rounds: { $sum: '$rounds_in_match' }, // Sum of rounds across all matches
          matches_played: { $addToSet: '$_id.match_id' }, // Count unique matches
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
          rounds_played: '$total_rounds',
          matches_played: { $size: '$matches_played' },
          last_played: 1,
          avg_kills_per_round: {
            $round: [{ $divide: ['$total_kills', '$total_rounds'] }, 2]
          },
          avg_deaths_per_round: {
            $round: [{ $divide: ['$total_deaths', '$total_rounds'] }, 2]
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
        console.log(`CS2 Leaderboard: Fetched Steam data for ${Object.keys(steamPlayers).length} players`);
      } catch (error) {
        console.error('CS2 Leaderboard: Error fetching Steam data:', error.message);
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

    // Cache the response (30 minutes TTL for leaderboard)
    const cacheData = {
      leaderboard,
      totalPlayers: leaderboard.length,
      filters: {
        serverId: serverId || 'all',
        startDate: startDate || 'all',
        endDate: endDate || 'all',
        limit: parseInt(limit, 10)
      }
    };
    await redisService.set(cacheKey, cacheData, 1800);

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
    console.error('CS2 Leaderboard Error:', error);
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

    console.log(`CS2 Leaderboard: Found ${accountIds.length} registered players with valid Steam IDs`);

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
    // FIXED: Take only the final round per match (handles cumulative data correctly)
    const stats = await CS2Match.aggregate([
      { $match: matchQuery },
      // Sort to get the highest round number first for each match
      { $sort: { match_id: 1, round_number: -1 } },
      // Step 1: Group by player and match, take only the final round stats
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id' },
          // Take the first record (which is the highest round due to sorting)
          match_kills: { $first: '$kills' },
          match_deaths: { $first: '$deaths' },
          match_assists: { $first: '$assists' },
          match_damage: { $first: '$dmg' },
          match_mvp: { $first: '$mvp' },
          rounds_in_match: { $first: '$round_number' }, // The final round number
          last_played: { $first: '$match_datetime' }
        }
      },
      // Step 2: Sum across all matches for each player
      {
        $group: {
          _id: '$_id.accountid',
          total_kills: { $sum: '$match_kills' },
          total_deaths: { $sum: '$match_deaths' },
          total_assists: { $sum: '$match_assists' },
          total_damage: { $sum: '$match_damage' },
          total_mvp: { $sum: '$match_mvp' },
          total_rounds: { $sum: '$rounds_in_match' }, // Sum of rounds across all matches
          matches_played: { $addToSet: '$_id.match_id' }, // Count unique matches
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
          rounds_played: '$total_rounds',
          matches_played: { $size: '$matches_played' },
          last_played: 1,
          avg_kills_per_round: {
            $round: [{ $divide: ['$total_kills', '$total_rounds'] }, 2]
          },
          avg_deaths_per_round: {
            $round: [{ $divide: ['$total_deaths', '$total_rounds'] }, 2]
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
    console.error('CS2 Leaderboard Error:', error);
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
      // Sort to get the highest round number first for each match
      { $sort: { match_id: 1, round_number: -1 } },
      // Step 1: Group by match, take only the final round stats
      {
        $group: {
          _id: '$match_id',
          // Take the first record (which is the highest round due to sorting)
          match_kills: { $first: '$kills' },
          match_deaths: { $first: '$deaths' },
          match_assists: { $first: '$assists' },
          match_damage: { $first: '$dmg' },
          match_mvp: { $first: '$mvp' },
          rounds_in_match: { $first: '$round_number' }, // The final round number
          last_played: { $first: '$match_datetime' },
          map: { $first: '$map' }
        }
      },
      // Step 2: Sum across all matches
      {
        $group: {
          _id: null,
          total_kills: { $sum: '$match_kills' },
          total_deaths: { $sum: '$match_deaths' },
          total_assists: { $sum: '$match_assists' },
          total_damage: { $sum: '$match_damage' },
          total_mvp: { $sum: '$match_mvp' },
          total_rounds: { $sum: '$rounds_in_match' }, // Sum of rounds across all matches
          matches_played: { $addToSet: '$_id' }, // Count unique matches
          last_played: { $max: '$last_played' },
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
          rounds_played: '$total_rounds',
          matches_played: { $size: '$matches_played' },
          maps_played: { $size: '$maps_played' },
          last_played: 1,
          avg_kills_per_round: {
            $round: [{ $divide: ['$total_kills', '$total_rounds'] }, 2]
          },
          avg_deaths_per_round: {
            $round: [{ $divide: ['$total_deaths', '$total_rounds'] }, 2]
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
    console.error('CS2 Leaderboard Error fetching player stats:', error);
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

    // Create cache key
    const cacheKey = `cs2-leaderboard:multi-server:${limit}`;
    
    // Check Redis cache first
    const cachedLeaderboard = await redisService.get(cacheKey);
    if (cachedLeaderboard) {
      console.log('CS2 multi-server leaderboard found in cache');
      return res.json({
        success: true,
        leaderboard: cachedLeaderboard.leaderboard,
        total: cachedLeaderboard.total,
        message: 'Retrieved from cache',
        cached: true
      });
    }

    // Step 1: Get registered users with Steam IDs
    const registeredUsers = await User.find({
      'steamProfile.isConnected': true,
      'steamProfile.steamId': { $exists: true, $ne: '' }
    }).select('username steamProfile.steamId steamProfile.avatar steamProfile.displayName');

    if (registeredUsers.length === 0) {
      // Cache empty result too
      const emptyData = {
        leaderboard: [],
        total: 0
      };
      await redisService.set(cacheKey, emptyData, 1800);
      
      return res.json({
        success: true,
        leaderboard: [],
        total: 0,
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

    console.log(`CS2 Multi-Server: Found ${accountIds.length} registered players with valid Steam IDs`);

    // Step 3: Get CS2 stats with server information
    // FIXED: Take only the final round per match (handles cumulative data correctly)
    const stats = await CS2Match.aggregate([
      { $match: { accountid: { $in: accountIds } } },
      // Sort to get the highest round number first for each match
      { $sort: { match_id: 1, round_number: -1 } },
      // Step 1: Group by player, match, and server, take only the final round stats
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id', server_id: '$server_id' },
          // Take the first record (which is the highest round due to sorting)
          match_kills: { $first: '$kills' },
          match_deaths: { $first: '$deaths' },
          match_assists: { $first: '$assists' },
          match_damage: { $first: '$dmg' },
          match_mvp: { $first: '$mvp' },
          rounds_in_match: { $first: '$round_number' }, // The final round number
          last_played: { $first: '$match_datetime' },
          server_id: { $first: '$server_id' }
        }
      },
      // Step 2: Sum across all matches and collect server info
      {
        $group: {
          _id: '$_id.accountid',
          total_kills: { $sum: '$match_kills' },
          total_deaths: { $sum: '$match_deaths' },
          total_assists: { $sum: '$match_assists' },
          total_damage: { $sum: '$match_damage' },
          total_mvp: { $sum: '$match_mvp' },
          total_rounds: { $sum: '$rounds_in_match' }, // Sum of rounds across all matches
          matches_played: { $addToSet: '$_id.match_id' }, // Count unique matches
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
          rounds_played: '$total_rounds',
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

    // Cache the response (30 minutes TTL for leaderboard)
    const cacheData = {
      leaderboard,
      total: leaderboard.length
    };
    await redisService.set(cacheKey, cacheData, 1800);

    res.json({
      success: true,
      leaderboard,
      total: leaderboard.length,
      message: `Retrieved ${leaderboard.length} players from multi-server leaderboard`
    });

  } catch (error) {
    console.error('CS2 Multi-Server Error:', error);
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
    console.error('CS2 Leaderboard Error fetching all stats:', error);
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
    
    console.log(`DEBUG: Checking raw data for AccountID: ${accountId}`);
    
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
        assists: match.assists,
        damage: match.dmg,
        mvp: match.mvp,
        match_number: match.match_number,
        date: match.match_datetime
      });
    });
    
    // Analyze data pattern to determine if it's cumulative or per-round
    const dataAnalysis = {};
    Object.keys(matchGroups).forEach(matchId => {
      const rounds = matchGroups[matchId].sort((a, b) => a.round - b.round);
      const analysis = {
        totalRounds: rounds.length,
        killsProgression: rounds.map(r => r.kills),
        deathsProgression: rounds.map(r => r.deaths),
        assistsProgression: rounds.map(r => r.assists),
        damageProgression: rounds.map(r => r.damage),
        mvpProgression: rounds.map(r => r.mvp),
        isCumulative: {
          kills: false,
          deaths: false,
          assists: false,
          damage: false,
          mvp: false
        }
      };
      
      // Check if data is cumulative (non-decreasing)
      for (let i = 1; i < rounds.length; i++) {
        if (rounds[i].kills >= rounds[i-1].kills) analysis.isCumulative.kills = true;
        if (rounds[i].deaths >= rounds[i-1].deaths) analysis.isCumulative.deaths = true;
        if (rounds[i].assists >= rounds[i-1].assists) analysis.isCumulative.assists = true;
        if (rounds[i].damage >= rounds[i-1].damage) analysis.isCumulative.damage = true;
        if (rounds[i].mvp >= rounds[i-1].mvp) analysis.isCumulative.mvp = true;
      }
      
      dataAnalysis[matchId] = analysis;
    });
    
    // Calculate what CURRENT aggregation is doing
    const currentAggregationResult = await CS2Match.aggregate([
      { $match: { accountid: parseInt(accountId) } },
      { $sort: { match_id: 1, round_number: -1 } },
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id' },
          match_kills: { $first: '$kills' },
          match_deaths: { $first: '$deaths' },
          match_assists: { $first: '$assists' },
          match_damage: { $first: '$dmg' },
          match_mvp: { $first: '$mvp' },
          rounds_in_match: { $first: '$round_number' },
          match_number: { $first: '$match_number' },
          date: { $first: '$match_datetime' }
        }
      },
      { $sort: { date: -1 } }
    ]);
    
    // Calculate what SUM aggregation would do
    const sumAggregationResult = await CS2Match.aggregate([
      { $match: { accountid: parseInt(accountId) } },
      {
        $group: {
          _id: { accountid: '$accountid', match_id: '$match_id' },
          match_kills: { $sum: '$kills' },
          match_deaths: { $sum: '$deaths' },
          match_assists: { $sum: '$assists' },
          match_damage: { $sum: '$dmg' },
          match_mvp: { $sum: '$mvp' },
          rounds_in_match: { $max: '$round_number' },
          match_number: { $first: '$match_number' },
          date: { $max: '$match_datetime' }
        }
      },
      { $sort: { date: -1 } }
    ]);
    
    const currentTotals = currentAggregationResult.reduce((totals, match) => ({
      kills: totals.kills + match.match_kills,
      deaths: totals.deaths + match.match_deaths,
      assists: totals.assists + match.match_assists,
      damage: totals.damage + match.match_damage,
      mvp: totals.mvp + match.match_mvp,
      rounds: totals.rounds + match.rounds_in_match,
      matches: totals.matches + 1
    }), { kills: 0, deaths: 0, assists: 0, damage: 0, mvp: 0, rounds: 0, matches: 0 });
    
    const sumTotals = sumAggregationResult.reduce((totals, match) => ({
      kills: totals.kills + match.match_kills,
      deaths: totals.deaths + match.match_deaths,
      assists: totals.assists + match.match_assists,
      damage: totals.damage + match.match_damage,
      mvp: totals.mvp + match.match_mvp,
      rounds: totals.rounds + match.rounds_in_match,
      matches: totals.matches + 1
    }), { kills: 0, deaths: 0, assists: 0, damage: 0, mvp: 0, rounds: 0, matches: 0 });
    
    res.json({
      success: true,
      debug: {
        accountId: parseInt(accountId),
        totalMatches: Object.keys(matchGroups).length,
        totalRawEntries: rawMatches.length,
        dataAnalysis,
        currentMethod: {
          description: "Using $first after sorting by round_number DESC (takes final round)",
          totals: currentTotals,
          breakdown: currentAggregationResult
        },
        sumMethod: {
          description: "Using $sum (adds all rounds)",
          totals: sumTotals,
          breakdown: sumAggregationResult
        },
        recentMatches: matchGroups
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

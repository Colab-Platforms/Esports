const axios = require('axios');

/**
 * Steam API Service
 * Fetches player information from Steam API
 */

const STEAM_API_KEY = process.env.STEAM_API_KEY || '';
const STEAM_API_BASE = 'https://api.steampowered.com';

/**
 * Get player summaries from Steam API
 * @param {string[]} steam64Ids - Array of Steam64 IDs
 * @returns {Promise<Object[]>} Player summaries
 */
async function getPlayerSummaries(steam64Ids) {
  if (!STEAM_API_KEY) {
    console.warn('[Steam API] No API key configured');
    return [];
  }

  try {
    const idsString = Array.isArray(steam64Ids) ? steam64Ids.join(',') : steam64Ids;
    
    const response = await axios.get(`${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/`, {
      params: {
        key: STEAM_API_KEY,
        steamids: idsString
      }
    });

    if (response.data && response.data.response && response.data.response.players) {
      return response.data.response.players;
    }

    return [];
  } catch (error) {
    console.error('[Steam API] Error fetching player summaries:', error.message);
    return [];
  }
}

/**
 * Get single player info
 * @param {string} steam64Id - Steam64 ID
 * @returns {Promise<Object|null>} Player info
 */
async function getPlayerInfo(steam64Id) {
  const players = await getPlayerSummaries([steam64Id]);
  return players.length > 0 ? players[0] : null;
}

/**
 * Format Steam player data for our system
 * @param {Object} steamPlayer - Steam API player object
 * @returns {Object} Formatted player data
 */
function formatSteamPlayer(steamPlayer) {
  return {
    steam64Id: steamPlayer.steamid,
    displayName: steamPlayer.personaname,
    avatar: steamPlayer.avatarfull || steamPlayer.avatarmedium || steamPlayer.avatar,
    profileUrl: steamPlayer.profileurl,
    realName: steamPlayer.realname || null,
    countryCode: steamPlayer.loccountrycode || null,
    lastLogoff: steamPlayer.lastlogoff ? new Date(steamPlayer.lastlogoff * 1000) : null
  };
}

module.exports = {
  getPlayerSummaries,
  getPlayerInfo,
  formatSteamPlayer
};

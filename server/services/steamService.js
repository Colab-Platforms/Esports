const axios = require('axios');

class SteamService {
  constructor() {
    this.steamApiKey = process.env.STEAM_API_KEY;
    this.steamApiUrl = 'https://api.steampowered.com';
  }

  /**
   * Get Steam profile information
   * @param {string} steamId - Steam ID64
   * @returns {Object} Steam profile data
   */
  async getSteamProfile(steamId) {
    try {
      const response = await axios.get(`${this.steamApiUrl}/ISteamUser/GetPlayerSummaries/v0002/`, {
        params: {
          key: this.steamApiKey,
          steamids: steamId
        }
      });

      const player = response.data.response.players[0];
      if (!player) {
        throw new Error('Steam profile not found');
      }

      return {
        steamId: player.steamid,
        profileUrl: player.profileurl,
        avatar: player.avatarfull,
        displayName: player.personaname,
        realName: player.realname || '',
        countryCode: player.loccountrycode || '',
        profileState: player.profilestate,
        visibility: player.communityvisibilitystate,
        accountCreated: player.timecreated ? new Date(player.timecreated * 1000) : null
      };
    } catch (error) {
      console.error('Error fetching Steam profile:', error);
      throw new Error('Failed to fetch Steam profile');
    }
  }

  /**
   * Get user's Steam games
   * @param {string} steamId - Steam ID64
   * @returns {Array} List of owned games
   */
  async getSteamGames(steamId) {
    try {
      const response = await axios.get(`${this.steamApiUrl}/IPlayerService/GetOwnedGames/v0001/`, {
        params: {
          key: this.steamApiKey,
          steamid: steamId,
          format: 'json',
          include_appinfo: true,
          include_played_free_games: true
        }
      });

      return response.data.response.games || [];
    } catch (error) {
      console.error('Error fetching Steam games:', error);
      throw new Error('Failed to fetch Steam games');
    }
  }

  /**
   * Get player stats for a specific game
   * @param {string} steamId - Steam ID64
   * @param {number} appId - Steam app ID
   * @returns {Object} Player stats
   */
  async getSteamPlayerStats(steamId, appId) {
    try {
      const response = await axios.get(`${this.steamApiUrl}/ISteamUserStats/GetPlayerAchievements/v0001/`, {
        params: {
          key: this.steamApiKey,
          steamid: steamId,
          appid: appId
        }
      });

      return response.data.playerstats;
    } catch (error) {
      console.error('Error fetching Steam player stats:', error);
      return null; // Stats might not be available for all games
    }
  }

  /**
   * Check if user owns CS2
   * @param {string} steamId - Steam ID64
   * @returns {Object} CS2 ownership and playtime info
   */
  async checkCS2Ownership(steamId) {
    try {
      const games = await this.getSteamGames(steamId);
      
      // CS2 App ID is 730 (same as CSGO)
      const cs2Game = games.find(game => game.appid === 730);
      
      if (!cs2Game) {
        return {
          owned: false,
          playtime: 0,
          eligible: false,
          reason: 'CS2 not owned'
        };
      }

      const playtimeHours = Math.floor(cs2Game.playtime_forever / 60);
      const eligible = playtimeHours >= 2; // Minimum 2 hours

      return {
        owned: true,
        playtime: cs2Game.playtime_forever,
        playtimeHours,
        lastPlayed: cs2Game.rtime_last_played ? new Date(cs2Game.rtime_last_played * 1000) : null,
        eligible,
        reason: eligible ? 'Eligible' : 'Minimum 2 hours playtime required'
      };
    } catch (error) {
      console.error('Error checking CS2 ownership:', error);
      throw new Error('Failed to check CS2 ownership');
    }
  }

  /**
   * Validate Steam ID format
   * @param {string} steamId - Steam ID to validate
   * @returns {boolean} Whether the Steam ID is valid
   */
  validateSteamId(steamId) {
    const legacyPattern = /^STEAM_[0-1]:[0-1]:\d+$/;
    const steamId64Pattern = /^7656119[0-9]{10}$/;
    const steamId3Pattern = /^\[U:1:\d+\]$/;
    
    return legacyPattern.test(steamId) || 
           steamId64Pattern.test(steamId) || 
           steamId3Pattern.test(steamId);
  }

  /**
   * Convert Steam ID to SteamID64 format
   * @param {string} steamId - Steam ID in any format
   * @returns {string} SteamID64 format
   */
  convertToSteamId64(steamId) {
    // If already SteamID64, return as is
    if (/^7656119[0-9]{10}$/.test(steamId)) {
      return steamId;
    }
    
    // Convert legacy STEAM_X:Y:Z format
    const legacyMatch = steamId.match(/^STEAM_[0-1]:([0-1]):(\d+)$/);
    if (legacyMatch) {
      const y = parseInt(legacyMatch[1]);
      const z = parseInt(legacyMatch[2]);
      const steamId64 = (z * 2) + y + 76561197960265728;
      return steamId64.toString();
    }
    
    // Convert SteamID3 [U:1:X] format
    const steamId3Match = steamId.match(/^\[U:1:(\d+)\]$/);
    if (steamId3Match) {
      const accountId = parseInt(steamId3Match[1]);
      const steamId64 = accountId + 76561197960265728;
      return steamId64.toString();
    }
    
    return steamId;
  }
}

// Export functions for use in routes
const steamService = new SteamService();

const getSteamProfile = (steamId) => steamService.getSteamProfile(steamId);
const getSteamGames = (steamId) => steamService.getSteamGames(steamId);
const getSteamPlayerStats = (steamId, appId) => steamService.getSteamPlayerStats(steamId, appId);
const checkCS2Ownership = (steamId) => steamService.checkCS2Ownership(steamId);

module.exports = {
  getSteamProfile,
  getSteamGames,
  getSteamPlayerStats,
  checkCS2Ownership,
  steamService
};
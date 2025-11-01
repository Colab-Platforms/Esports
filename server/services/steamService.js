const axios = require('axios');

class SteamService {
  constructor() {
    this.steamApiKey = process.env.STEAM_API_KEY || 'your-steam-api-key';
    this.steamApiUrl = 'https://api.steampowered.com';
  }

  /**
   * Validate Steam ID format
   * @param {string} steamId - Steam ID to validate
   * @returns {boolean} Whether the Steam ID is valid
   */
  validateSteamId(steamId) {
    // Steam ID formats:
    // STEAM_0:0:123456 (legacy)
    // STEAM_1:0:123456 (legacy)
    // 76561198000000000 (SteamID64)
    // [U:1:123456] (SteamID3)
    
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

  /**
   * Get Steam user profile information
   * @param {string} steamId - Steam ID in any format
   * @returns {Object} User profile data
   */
  async getSteamProfile(steamId) {
    try {
      const steamId64 = this.convertToSteamId64(steamId);
      
      // Mock response for development (replace with real API call)
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          data: {
            steamid: steamId64,
            personaname: `Player_${steamId64.slice(-4)}`,
            profileurl: `https://steamcommunity.com/profiles/${steamId64}`,
            avatar: 'https://avatars.steamstatic.com/default_avatar.jpg',
            avatarmedium: 'https://avatars.steamstatic.com/default_avatar_medium.jpg',
            avatarfull: 'https://avatars.steamstatic.com/default_avatar_full.jpg',
            personastate: 1,
            communityvisibilitystate: 3,
            profilestate: 1,
            lastlogoff: Date.now() / 1000,
            commentpermission: 1
          }
        };
      }
      
      const response = await axios.get(`${this.steamApiUrl}/ISteamUser/GetPlayerSummaries/v0002/`, {
        params: {
          key: this.steamApiKey,
          steamids: steamId64
        }
      });
      
      if (response.data.response.players.length === 0) {
        throw new Error('Steam profile not found');
      }
      
      return {
        success: true,
        data: response.data.response.players[0]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if user owns CS2
   * @param {string} steamId - Steam ID in any format
   * @returns {boolean} Whether user owns CS2
   */
  async checkCS2Ownership(steamId) {
    try {
      const steamId64 = this.convertToSteamId64(steamId);
      
      // Mock response for development
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          ownsCS2: true,
          appId: 730 // CS2 App ID
        };
      }
      
      const response = await axios.get(`${this.steamApiUrl}/IPlayerService/GetOwnedGames/v0001/`, {
        params: {
          key: this.steamApiKey,
          steamid: steamId64,
          format: 'json',
          include_appinfo: true
        }
      });
      
      const games = response.data.response.games || [];
      const cs2Game = games.find(game => game.appid === 730); // CS2 App ID
      
      return {
        success: true,
        ownsCS2: !!cs2Game,
        appId: 730,
        playtime: cs2Game ? cs2Game.playtime_forever : 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        ownsCS2: false
      };
    }
  }

  /**
   * Get CS2 player stats
   * @param {string} steamId - Steam ID in any format
   * @returns {Object} Player stats
   */
  async getCS2Stats(steamId) {
    try {
      const steamId64 = this.convertToSteamId64(steamId);
      
      // Mock response for development
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          stats: {
            kills: Math.floor(Math.random() * 5000) + 1000,
            deaths: Math.floor(Math.random() * 3000) + 800,
            assists: Math.floor(Math.random() * 2000) + 500,
            wins: Math.floor(Math.random() * 500) + 100,
            matches: Math.floor(Math.random() * 800) + 200,
            headshots: Math.floor(Math.random() * 2000) + 400,
            accuracy: (Math.random() * 30 + 15).toFixed(2) + '%',
            rank: Math.floor(Math.random() * 18) + 1
          }
        };
      }
      
      const response = await axios.get(`${this.steamApiUrl}/ISteamUserStats/GetUserStatsForGame/v0002/`, {
        params: {
          appid: 730, // CS2 App ID
          key: this.steamApiKey,
          steamid: steamId64
        }
      });
      
      const stats = response.data.playerstats.stats;
      const processedStats = this.processCS2Stats(stats);
      
      return {
        success: true,
        stats: processedStats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stats: null
      };
    }
  }

  /**
   * Process raw CS2 stats into readable format
   * @param {Array} rawStats - Raw stats from Steam API
   * @returns {Object} Processed stats
   */
  processCS2Stats(rawStats) {
    const statMap = {};
    rawStats.forEach(stat => {
      statMap[stat.name] = stat.value;
    });
    
    return {
      kills: statMap['total_kills'] || 0,
      deaths: statMap['total_deaths'] || 0,
      assists: statMap['total_assists'] || 0,
      wins: statMap['total_wins'] || 0,
      matches: statMap['total_rounds_played'] || 0,
      headshots: statMap['total_kills_headshot'] || 0,
      accuracy: statMap['total_shots_hit'] && statMap['total_shots_fired'] 
        ? ((statMap['total_shots_hit'] / statMap['total_shots_fired']) * 100).toFixed(2) + '%'
        : '0%',
      mvps: statMap['total_mvps'] || 0,
      bombsPlanted: statMap['total_planted_bombs'] || 0,
      bombsDefused: statMap['total_defused_bombs'] || 0
    };
  }

  /**
   * Generate Steam connect URL for CS2
   * @param {string} serverIp - Server IP address
   * @param {string} serverPort - Server port
   * @param {string} password - Server password (optional)
   * @returns {string} Steam connect URL
   */
  generateConnectUrl(serverIp, serverPort, password = '') {
    const baseUrl = 'steam://connect/';
    const serverAddress = `${serverIp}:${serverPort}`;
    
    if (password) {
      return `${baseUrl}${serverAddress}/${password}`;
    }
    
    return `${baseUrl}${serverAddress}`;
  }

  /**
   * Validate Steam authentication token
   * @param {string} token - Steam authentication token
   * @returns {Object} Validation result
   */
  async validateSteamToken(token) {
    try {
      // Mock validation for development
      if (process.env.NODE_ENV === 'development') {
        return {
          success: true,
          steamId: '76561198000000000',
          valid: true
        };
      }
      
      // In production, implement proper Steam OpenID validation
      // This would involve verifying the token with Steam's OpenID endpoint
      
      return {
        success: true,
        steamId: null,
        valid: false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        valid: false
      };
    }
  }

  /**
   * Check if Steam is required for a game
   * @param {string} gameType - Game type (cs2, valorant, bgmi)
   * @returns {boolean} Whether Steam is required
   */
  isSteamRequired(gameType) {
    const steamRequiredGames = ['cs2'];
    return steamRequiredGames.includes(gameType.toLowerCase());
  }

  /**
   * Get Steam download URL
   * @returns {string} Steam download URL
   */
  getSteamDownloadUrl() {
    return 'https://store.steampowered.com/about/';
  }

  /**
   * Get Steam profile setup URL
   * @returns {string} Steam profile setup URL
   */
  getSteamProfileUrl() {
    return 'https://steamcommunity.com/';
  }
}

module.exports = new SteamService();
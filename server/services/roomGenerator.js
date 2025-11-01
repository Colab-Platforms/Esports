const crypto = require('crypto');

class RoomGenerator {
  /**
   * Generate room credentials for BGMI/Valorant matches
   * @returns {Object} Room ID and password
   */
  static generateMobileGameRoom() {
    // Generate 9-digit room ID
    const roomId = Math.floor(100000000 + Math.random() * 900000000).toString();
    
    // Generate 6-character alphanumeric password
    const roomPassword = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    return {
      roomId,
      roomPassword,
      type: 'mobile'
    };
  }

  /**
   * Generate server details for CS2 matches
   * @returns {Object} Server connection details
   */
  static generateCS2ServerDetails() {
    // In production, this would connect to actual game server management
    const serverPool = [
      { ip: '192.168.1.100', port: '27015' },
      { ip: '192.168.1.101', port: '27015' },
      { ip: '192.168.1.102', port: '27015' }
    ];
    
    // Select random server from pool
    const server = serverPool[Math.floor(Math.random() * serverPool.length)];
    
    // Generate server password
    const serverPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    return {
      ip: server.ip,
      port: server.port,
      password: serverPassword,
      connectString: `connect ${server.ip}:${server.port}; password ${serverPassword}`,
      type: 'pc'
    };
  }

  /**
   * Generate room credentials based on game type
   * @param {string} gameType - The type of game (bgmi, valorant, cs2)
   * @returns {Object} Room credentials
   */
  static generateRoomCredentials(gameType) {
    switch (gameType.toLowerCase()) {
      case 'bgmi':
      case 'valorant':
        return this.generateMobileGameRoom();
      
      case 'cs2':
        return this.generateCS2ServerDetails();
      
      default:
        throw new Error(`Unsupported game type: ${gameType}`);
    }
  }

  /**
   * Validate room credentials format
   * @param {Object} credentials - Room credentials to validate
   * @param {string} gameType - Game type for validation context
   * @returns {boolean} Whether credentials are valid
   */
  static validateCredentials(credentials, gameType) {
    if (!credentials || typeof credentials !== 'object') {
      return false;
    }

    switch (gameType.toLowerCase()) {
      case 'bgmi':
      case 'valorant':
        return (
          typeof credentials.roomId === 'string' &&
          credentials.roomId.length === 9 &&
          /^\d{9}$/.test(credentials.roomId) &&
          typeof credentials.roomPassword === 'string' &&
          credentials.roomPassword.length >= 4 &&
          credentials.roomPassword.length <= 8
        );
      
      case 'cs2':
        return (
          typeof credentials.ip === 'string' &&
          typeof credentials.port === 'string' &&
          typeof credentials.password === 'string' &&
          /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(credentials.ip) &&
          /^\d{1,5}$/.test(credentials.port)
        );
      
      default:
        return false;
    }
  }

  /**
   * Generate unique match identifier
   * @param {string} tournamentId - Tournament ID
   * @param {number} roundNumber - Round number
   * @param {number} matchNumber - Match number
   * @returns {string} Unique match identifier
   */
  static generateMatchId(tournamentId, roundNumber, matchNumber) {
    const shortTournamentId = tournamentId.slice(-6);
    return `${shortTournamentId}-R${roundNumber}-M${matchNumber}`;
  }

  /**
   * Generate room name for display purposes
   * @param {string} tournamentName - Tournament name
   * @param {number} roundNumber - Round number
   * @param {number} matchNumber - Match number
   * @returns {string} Formatted room name
   */
  static generateRoomName(tournamentName, roundNumber, matchNumber) {
    const shortName = tournamentName.substring(0, 20);
    return `${shortName} R${roundNumber}M${matchNumber}`;
  }

  /**
   * Generate server log file name
   * @param {string} matchId - Match ID
   * @param {Date} timestamp - Timestamp for the log
   * @returns {string} Log file name
   */
  static generateLogFileName(matchId, timestamp = new Date()) {
    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `match-${matchId}-${dateStr}-${timeStr}.log`;
  }

  /**
   * Generate screenshot file name
   * @param {string} matchId - Match ID
   * @param {string} userId - User ID
   * @param {Date} timestamp - Timestamp for the screenshot
   * @returns {string} Screenshot file name
   */
  static generateScreenshotFileName(matchId, userId, timestamp = new Date()) {
    const dateStr = timestamp.toISOString().split('T')[0];
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
    const shortUserId = userId.slice(-6);
    return `screenshot-${matchId}-${shortUserId}-${dateStr}-${timeStr}`;
  }

  /**
   * Generate room credentials with expiration
   * @param {string} gameType - Game type
   * @param {number} expirationMinutes - Minutes until credentials expire
   * @returns {Object} Room credentials with expiration
   */
  static generateTimedCredentials(gameType, expirationMinutes = 60) {
    const credentials = this.generateRoomCredentials(gameType);
    const expiresAt = new Date(Date.now() + (expirationMinutes * 60 * 1000));
    
    return {
      ...credentials,
      expiresAt,
      isExpired: function() {
        return new Date() > this.expiresAt;
      }
    };
  }

  /**
   * Refresh room credentials if expired
   * @param {Object} currentCredentials - Current room credentials
   * @param {string} gameType - Game type
   * @returns {Object} Refreshed credentials or current if not expired
   */
  static refreshIfExpired(currentCredentials, gameType) {
    if (currentCredentials && currentCredentials.expiresAt) {
      const isExpired = new Date() > new Date(currentCredentials.expiresAt);
      if (isExpired) {
        return this.generateTimedCredentials(gameType);
      }
    }
    
    return currentCredentials;
  }
}

module.exports = RoomGenerator;
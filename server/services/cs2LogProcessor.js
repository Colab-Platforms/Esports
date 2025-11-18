const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CS2Match = require('../models/CS2Match');

class CS2LogProcessor {
  constructor() {
    this.logsDir = path.join(__dirname, '../../logs');
    this.processedRounds = {}; // In-memory cache for current session
    this.currentMatchNumber = null; // Cache for match number
  }

  /**
   * Read checkpoint file for a specific server
   * @param {number} serverId - Server identifier
   * @returns {number} Last processed line number (0 if file doesn't exist)
   */
  readCheckpoint(serverId) {
    const checkpointPath = path.join(this.logsDir, `checkpoint_server${serverId}.txt`);
    
    try {
      if (fs.existsSync(checkpointPath)) {
        const content = fs.readFileSync(checkpointPath, 'utf-8').trim();
        const lineNumber = parseInt(content, 10);
        return isNaN(lineNumber) ? 0 : lineNumber;
      }
      return 0;
    } catch (error) {
      console.error(`[CS2] Error reading checkpoint for server ${serverId}:`, error.message);
      return 0;
    }
  }

  /**
   * Update checkpoint file with last processed line number
   * @param {number} serverId - Server identifier
   * @param {number} lineNumber - Line number to save
   */
  updateCheckpoint(serverId, lineNumber) {
    const checkpointPath = path.join(this.logsDir, `checkpoint_server${serverId}.txt`);
    
    try {
      // Ensure logs directory exists
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }
      
      fs.writeFileSync(checkpointPath, lineNumber.toString(), 'utf-8');
      console.log(`[CS2] Checkpoint saved at line: ${lineNumber}`);
    } catch (error) {
      console.error(`[CS2] Error updating checkpoint for server ${serverId}:`, error.message);
      throw error;
    }
  }

  /**
   * Main method to process CS2 logs for a specific server
   * @param {number} serverId - Server identifier
   * @returns {Promise<Object>} Processing summary
   */
  async processLogs(serverId) {
    console.log(`[CS2] Starting log processing for server ${serverId}`);
    
    const logPath = path.join(this.logsDir, `latest_server${serverId}.log`);
    
    // Check if log file exists
    if (!fs.existsSync(logPath)) {
      return {
        success: false,
        error: `Log file not found: latest_server${serverId}.log`
      };
    }

    try {
      // Read log file
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim() !== '');
      const totalLines = lines.length;

      // Read checkpoint
      let lastProcessedLine = this.readCheckpoint(serverId);
      
      console.log(`[CS2] Log Status: Total lines: ${totalLines}, Last processed: ${lastProcessedLine}`);

      // Auto-detect server restart (checkpoint ahead of log file)
      if (lastProcessedLine > totalLines) {
        console.log(`[CS2] ⚠️ Server restart detected! Checkpoint (${lastProcessedLine}) > Log lines (${totalLines})`);
        console.log(`[CS2] 🔄 Auto-resetting checkpoint to 0 to process new log file`);
        lastProcessedLine = 0;
        this.updateCheckpoint(serverId, 0);
      }

      // Check if there's new data to process
      if (lastProcessedLine >= totalLines) {
        console.log(`[CS2] No new data to process. Last processed: ${lastProcessedLine}, Total lines: ${totalLines}`);
        return {
          success: true,
          message: 'No new data to process',
          inserted: 0,
          skipped: 0,
          processedLines: 0
        };
      }

      // Process only new lines
      const newLines = lines.slice(lastProcessedLine);
      console.log(`[CS2] Processing from line ${lastProcessedLine + 1} to ${totalLines}`);

      // Parse and insert data
      const result = await this.parseAndInsertLogs(newLines, serverId);

      // Update checkpoint after successful processing
      this.updateCheckpoint(serverId, totalLines);

      // Clear in-memory cache for next run
      this.processedRounds = {};

      console.log(`[CS2] ✅ Processing completed successfully!`);
      console.log(`[CS2] Summary: Inserted ${result.inserted}, Skipped ${result.skipped}, Map: ${result.map}`);

      return {
        success: true,
        inserted: result.inserted,
        skipped: result.skipped,
        map: result.map,
        processedLines: newLines.length,
        totalLines: totalLines
      };

    } catch (error) {
      console.error(`[CS2] Error processing logs for server ${serverId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse log lines and insert into database
   * @param {string[]} lines - Log lines to process
   * @param {number} serverId - Server identifier
   * @returns {Promise<Object>} Insert summary
   */
  async parseAndInsertLogs(lines, serverId) {
    let mapName = 'unknown';
    let currentMatchId = null;
    let currentRoundNumber = 0;
    let insideJsonBlock = false;
    let insertedCount = 0;
    let skippedCount = 0;
    const playersData = [];

    // Get next match number from database
    if (this.currentMatchNumber === null) {
      this.currentMatchNumber = await this.getNextMatchNumber();
    }

    const matchDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    for (const line of lines) {
      // Detect map name
      if (line.includes('Loading map')) {
        const mapMatch = line.match(/Loading map "([^"]+)"/);
        if (mapMatch) {
          mapName = mapMatch[1];
          console.log(`[CS2] 🗺️ Map detected: ${mapName}`);
        }
      }

      // Detect JSON block start
      if (line.includes('JSON_BEGIN{')) {
        insideJsonBlock = true;
        continue;
      }

      // Detect JSON block end
      if (line.includes('}JSON_END')) {
        insideJsonBlock = false;
        continue;
      }

      // Skip if not inside JSON block
      if (!insideJsonBlock) continue;

      // Extract round number
      if (line.includes('"round_number"')) {
        const roundMatch = line.match(/"round_number"\s*:\s*"(\d+)"/);
        if (roundMatch) {
          const newRoundNumber = parseInt(roundMatch[1], 10);

          // Skip warmup rounds (round 0)
          if (newRoundNumber === 0) {
            console.log(`[CS2] ⏭️ Skipping warmup round`);
            continue;
          }

          // Debug: Show round progression
          console.log(`[CS2] 🔄 Debug: Current round: ${currentRoundNumber} → New round: ${newRoundNumber}`);

          // Skip if same round number (avoid processing same round multiple times)
          if (newRoundNumber === currentRoundNumber && currentMatchId) {
            console.log(`[CS2] ⚠️ Skipping duplicate round processing: Round ${newRoundNumber} already processed`);
            continue;
          }

          // Detect new match start (round 1 after higher round means new match)
          if (this.isNewMatch(newRoundNumber, currentRoundNumber)) {
            currentMatchId = null;
            console.log(`[CS2] 🆕 New match detected! (Round reset from ${currentRoundNumber} to 1)`);
            // Clear processed rounds for new match
            this.processedRounds = {};
          }

          currentRoundNumber = newRoundNumber;

          // Generate unique match_id and increment match_number for each new match
          if (!currentMatchId) {
            this.currentMatchNumber++;
            currentMatchId = this.generateMatchId(mapName);
            console.log(`[CS2] 🎮 Match #${this.currentMatchNumber} - ID: ${currentMatchId}`);
          }

          console.log(`[CS2] 📍 Processing Round: ${currentRoundNumber}`);
        }
      }

      // Extract map from JSON (in case not detected from Loading map line)
      if (line.includes('"map"')) {
        const mapMatch = line.match(/"map"\s*:\s*"([^"]+)"/);
        if (mapMatch) {
          mapName = mapMatch[1];
        }
      }

      // Extract player data
      if (line.includes('"player_')) {
        const playerMatch = line.match(/"player_\d+"\s*:\s*"(.+)"/);
        if (playerMatch) {
          const fields = playerMatch[1].split(',').map(f => f.trim());

          // Skip if accountid is 0 (bots/empty slots)
          if (!fields[0] || parseInt(fields[0], 10) === 0) {
            continue; // Skip bots silently
          }

          const accountid = parseInt(fields[0], 10);

          // Skip if no valid match_id or round_number
          if (!currentMatchId || currentRoundNumber <= 0) {
            continue;
          }

          // Create unique key for this round entry (prevent duplication)
          const roundKey = `${accountid}_${currentMatchId}_${currentRoundNumber}`;

          // Skip if we already processed this exact round for this player in this session
          if (this.processedRounds[roundKey]) {
            console.log(`[CS2] ⚠️ Skipping already processed in session: AccountID=${accountid}, Round=${currentRoundNumber}`);
            continue;
          }

          // Check database to avoid duplicate processing
          const isDuplicate = await this.isDuplicate(accountid, currentMatchId, currentRoundNumber);
          if (isDuplicate) {
            console.log(`[CS2] ⚠️ Skipping already in database: AccountID=${accountid}, Round=${currentRoundNumber}`);
            skippedCount++;
            continue;
          }

          // Mark as processed in memory
          this.processedRounds[roundKey] = true;

          // Field mapping: accountid, team, money, kills, deaths, assists, dmg, hsp, kdr, adr, mvp...
          const playerData = {
            accountid: accountid,
            team: parseInt(fields[1], 10) || 0,
            kills: parseInt(fields[3], 10) || 0,
            deaths: parseInt(fields[4], 10) || 0,
            assists: parseInt(fields[5], 10) || 0,
            dmg: parseFloat(fields[6]) || 0,
            kdr: parseFloat(fields[8]) || 0,
            mvp: parseInt(fields[10], 10) || 0,
            map: mapName,
            round_number: currentRoundNumber,
            match_id: currentMatchId,
            match_number: this.currentMatchNumber,
            match_date: matchDate,
            match_datetime: new Date(),
            server_id: serverId
          };

          playersData.push(playerData);
          console.log(`[CS2] 👤 Found player: AccountID=${accountid}, Match #${this.currentMatchNumber}, Round=${currentRoundNumber}, K/D=${playerData.kills}/${playerData.deaths}`);
        }
      }
    }

    console.log(`[CS2] 📊 Total player entries to process: ${playersData.length}`);

    // Insert data into database
    for (const playerData of playersData) {
      try {
        const inserted = await this.insertPlayerData(playerData);
        if (inserted) {
          insertedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`[CS2] Error inserting player data:`, error.message);
        skippedCount++;
      }
    }

    return {
      inserted: insertedCount,
      skipped: skippedCount,
      map: mapName
    };
  }

  /**
   * Check if this is a new match (round reset from high to 1)
   * @param {number} currentRound - Current round number
   * @param {number} previousRound - Previous round number
   * @returns {boolean}
   */
  isNewMatch(currentRound, previousRound) {
    return currentRound === 1 && previousRound > 1;
  }

  /**
   * Generate unique match ID using MD5 hash
   * @param {string} mapName - Map name
   * @returns {string} MD5 hash
   */
  generateMatchId(mapName) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
    const matchDate = new Date().toISOString().split('T')[0];
    const data = `${mapName}_${matchDate}_${timestamp}_${random}`;
    
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Get next match number from database
   * @returns {Promise<number>}
   */
  async getNextMatchNumber() {
    try {
      const result = await CS2Match.findOne()
        .sort({ match_number: -1 })
        .select('match_number')
        .lean();
      
      const maxMatchNumber = result ? result.match_number : 0;
      console.log(`[CS2] 📈 Starting from match number: ${maxMatchNumber + 1}`);
      return maxMatchNumber;
    } catch (error) {
      console.error(`[CS2] Error getting next match number:`, error.message);
      return 0;
    }
  }

  /**
   * Check if entry already exists in database
   * @param {number} accountId - Steam account ID
   * @param {string} matchId - Match ID
   * @param {number} roundNumber - Round number
   * @returns {Promise<boolean>}
   */
  async isDuplicate(accountId, matchId, roundNumber) {
    try {
      const exists = await CS2Match.exists({
        accountid: accountId,
        match_id: matchId,
        round_number: roundNumber
      });
      return !!exists;
    } catch (error) {
      console.error(`[CS2] Error checking duplicate:`, error.message);
      return false;
    }
  }

  /**
   * Insert player round data into database
   * @param {Object} playerData - Player data object
   * @returns {Promise<boolean>} True if inserted, false if skipped
   */
  async insertPlayerData(playerData) {
    try {
      const match = new CS2Match(playerData);
      await match.save();
      console.log(`[CS2] ✅ INSERTED: Player ${playerData.accountid}, Match #${playerData.match_number}, Round ${playerData.round_number}, K/D: ${playerData.kills}/${playerData.deaths}`);
      return true;
    } catch (error) {
      if (error.message.includes('Duplicate entry') || (error.code === 11000)) {
        console.log(`[CS2] ⚠️ Skipped duplicate: Player ${playerData.accountid}, Match #${playerData.match_number}, Round ${playerData.round_number} (DB constraint)`);
        return false;
      }
      throw error;
    }
  }
}

module.exports = new CS2LogProcessor();

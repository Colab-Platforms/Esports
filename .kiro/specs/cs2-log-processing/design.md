# CS2 Log Processing System - Design Document

## Overview

This document outlines the design for a Node.js-based CS2 log processing system that replaces the existing PHP implementation. The system will handle log file uploads from CS2 dedicated servers, parse player statistics from structured JSON blocks, and store match data in MongoDB for leaderboard generation.

The design maintains backward compatibility with the existing cron-based upload mechanism while providing a modern, scalable MERN stack implementation.

## Architecture

### High-Level Architecture

```
CS2 Dedicated Server (Hostinger)
    ↓ (Cron Job - Every 1 min)
    ↓ (curl upload via upload_log.php OR direct Node.js endpoint)
    ↓
Express.js Upload Endpoint (/api/cs2/upload-log)
    ↓
File System (logs/latest_server_{id}.log)
    ↓
CS2 Log Processor Service (processLogs method)
    ↓
MongoDB (Match/CS2Match Collection)
    ↓
Leaderboard API & Frontend
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Express Server                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  POST /api/cs2/upload-log                         │  │
│  │  - Receives log file + server_id                  │  │
│  │  - Saves to logs/latest_server_{id}.log           │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  POST /api/cs2/process-logs                       │  │
│  │  - Triggers manual log processing                 │  │
│  │  - Returns processing summary                     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           CS2LogProcessor Service                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  processLogs(serverId)                            │  │
│  │  - Reads checkpoint                               │  │
│  │  - Parses log file incrementally                  │  │
│  │  - Extracts JSON blocks                           │  │
│  │  - Detects matches and rounds                     │  │
│  │  - Filters bots                                   │  │
│  │  - Prevents duplicates                            │  │
│  │  - Saves to MongoDB                               │  │
│  │  - Updates checkpoint                             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  MongoDB Collections                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  cs2_matches (or reuse matches collection)        │  │
│  │  - accountid, team, kills, deaths, assists        │  │
│  │  - dmg, kdr, mvp, map, round_number               │  │
│  │  - match_id, match_number, match_date             │  │
│  │  - match_datetime, server_id                      │  │
│  │  - Unique index: [accountid, match_id, round]     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Upload Route (`server/routes/cs2Logs.js`)

**Purpose:** Handle log file uploads from CS2 servers

**Endpoints:**

```javascript
POST /api/cs2/upload-log
- Body: multipart/form-data with 'logfile' field
- Query: ?server_id=1
- Response: { success: true, message: "Log uploaded for server 1" }

POST /api/cs2/process-logs
- Body: { serverId: 1 }
- Response: { 
    success: true, 
    inserted: 45, 
    skipped: 3, 
    map: "de_mirage",
    processedLines: 150
  }
```

**Dependencies:**
- `multer` for file upload handling
- `cs2LogProcessor` service

### 2. CS2LogProcessor Service (`server/services/cs2LogProcessor.js`)

**Purpose:** Core log parsing and processing logic

**Key Methods:**

```javascript
class CS2LogProcessor {
  /**
   * Process CS2 logs for a specific server
   * @param {number} serverId - Server identifier
   * @returns {Promise<Object>} Processing summary
   */
  async processLogs(serverId)

  /**
   * Read checkpoint file
   * @param {number} serverId
   * @returns {number} Last processed line number
   */
  readCheckpoint(serverId)

  /**
   * Update checkpoint file
   * @param {number} serverId
   * @param {number} lineNumber
   */
  updateCheckpoint(serverId, lineNumber)

  /**
   * Parse JSON block from log lines
   * @param {string[]} lines - Log lines
   * @returns {Object[]} Parsed player data
   */
  parseJsonBlocks(lines)

  /**
   * Detect new match start
   * @param {number} currentRound
   * @param {number} previousRound
   * @returns {boolean}
   */
  isNewMatch(currentRound, previousRound)

  /**
   * Generate unique match ID
   * @param {string} mapName
   * @returns {string} MD5 hash
   */
  generateMatchId(mapName)

  /**
   * Get next match number from database
   * @returns {Promise<number>}
   */
  async getNextMatchNumber()

  /**
   * Check if entry exists in database
   * @param {number} accountId
   * @param {string} matchId
   * @param {number} roundNumber
   * @returns {Promise<boolean>}
   */
  async isDuplicate(accountId, matchId, roundNumber)

  /**
   * Insert player round data
   * @param {Object} playerData
   * @returns {Promise<boolean>}
   */
  async insertPlayerData(playerData)
}
```

### 3. Database Model (`server/models/CS2Match.js`)

**Purpose:** MongoDB schema for CS2 match data

**Schema:**

```javascript
{
  accountid: { type: Number, required: true, index: true },
  team: { type: Number, required: true }, // 2=T, 3=CT
  kills: { type: Number, default: 0 },
  deaths: { type: Number, default: 0 },
  assists: { type: Number, default: 0 },
  dmg: { type: Number, default: 0 },
  kdr: { type: Number, default: 0 },
  mvp: { type: Number, default: 0 },
  map: { type: String, required: true },
  round_number: { type: Number, required: true },
  match_id: { type: String, required: true, index: true },
  match_number: { type: Number, required: true, index: true },
  match_date: { type: String, required: true },
  match_datetime: { type: Date, required: true },
  server_id: { type: Number, required: true, index: true }
}

// Unique compound index to prevent duplicates
Index: { accountid: 1, match_id: 1, round_number: 1 }, { unique: true }
```

## Data Models

### Log File Structure

CS2 logs contain mixed content:
- Standard log lines: `L 11/14/2025 - 04:43:17: Log file started...`
- JSON blocks for round statistics:

```
L 11/14/2025 - 06:15:50: JSON_BEGIN{
L 11/14/2025 - 06:15:50: "name": "round_stats",
L 11/14/2025 - 06:15:50: "round_number" : "1",
L 11/14/2025 - 06:15:50: "score_t" : "0",
L 11/14/2025 - 06:15:50: "score_ct" : "0",
L 11/14/2025 - 06:15:50: "map" : "de_mirage",
L 11/14/2025 - 06:15:50: "players" : {
L 11/14/2025 - 06:15:50: "player_0" : "1927445380, 2, 1000, 0, 0, 0, ..."
L 11/14/2025 - 06:15:50: }}JSON_END
```

### Player Data Fields (CSV format in logs)

Position | Field | Type | Description
---------|-------|------|------------
0 | accountid | Number | Steam account ID (32-bit)
1 | team | Number | 2=Terrorist, 3=Counter-Terrorist
2 | money | Number | Current money (not stored)
3 | kills | Number | Kills in this round
4 | deaths | Number | Deaths in this round
5 | assists | Number | Assists in this round
6 | dmg | Float | Damage dealt
7 | hsp | Float | Headshot percentage (not stored)
8 | kdr | Float | Kill/Death ratio
9 | adr | Number | Average damage per round (not stored)
10 | mvp | Number | MVP stars

### Processing State

```javascript
{
  currentMatchId: null,        // Current match UUID
  currentMatchNumber: 0,       // Sequential match number
  currentRoundNumber: 0,       // Current round (1-30)
  mapName: "unknown",          // Current map
  insideJsonBlock: false,      // Parser state
  processedRounds: {},         // In-memory duplicate cache
  lastProcessedLine: 0         // Checkpoint value
}
```

## Error Handling

### File System Errors

```javascript
try {
  const logContent = fs.readFileSync(logPath, 'utf-8');
} catch (error) {
  if (error.code === 'ENOENT') {
    return { success: false, error: 'Log file not found' };
  }
  throw error;
}
```

### Database Errors

```javascript
try {
  await playerData.save();
} catch (error) {
  if (error.code === 11000) { // Duplicate key
    console.log('Skipped duplicate entry');
    skippedCount++;
  } else {
    console.error('Database error:', error.message);
    throw error;
  }
}
```

### Checkpoint Reset Logic

```javascript
if (lastProcessedLine > totalLines) {
  console.log('Server restart detected! Resetting checkpoint.');
  lastProcessedLine = 0;
  fs.writeFileSync(checkpointPath, '0');
}
```

### Upload Validation

```javascript
if (!req.file) {
  return res.status(400).json({ error: 'No log file provided' });
}

if (!req.query.server_id) {
  return res.status(400).json({ error: 'server_id is required' });
}
```

## Testing Strategy

### Unit Tests

1. **Checkpoint Management**
   - Test reading non-existent checkpoint (should return 0)
   - Test reading existing checkpoint
   - Test checkpoint reset when value > total lines
   - Test checkpoint update after processing

2. **JSON Parsing**
   - Test extracting round_number from JSON block
   - Test extracting map name
   - Test parsing player CSV data
   - Test skipping warmup rounds (round 0)
   - Test handling malformed JSON blocks

3. **Match Detection**
   - Test new match detection (round 1 after round > 1)
   - Test match ID generation uniqueness
   - Test match number increment

4. **Bot Filtering**
   - Test skipping accountid = 0
   - Test processing valid accountid > 0

5. **Duplicate Prevention**
   - Test in-memory cache prevents same-session duplicates
   - Test database check prevents cross-session duplicates

### Integration Tests

1. **End-to-End Log Processing**
   - Upload sample log file
   - Trigger processing
   - Verify database entries
   - Verify checkpoint update
   - Upload additional lines
   - Verify incremental processing

2. **Multi-Server Support**
   - Process logs for server_id=1
   - Process logs for server_id=2
   - Verify separate checkpoints
   - Verify separate log files

3. **Server Restart Scenario**
   - Set checkpoint to 5000
   - Upload new log with 100 lines
   - Verify checkpoint resets to 0
   - Verify all lines are processed

### Manual Testing

1. **Cron Integration**
   - Configure cron to upload logs every minute
   - Verify files are saved correctly
   - Verify processing handles concurrent uploads

2. **Performance Testing**
   - Test with large log files (10,000+ lines)
   - Measure processing time
   - Verify memory usage remains stable

3. **Error Recovery**
   - Test with corrupted log files
   - Test with missing checkpoint files
   - Test with database connection failures

## Implementation Notes

### File Upload Configuration

```javascript
// Use multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    cb(null, logsDir);
  },
  filename: (req, file, cb) => {
    const serverId = req.query.server_id || 1;
    cb(null, `latest_server${serverId}.log`);
  }
});
```

### Incremental Processing Optimization

```javascript
// Only read new lines, not entire file
const lines = logContent.split('\n');
const newLines = lines.slice(lastProcessedLine);

// Process only new lines
for (const line of newLines) {
  // ... parsing logic
}
```

### Match Number Persistence

```javascript
// Cache match number in memory to avoid repeated DB queries
let cachedMatchNumber = null;

async getNextMatchNumber() {
  if (cachedMatchNumber === null) {
    const result = await CS2Match.findOne()
      .sort({ match_number: -1 })
      .select('match_number');
    cachedMatchNumber = result ? result.match_number : 0;
  }
  return ++cachedMatchNumber;
}
```

### Logging Strategy

Use a structured logging approach:

```javascript
console.log(`[CS2] Processing server ${serverId}`);
console.log(`[CS2] Total lines: ${totalLines}, Last processed: ${lastProcessedLine}`);
console.log(`[CS2] New match detected: #${matchNumber} (${matchId})`);
console.log(`[CS2] Round ${roundNumber}: Player ${accountid} - K/D: ${kills}/${deaths}`);
console.log(`[CS2] Summary: Inserted ${inserted}, Skipped ${skipped}, Map: ${map}`);
```

## Migration Path

### Phase 1: Parallel Operation
- Keep existing PHP scripts running
- Deploy Node.js implementation
- Configure separate test server to use Node.js endpoint
- Compare results between PHP and Node.js

### Phase 2: Gradual Rollout
- Switch one production server to Node.js
- Monitor for 24-48 hours
- Verify data consistency
- Switch remaining servers

### Phase 3: Cleanup
- Remove PHP scripts
- Update cron jobs to use Node.js endpoint directly
- Archive old PHP code

### Backward Compatibility

The Node.js implementation maintains compatibility with:
- Existing log file format
- Existing checkpoint file format
- Existing database schema (if using same collection)
- Existing cron job structure (can still use curl upload)

## Performance Considerations

1. **File I/O Optimization**
   - Use streaming for very large files (future enhancement)
   - Current implementation reads entire file (acceptable for logs < 10MB)

2. **Database Optimization**
   - Compound unique index prevents duplicates at DB level
   - Batch inserts for multiple players (future enhancement)
   - In-memory cache reduces duplicate check queries

3. **Memory Management**
   - Clear processedRounds cache after each processing run
   - Avoid storing entire log content in memory for large files

4. **Concurrency**
   - Use file locking if multiple processes might process same log
   - Current design assumes single processor per server_id

# Implementation Plan

- [x] 1. Create MongoDB model for CS2 match data



  - Create `server/models/CS2Match.js` with schema including accountid, team, kills, deaths, assists, dmg, kdr, mvp, map, round_number, match_id, match_number, match_date, match_datetime, server_id
  - Add compound unique index on [accountid, match_id, round_number] to prevent duplicates at database level
  - Export model for use in service layer




  - _Requirements: 1.7_

- [ ] 2. Implement CS2LogProcessor service class
  - [ ] 2.1 Create service file structure and checkpoint management
    - Create `server/services/cs2LogProcessor.js` with CS2LogProcessor class

    - Implement `readCheckpoint(serverId)` method to read checkpoint file or return 0 if not exists
    - Implement `updateCheckpoint(serverId, lineNumber)` method to write checkpoint file
    - Implement checkpoint reset logic when checkpoint > total lines (server restart detection)
    - _Requirements: 1.2, 1.10_

  - [x] 2.2 Implement log file reading and incremental processing

    - Implement `processLogs(serverId)` main method that reads log file from `logs/latest_server{serverId}.log`
    - Add logic to read checkpoint and slice log lines to process only new lines
    - Handle case when no new lines exist (checkpoint == total lines)
    - Add error handling for missing log files
    - _Requirements: 1.2, 1.10_

  - [x] 2.3 Implement JSON block parsing logic

    - Implement `parseJsonBlocks(lines)` method to extract player data from JSON blocks
    - Add state machine to track `insideJsonBlock` flag (true between JSON_BEGIN and JSON_END)
    - Extract round_number, map name, and player CSV data from JSON blocks
    - Skip warmup rounds (round_number === 0)
    - Parse player CSV fields: accountid, team, kills, deaths, assists, dmg, kdr, mvp

    - _Requirements: 1.3, 1.9_

  - [ ] 2.4 Implement bot filtering and validation
    - Add validation to skip player entries where accountid === 0
    - Add validation to skip entries with empty or missing accountid
    - Only process entries with valid non-zero accountid values

    - _Requirements: 1.4_

  - [ ] 2.5 Implement match detection and ID generation
    - Implement `isNewMatch(currentRound, previousRound)` to detect when round resets from high number to 1
    - Implement `generateMatchId(mapName)` using crypto.createHash('md5') with map name, date, timestamp, and random number
    - Implement `getNextMatchNumber()` to query database for max match_number and increment

    - Add logic to reset match_id and increment match_number when new match detected
    - _Requirements: 1.5_

  - [ ] 2.6 Implement duplicate prevention
    - Create in-memory cache `processedRounds` object to track processed entries in current session
    - Implement `isDuplicate(accountId, matchId, roundNumber)` to check both cache and database

    - Skip processing if same round_number encountered multiple times in log
    - Add duplicate detection logging
    - _Requirements: 1.6_

  - [ ] 2.7 Implement database insertion
    - Implement `insertPlayerData(playerData)` method to save documents to MongoDB




    - Handle duplicate key errors (code 11000) gracefully
    - Return success/failure status for each insertion
    - Track inserted and skipped counts
    - _Requirements: 1.7_


  - [ ] 2.8 Add comprehensive logging
    - Log processing start with total lines, last processed line, and new lines count
    - Log server restart detection when checkpoint reset occurs
    - Log new match detection with match_number and match_id
    - Log each player entry with accountid, match, round, and K/D stats

    - Log final summary with inserted count, skipped count, map name, and processed lines
    - _Requirements: 1.8_

- [ ] 3. Create Express routes for log upload and processing
  - [ ] 3.1 Set up multer configuration for file uploads
    - Create `server/routes/cs2Logs.js` route file


    - Configure multer with diskStorage to save files as `logs/latest_server{server_id}.log`
    - Create logs directory if it doesn't exist
    - _Requirements: 1.1_




  - [ ] 3.2 Implement log upload endpoint
    - Create POST `/api/cs2/upload-log` endpoint accepting multipart/form-data
    - Extract server_id from query parameters
    - Validate that logfile is provided in request
    - Return success/error response with appropriate HTTP status codes
    - _Requirements: 1.1_

  - [ ] 3.3 Implement manual processing endpoint
    - Create POST `/api/cs2/process-logs` endpoint accepting { serverId } in body
    - Call CS2LogProcessor.processLogs(serverId)
    - Return processing summary (inserted, skipped, map, processedLines)
    - Add error handling and appropriate HTTP status codes
    - _Requirements: 1.8_

  - [ ] 3.4 Register routes in Express app
    - Import cs2Logs routes in `server/index.js`
    - Mount routes at `/api/cs2` path
    - Ensure routes are accessible and properly configured
    - _Requirements: 1.1_

- [ ] 4. Create logs directory structure
  - Create `logs/` directory in project root if it doesn't exist
  - Add `.gitkeep` file to ensure directory is tracked in git
  - Add `logs/*.log` and `logs/checkpoint_*.txt` to `.gitignore` to exclude log files from version control
  - _Requirements: 1.1, 1.2_

- [ ]* 5. Add automated tests for core functionality
  - [ ]* 5.1 Write unit tests for checkpoint management
    - Test readCheckpoint returns 0 for non-existent file
    - Test readCheckpoint returns correct value from existing file
    - Test updateCheckpoint writes correct value
    - Test checkpoint reset when value exceeds total lines
    - _Requirements: 1.2_

  - [ ]* 5.2 Write unit tests for JSON parsing
    - Test parseJsonBlocks extracts round_number correctly
    - Test parseJsonBlocks extracts map name correctly
    - Test parseJsonBlocks parses player CSV data correctly
    - Test parseJsonBlocks skips warmup rounds (round 0)
    - Test parseJsonBlocks handles malformed JSON gracefully
    - _Requirements: 1.3_

  - [ ]* 5.3 Write unit tests for match detection
    - Test isNewMatch returns true when round resets from high to 1
    - Test isNewMatch returns false for sequential rounds
    - Test generateMatchId produces unique values
    - Test getNextMatchNumber increments correctly
    - _Requirements: 1.5_

  - [ ]* 5.4 Write unit tests for bot filtering
    - Test that accountid === 0 entries are skipped
    - Test that valid accountid > 0 entries are processed
    - Test that empty accountid entries are skipped
    - _Requirements: 1.4_

  - [ ]* 5.5 Write integration tests for end-to-end processing
    - Test uploading sample log file via API
    - Test processing logs and verifying database entries
    - Test checkpoint is updated after processing
    - Test incremental processing with additional log lines
    - Test multi-server support (server_id 1 and 2)
    - _Requirements: 1.1, 1.2, 1.7, 1.10_

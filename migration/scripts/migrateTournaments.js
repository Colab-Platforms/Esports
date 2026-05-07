const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config();

// Import models
const Tournament = require('../../server/models/Tournament');
const User = require('../../server/models/User');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `tournament_migration_${timestamp}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

// Transform tournament data from CSV to MongoDB schema
function transformTournamentData(row) {
  // Parse dates safely
  const parseDate = (dateValue) => {
    if (!dateValue || dateValue === 'NULL' || dateValue === null) {
      return null;
    }
    
    const dateStr = String(dateValue).trim();
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Parse numbers safely
  const parseNumber = (numValue) => {
    if (!numValue || numValue === 'NULL' || numValue === null) {
      return 0;
    }
    const num = parseFloat(String(numValue).trim());
    return isNaN(num) ? 0 : num;
  };

  // Parse status - map CSV status to schema status
  const mapStatus = (csvStatus) => {
    const status = String(csvStatus).trim().toLowerCase();
    const validStatuses = ['upcoming', 'registration_open', 'registration_closed', 'active', 'completed', 'cancelled', 'inactive'];
    
    if (status === 'open') return 'registration_open';
    if (validStatuses.includes(status)) return status;
    return 'upcoming';
  };

  // Parse game mode to extract game type
  const parseGameType = (gameMode) => {
    const mode = String(gameMode).trim().toLowerCase();
    if (mode.includes('bgmi')) return 'bgmi';
    if (mode.includes('cs2') || mode.includes('counter')) return 'cs2';
    if (mode.includes('valorant')) return 'valorant';
    if (mode.includes('freefire') || mode.includes('ff')) return 'ff'; // Changed from 'freefire' to 'ff'
    return 'bgmi'; // Default to BGMI
  };

  // Parse tournament mode
  const parseMode = (gameMode) => {
    const mode = String(gameMode).trim().toLowerCase();
    if (mode.includes('solo')) return 'solo';
    if (mode.includes('duo')) return 'duo';
    if (mode.includes('squad')) return 'squad';
    if (mode.includes('team')) return 'team';
    return 'squad'; // Default to squad
  };

  const createdAtDate = parseDate(row.createdAt);
  const startDate = parseDate(row.tournamentDate);
  const registrationStartDate = parseDate(row.registrationStartDate);
  const registrationEndDate = parseDate(row.registrationEndDate);
  const prizePool = parseNumber(row.prizePool);
  const maxParticipants = parseNumber(row.maxSlots);
  const currentParticipants = parseNumber(row.registeredTeams);
  const gameType = parseGameType(row.gameMode);
  const mode = parseMode(row.gameMode);
  const status = mapStatus(row.status);

  // Calculate end date (assume 4 hours after start date for tournaments)
  let endDate = null;
  if (startDate) {
    endDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000);
  }

  return {
    name: row.name || 'Unnamed Tournament',
    description: (row.description || '').substring(0, 1000), // Truncate to 1000 chars
    gameType: gameType,
    mode: mode,
    entryFee: 0, // All tournaments are free
    prizePool: prizePool,
    prizeDistribution: [], // Will be empty for now
    youtubeVideoId: null,
    isLiveStreamEnabled: false,
    maxParticipants: maxParticipants || 20,
    currentParticipants: currentParticipants || 0,
    grouping: {
      enabled: false,
      groupSize: 20
    },
    startDate: startDate,
    endDate: endDate,
    registrationDeadline: registrationEndDate,
    status: status,
    rules: '',
    format: 'elimination', // Default format
    participants: [], // Empty for migration
    matches: [],
    createdBy: null, // Will be set to admin user
    moderators: [],
    settings: {
      allowLateRegistration: false,
      requireKYC: true,
      autoStartMatches: false,
      streamUrl: '',
      discordInvite: ''
    },
    stats: {
      totalMatches: 0,
      completedMatches: 0,
      totalPrizeDistributed: 0
    },
    featured: false,
    bannerImage: row.imageUrl || '',
    tags: [gameType, mode],
    roomDetails: {
      bgmi: {
        roomId: '',
        password: '',
        map: 'Erangel',
        perspective: 'TPP',
        mode: 'Squad'
      },
      cs2: {
        serverIp: '',
        serverPort: '27015',
        password: '',
        rconPassword: '',
        connectCommand: '',
        mapPool: []
      },
      valorant: {
        matchId: '',
        serverRegion: 'Mumbai',
        mapPool: []
      }
    },
    region: 'mumbai',
    scoreboards: [],
    rewardDistribution: {
      winners: [],
      participationReward: 0,
      rewardsDistributed: false,
      distributedAt: null,
      distributedBy: null,
      recipients: []
    },
    videoUpload: {
      filename: null,
      originalName: null,
      filePath: null,
      fileSize: 0,
      mimeType: null,
      uploadedAt: null,
      uploadedBy: null,
      processed: false,
      processedAt: null,
      extractedData: null
    },
    createdAt: createdAtDate || new Date(),
    updatedAt: new Date()
  };
}

// Main migration function
async function migrateTournaments(filePath) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log('✅ Connected to MongoDB');

    log('\n🚀 Starting tournament migration...');
    log(`   File: ${filePath}`);
    log(`   Model: tournaments`);

    // Read CSV file using XLSX
    log('\n📂 Reading CSV file...');
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    log(`✅ Found ${rows.length} records in sheet "${sheetName}"`);
    
    if (rows.length > 0) {
      log(`📋 Sample record: ${JSON.stringify(rows[0]).substring(0, 200)}...`);
    }

    log('\n🔄 Transforming and inserting tournaments...');

    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const errors = [];
    const successes = [];

    // Get admin user for createdBy field
    let adminUser = await User.findOne({ role: 'admin' });
    
    if (!adminUser) {
      log('⚠️  No admin user found, using first user as creator');
      adminUser = await User.findOne();
    }

    // Insert tournaments
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const tournamentData = transformTournamentData(row);
        
        // Set creator
        if (adminUser) {
          tournamentData.createdBy = adminUser._id;
        }

        // Check if tournament with same name already exists
        const existingTournament = await Tournament.findOne({ 
          name: tournamentData.name 
        });

        if (existingTournament) {
          log(`⏭️  Skipping duplicate tournament: ${tournamentData.name} (already exists)`);
          skipCount++;
          continue;
        }

        // Create and save tournament
        const newTournament = new Tournament(tournamentData);
        await newTournament.save();

        successCount++;
        successes.push({
          rowNumber: i + 2, // +2 because row 1 is header
          name: tournamentData.name,
          id: newTournament._id
        });

        log(`✅ Inserted tournament: ${tournamentData.name}`);

      } catch (error) {
        errorCount++;
        errors.push({
          rowNumber: i + 2,
          name: row.name || 'Unknown',
          error: error.message
        });
        log(`❌ Error at row ${i + 2}: ${error.message}`);
      }
    }

    // Print summary
    log('\n📊 MIGRATION SUMMARY');
    log(`   ✅ Successfully Added: ${successCount}`);
    log(`   ⏭️  Skipped (Already Exist): ${skipCount}`);
    log(`   ❌ Errors: ${errorCount}`);

    if (successes.length > 0) {
      log('\n✅ SUCCESSFULLY ADDED TOURNAMENTS:');
      log('============================================================');
      successes.forEach((item, index) => {
        log(`${index + 1}. ${item.name} | ID: ${item.id}`);
      });
    }

    if (errors.length > 0) {
      log('\n❌ ERROR RECORDS:');
      log('============================================================');
      errors.forEach((item, index) => {
        log(`${index + 1}. Row ${item.rowNumber} | Error: ${item.error}`);
      });
    }

    log(`\n✅ Migration complete! Log saved to: ${logFile}`);
    logStream.end();

    await mongoose.connection.close();
    return { successCount, errorCount, skipCount, total: rows.length };

  } catch (error) {
    log('❌ Fatal error: ' + error.message);
    logStream.end();
    process.exit(1);
  }
}

// Run migration
async function main() {
  try {
    const filePath = process.argv[2] || './migration/data/tournament.csv';
    
    log('✅ Connected to MongoDB');
    log('\n🚀 Starting tournament migration...');
    log(`   File: ${filePath}`);
    log(`   Model: tournaments`);

    const result = await migrateTournaments(filePath);
    
    console.log('\n✅ Migration complete!');
    console.log(`   Successfully Added: ${result.successCount}`);
    console.log(`   Skipped: ${result.skipCount}`);
    console.log(`   Errors: ${result.errorCount}`);
    console.log(`   Total Processed: ${result.total}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();

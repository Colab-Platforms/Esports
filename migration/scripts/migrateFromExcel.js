const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.production' });

// Import models - adjust path based on where script is run from
const User = require('../../server/models/User');
const Tournament = require('../../server/models/Tournament');
const TournamentRegistration = require('../../server/models/TournamentRegistration');

// Create log file
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `migration_${timestamp}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

async function migrateExcelData(filePath, sheetName, modelName) {
  try {
    log(`\n📂 Reading Excel file: ${filePath}`);
    
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    
    if (!workbook.SheetNames.includes(sheetName)) {
      log(`❌ Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
      return;
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    log(`✅ Found ${data.length} records in sheet "${sheetName}"`);
    log(`📋 Sample record: ${JSON.stringify(data[0])}`);

    // Map model based on sheet name
    let Model;
    let transformFunction;

    if (modelName === 'users') {
      Model = User;
      transformFunction = transformUserData;
    } else if (modelName === 'tournaments') {
      Model = Tournament;
      transformFunction = transformTournamentData;
    } else if (modelName === 'registrations') {
      Model = TournamentRegistration;
      transformFunction = transformRegistrationData;
    }

    if (!Model) {
      log('❌ Unknown model: ' + modelName);
      return;
    }

    // Transform and insert data
    log(`\n🔄 Transforming and inserting ${data.length} records...`);
    
    let successCount = 0;
    let errorCount = 0;
    let skipCount = 0;
    const errors = [];
    const addedRecords = [];
    const skippedRecords = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const transformedData = transformFunction(data[i]);
        
        // Check if record already exists
        let existingRecord;
        if (modelName === 'users') {
          // Check by email OR phone number
          existingRecord = await Model.findOne({
            $or: [
              { email: transformedData.email },
              { phone: transformedData.phone }
            ]
          });
          
          if (existingRecord) {
            const reason = existingRecord.email === transformedData.email ? 'email' : 'phone';
            const skipMessage = `⏭️  Skipping duplicate user: ${transformedData.email} (${reason} already exists)`;
            log(skipMessage);
            skipCount++;
            skippedRecords.push({
              row: i + 1,
              email: transformedData.email,
              phone: transformedData.phone,
              reason: reason,
              existingId: existingRecord._id
            });
            continue;
          }
        } else if (modelName === 'tournaments') {
          existingRecord = await Model.findOne({ name: transformedData.name });
          if (existingRecord) {
            log(`⏭️  Skipping duplicate tournament: ${transformedData.name}`);
            skipCount++;
            skippedRecords.push({
              row: i + 1,
              name: transformedData.name,
              reason: 'name already exists',
              existingId: existingRecord._id
            });
            continue;
          }
        } else if (modelName === 'registrations') {
          // For registrations, check by teamName and tournamentId
          existingRecord = await Model.findOne({ 
            teamName: transformedData.teamName,
            tournamentId: transformedData.tournamentId
          });
          if (existingRecord) {
            log(`⏭️  Skipping duplicate registration: ${transformedData.teamName}`);
            skipCount++;
            skippedRecords.push({
              row: i + 1,
              teamName: transformedData.teamName,
              reason: 'team already registered',
              existingId: existingRecord._id
            });
            continue;
          }
        }

        const record = new Model(transformedData);
        const savedRecord = await record.save();
        successCount++;
        
        // Log added record details
        addedRecords.push({
          row: i + 1,
          _id: savedRecord._id,
          email: transformedData.email || transformedData.name || transformedData.teamName,
          createdAt: savedRecord.createdAt
        });

        if ((i + 1) % 10 === 0) {
          log(`✅ Processed ${i + 1}/${data.length} records...`);
        }
      } catch (error) {
        errorCount++;
        errors.push({
          row: i + 1,
          data: data[i],
          error: error.message
        });
        log(`❌ Error at row ${i + 1}: ${error.message}`);
      }
    }

    // Write detailed summary
    log(`\n${'='.repeat(60)}`);
    log(`📊 MIGRATION SUMMARY`);
    log(`${'='.repeat(60)}`);
    log(`   ✅ Successfully Added: ${successCount}`);
    log(`   ⏭️  Skipped (Already Exist): ${skipCount}`);
    log(`   ❌ Errors: ${errorCount}`);
    log(`   📈 Total Processed: ${data.length}`);
    log(`${'='.repeat(60)}`);

    // Log all added records
    if (addedRecords.length > 0) {
      log(`\n✅ ADDED RECORDS (${addedRecords.length}):`);
      log(`${'='.repeat(60)}`);
      addedRecords.forEach((record, idx) => {
        log(`${idx + 1}. Row ${record.row} | ID: ${record._id} | Email/Name: ${record.email}`);
      });
    }

    // Log all skipped records
    if (skippedRecords.length > 0) {
      log(`\n⏭️  SKIPPED RECORDS (${skippedRecords.length}):`);
      log(`${'='.repeat(60)}`);
      skippedRecords.forEach((record, idx) => {
        log(`${idx + 1}. Row ${record.row} | Reason: ${record.reason} | Existing ID: ${record.existingId}`);
      });
    }

    // Log errors
    if (errors.length > 0) {
      log(`\n❌ ERROR RECORDS (${errors.length}):`);
      log(`${'='.repeat(60)}`);
      errors.forEach((err, idx) => {
        log(`${idx + 1}. Row ${err.row} | Error: ${err.error}`);
      });
    }

    log(`\n✅ Migration complete! Log saved to: ${logFile}`);

  } catch (error) {
    log('❌ Migration error: ' + error.message);
  }
}

// Transform functions for different data types
function transformUserData(row) {
  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  
  // Generate unique username - if display_name is NULL or empty, use email or generate one
  let username = row.display_name;
  if (!username || username === 'NULL' || username === null || username.trim() === '') {
    // Try to use email prefix
    if (row.email && row.email !== 'NULL') {
      username = row.email.split('@')[0];
    } else if (fullName) {
      username = fullName.replace(/\s+/g, '_').toLowerCase();
    } else {
      username = `user_${Math.random().toString(36).substr(2, 9)}`;
    }
  }
  
  // Ensure username is unique and within 30 character limit
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
  const baseUsername = username.substring(0, 20).replace(/[^a-zA-Z0-9_]/g, '_');
  username = `${baseUsername}_${timestamp}`.substring(0, 30);

  // Helper function to validate and clean email
  const validateEmail = (emailValue) => {
    if (!emailValue || emailValue === 'NULL' || emailValue === null) {
      return '';
    }
    
    const emailStr = String(emailValue).trim().toLowerCase();
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    
    if (emailRegex.test(emailStr)) {
      return emailStr;
    }
    
    return ''; // Return empty if invalid
  };

  // Helper function to validate and clean phone
  const validatePhone = (phoneValue) => {
    if (!phoneValue || phoneValue === 'NULL' || phoneValue === null) {
      return '';
    }
    
    const phoneStr = String(phoneValue).trim();
    const phoneRegex = /^[6-9]\d{9}$/;
    
    if (phoneRegex.test(phoneStr)) {
      return phoneStr;
    }
    
    return ''; // Return empty if invalid
  };

  // Helper function to parse dates safely
  const parseDate = (dateValue) => {
    if (!dateValue || dateValue === 'NULL' || dateValue === null) {
      return null;
    }
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    
    // Convert to string and trim
    const dateStr = String(dateValue).trim();
    
    // If it's a number (Excel serial date), convert it
    if (!isNaN(dateStr) && dateStr !== '') {
      const excelDate = parseFloat(dateStr);
      // Excel date serial number (days since 1900-01-01)
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Try parsing as ISO or standard date string
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Helper function to safely convert steamid to string
  const getSteamId = (steamidValue) => {
    if (!steamidValue || steamidValue === 'NULL' || steamidValue === null) {
      return '';
    }
    
    const steamidStr = String(steamidValue).trim();
    
    // Check if it's a pending steamid
    if (steamidStr.startsWith('pending_')) {
      return '';
    }
    
    return steamidStr;
  };

  const email = validateEmail(row.email);
  const phone = validatePhone(row.mobile);
  const steamId = getSteamId(row.steamid);
  const createdAtDate = parseDate(row.created_at);
  const lastLoginDate = parseDate(row.last_login);
  const profileUpdatedDate = parseDate(row.profile_updated_at);

  // Map CSV fields to MongoDB schema fields exactly
  return {
    // Required fields
    username: username,
    email: email || `migrated_${Date.now()}@migrated.local`, // Fallback email if invalid
    phone: phone,
    fullName: fullName,
    passwordHash: 'migrated_user_' + Date.now(), // Generate a placeholder password hash for migrated users
    
    // Auth and status
    authProvider: 'local',
    isActive: true,
    isEmailVerified: row.email_verified === '1' || row.email_verified === 1,
    isPhoneVerified: false,
    
    // Profile info
    avatarUrl: row.avatar || '',
    kycStatus: 'pending',
    panCard: '',
    role: 'user',
    
    // Game IDs - mapped from CSV
    gameIds: {
      steam: steamId,
      bgmi: { ign: '', uid: '' },
      freefire: { ign: '', uid: '' },
      valorant: ''
    },
    
    // Legacy fields for backward compatibility
    bgmiIgnName: '',
    bgmiUid: '',
    freeFireIgnName: '',
    freeFireUid: '',
    
    // Steam profile info
    steamProfile: steamId ? {
      steamId: steamId,
      profileUrl: row.profileurl || '',
      avatar: row.avatar || '',
      displayName: row.personaname || username,
      realName: '',
      countryCode: '',
      isConnected: true,
      connectedAt: createdAtDate || new Date(),
      lastSync: new Date()
    } : undefined,
    
    // Steam games (empty for migrated users)
    steamGames: {
      cs2: {
        owned: false,
        playtime: 0,
        achievements: 0,
        verified: false
      },
      csgo: {
        owned: false,
        playtime: 0,
        rank: ''
      }
    },
    
    // Login tracking
    loginStreak: 0,
    lastLogin: lastLoginDate,
    
    // Timestamps
    createdAt: createdAtDate || new Date(),
    updatedAt: profileUpdatedDate || new Date()
  };
}

function transformTournamentData(row) {
  return {
    name: row.name,
    description: row.description || '',
    gameType: row.gameType || 'bgmi',
    mode: row.mode || '4v4',
    status: row.status || 'upcoming',
    startDate: row.startDate ? new Date(row.startDate) : new Date(),
    endDate: row.endDate ? new Date(row.endDate) : new Date(),
    registrationDeadline: row.registrationDeadline ? new Date(row.registrationDeadline) : new Date(),
    maxParticipants: parseInt(row.maxParticipants) || 100,
    entryFee: parseFloat(row.entryFee) || 0,
    prizePool: parseFloat(row.prizePool) || 0,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    updatedAt: new Date()
  };
}

function transformRegistrationData(row) {
  return {
    teamName: row.teamName,
    teamLeader: {
      name: row.leaderName || '',
      bgmiId: row.leaderBgmiId || '',
      phone: row.leaderPhone || ''
    },
    teamMembers: [
      { name: row.player1Name || '', bgmiId: row.player1BgmiId || '' },
      { name: row.player2Name || '', bgmiId: row.player2BgmiId || '' },
      { name: row.player3Name || '', bgmiId: row.player3BgmiId || '' }
    ],
    whatsappNumber: row.whatsappNumber || '',
    status: row.status || 'pending',
    registeredAt: row.registeredAt ? new Date(row.registeredAt) : new Date(),
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
    updatedAt: new Date()
  };
}

// Main execution
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    log('✅ Connected to MongoDB');

    const excelFile = process.argv[2] || './migration/data/users.csv';
    const sheetName = process.argv[3] || 'users';
    const modelName = process.argv[4] || 'users';

    log(`\n🚀 Starting migration...`);
    log(`   File: ${excelFile}`);
    log(`   Sheet: ${sheetName}`);
    log(`   Model: ${modelName}`);

    await migrateExcelData(excelFile, sheetName, modelName);

    await mongoose.connection.close();
    log('\n✅ Migration complete!');
    logStream.end();
  } catch (error) {
    log('❌ Fatal error: ' + error.message);
    logStream.end();
    process.exit(1);
  }
}

main();

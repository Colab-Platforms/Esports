const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: '.env.production' });

// Import models
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const TournamentRegistration = require('../models/TournamentRegistration');

async function migrateExcelData(filePath, sheetName, modelName) {
  try {
    console.log(`\n📂 Reading Excel file: ${filePath}`);
    
    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    
    if (!workbook.SheetNames.includes(sheetName)) {
      console.error(`❌ Sheet "${sheetName}" not found. Available sheets:`, workbook.SheetNames);
      return;
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`✅ Found ${data.length} records in sheet "${sheetName}"`);
    console.log(`📋 Sample record:`, data[0]);

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
      console.error('❌ Unknown model:', modelName);
      return;
    }

    // Transform and insert data
    console.log(`\n🔄 Transforming and inserting ${data.length} records...`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      try {
        const transformedData = transformFunction(data[i]);
        
        // Check if record already exists (by email for users, by name for tournaments)
        let existingRecord;
        if (modelName === 'users') {
          existingRecord = await Model.findOne({ email: transformedData.email });
          if (existingRecord) {
            console.log(`⏭️  Skipping duplicate user: ${transformedData.email}`);
            continue;
          }
        } else if (modelName === 'tournaments') {
          existingRecord = await Model.findOne({ name: transformedData.name });
          if (existingRecord) {
            console.log(`⏭️  Skipping duplicate tournament: ${transformedData.name}`);
            continue;
          }
        }

        const record = new Model(transformedData);
        await record.save();
        successCount++;

        if ((i + 1) % 10 === 0) {
          console.log(`✅ Processed ${i + 1}/${data.length} records...`);
        }
      } catch (error) {
        errorCount++;
        errors.push({
          row: i + 1,
          data: data[i],
          error: error.message
        });
        console.error(`❌ Error at row ${i + 1}:`, error.message);
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📈 Total: ${data.length}`);

    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n⚠️  Error Details:`);
      errors.forEach(err => {
        console.log(`   Row ${err.row}: ${err.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

// Transform functions for different data types
function transformUserData(row) {
  // Extract first and last name
  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const username = row.display_name || fullName || `user_${Date.now()}`;

  return {
    // REQUIRED FIELDS
    username: username,
    email: row.email,
    phone: row.mobile || '',
    fullName: fullName,
    
    // REQUIRED WITH DEFAULTS
    passwordHash: '', // Old passwords not migrated for security
    authProvider: 'local', // All old users are local auth
    
    // OPTIONAL FIELDS WITH DEFAULTS
    avatarUrl: row.avatar || '',
    kycStatus: 'pending',
    panCard: '',
    role: 'user',
    isActive: true,
    isEmailVerified: row.email_verified === '1' || row.email_verified === 1,
    isPhoneVerified: false,
    
    // GAME IDS - NESTED OBJECT
    gameIds: {
      steam: row.steamid && !row.steamid.startsWith('pending_') ? row.steamid : '',
      bgmi: {
        ign: '',
        uid: ''
      },
      freefire: {
        ign: '',
        uid: ''
      },
      valorant: ''
    },
    
    // LEGACY FIELDS (for backward compatibility)
    bgmiIgnName: '',
    bgmiUid: '',
    freeFireIgnName: '',
    freeFireUid: '',
    
    // STEAM PROFILE (if Steam ID exists)
    steamProfile: row.steamid && !row.steamid.startsWith('pending_') ? {
      steamId: row.steamid,
      profileUrl: row.profileurl || '',
      avatar: row.avatar || '',
      displayName: row.personaname || username,
      realName: '',
      countryCode: '',
      isConnected: true,
      connectedAt: row.created_at ? new Date(row.created_at) : new Date(),
      lastSync: new Date()
    } : undefined,
    
    // PROFILE INFO
    bio: row.bio || '',
    country: 'India',
    favoriteGame: 'bgmi',
    profileVisibility: row.privacy_level === 'public' ? 'public' : 'private',
    state: '',
    
    // SOCIAL ACCOUNTS
    socialAccounts: {
      twitter: '',
      instagram: '',
      github: '',
      linkedin: '',
      google: {
        email: '',
        id: '',
        isConnected: false,
        name: '',
        picture: ''
      }
    },
    
    // PREFERENCES
    preferences: {
      notifications: {
        email: true,
        push: true,
        tournaments: true,
        matches: true
      },
      privacy: {
        showStats: true,
        showEarnings: false
      }
    },
    
    // ARRAYS (empty)
    friends: [],
    achievements: [],
    securityFlags: [],
    
    // TIMESTAMPS
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.profile_updated_at ? new Date(row.profile_updated_at) : new Date(),
    lastLogin: row.last_login ? new Date(row.last_login) : null,
    
    // STATS
    loginStreak: 0,
    totalEarnings: 0,
    tournamentsWon: 0,
    level: 1,
    experience: 0
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
    console.log('✅ Connected to MongoDB');

    // Example usage - modify these paths and sheet names
    const excelFile = process.argv[2] || './data.xlsx';
    const sheetName = process.argv[3] || 'users';
    const modelName = process.argv[4] || 'users';

    console.log(`\n🚀 Starting migration...`);
    console.log(`   File: ${excelFile}`);
    console.log(`   Sheet: ${sheetName}`);
    console.log(`   Model: ${modelName}`);

    await migrateExcelData(excelFile, sheetName, modelName);

    await mongoose.connection.close();
    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();

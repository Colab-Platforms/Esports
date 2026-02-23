const mongoose = require('mongoose');
require('dotenv').config();

// ⚠️ IMPORTANT: Set this to your PRODUCTION MongoDB URI
// Get it from Render environment variables
const PROD_URI = process.env.MONGODB_URI || process.env.PROD_MONGODB_URI;

console.log('🚨 PRODUCTION MIGRATION SCRIPT');
console.log('================================');
console.log('This script will:');
console.log('1. Fix email index (make it sparse)');
console.log('2. Add fullName to all existing users');
console.log('');
console.log('⚠️  WARNING: This will modify PRODUCTION database!');
console.log('📋 Make sure you have a backup before proceeding.');
console.log('');

async function runMigrations() {
  try {
    console.log('🔧 Connecting to database...');
    console.log('📍 URI:', PROD_URI ? 'Set ✅' : 'NOT SET ❌');
    
    if (!PROD_URI) {
      console.error('❌ ERROR: MONGODB_URI not set!');
      console.log('Set it in .env file or pass as environment variable');
      process.exit(1);
    }

    await mongoose.connect(PROD_URI);
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Get database stats
    const totalUsers = await usersCollection.countDocuments({});
    console.log(`📊 Total users in database: ${totalUsers}`);
    console.log('');

    // ============================================
    // STEP 1: Fix Email Index
    // ============================================
    console.log('📋 STEP 1: Fixing email index...');
    console.log('-----------------------------------');
    
    try {
      const indexes = await usersCollection.indexes();
      const emailIndex = indexes.find(idx => idx.name === 'email_1');
      
      if (emailIndex) {
        console.log('📍 Current email index:', JSON.stringify(emailIndex, null, 2));
        
        if (!emailIndex.sparse) {
          console.log('🔄 Dropping old email index...');
          await usersCollection.dropIndex('email_1');
          console.log('✅ Old email index dropped');
        } else {
          console.log('ℹ️  Email index is already sparse, skipping...');
        }
      } else {
        console.log('ℹ️  No email index found');
      }
    } catch (error) {
      console.log('ℹ️  Error checking index:', error.message);
    }

    console.log('🔨 Creating new sparse unique email index...');
    await usersCollection.createIndex(
      { email: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'email_1'
      }
    );
    console.log('✅ New sparse email index created');
    console.log('');

    // ============================================
    // STEP 2: Add fullName to Existing Users
    // ============================================
    console.log('📋 STEP 2: Adding fullName to existing users...');
    console.log('-----------------------------------------------');
    
    const usersWithoutFullName = await usersCollection.find({
      $or: [
        { fullName: { $exists: false } },
        { fullName: null },
        { fullName: '' }
      ]
    }).toArray();

    console.log(`📊 Found ${usersWithoutFullName.length} users without fullName`);
    
    if (usersWithoutFullName.length === 0) {
      console.log('✅ All users already have fullName field');
      console.log('');
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    }

    console.log('');
    console.log('🔄 Updating users...');
    console.log('');

    let updated = 0;
    for (const user of usersWithoutFullName) {
      // Generate fullName from username or email
      let fullName = user.username;
      
      if (!fullName && user.email) {
        // Extract name from email (before @)
        fullName = user.email.split('@')[0].replace(/[._-]/g, ' ');
      }
      
      if (!fullName) {
        // Fallback: Use user ID
        fullName = 'User ' + user._id.toString().substring(0, 8);
      }

      // Capitalize first letter of each word
      fullName = fullName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      // Update user
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { fullName } }
      );

      console.log(`  ✅ ${updated + 1}/${usersWithoutFullName.length} - ${user.username || user.email}: "${fullName}"`);
      updated++;
    }

    console.log('');
    console.log('================================');
    console.log('🎉 Migration completed successfully!');
    console.log('================================');
    console.log(`📊 Statistics:`);
    console.log(`   - Total users: ${totalUsers}`);
    console.log(`   - Updated users: ${updated}`);
    console.log(`   - Email index: Sparse ✅`);
    console.log('');
    console.log('✅ Database is ready for new code deployment!');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('================================');
    console.error('❌ MIGRATION FAILED!');
    console.error('================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('');
    console.error('⚠️  Database may be in inconsistent state!');
    console.error('📋 Check the error and try again.');
    console.error('🔄 If needed, restore from backup.');
    console.error('');
    process.exit(1);
  }
}

// Confirmation prompt
console.log('⏳ Starting in 5 seconds...');
console.log('   Press Ctrl+C to cancel');
console.log('');

setTimeout(() => {
  runMigrations();
}, 5000);

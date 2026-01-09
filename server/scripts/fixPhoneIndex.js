// Fix phone index duplicate key error
// Run this once to drop and recreate the phone index with sparse: true

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fixPhoneIndex = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const User = require('../models/User');
    
    console.log('🔍 Checking existing indexes...');
    const indexes = await User.collection.getIndexes();
    console.log('📋 Current indexes:', Object.keys(indexes));
    
    // Drop the old phone index if it exists
    if (indexes.phone_1) {
      console.log('🗑️  Dropping old phone_1 index...');
      await User.collection.dropIndex('phone_1');
      console.log('✅ Old phone_1 index dropped');
    }
    
    // Create new sparse index
    console.log('🔨 Creating new sparse phone index...');
    await User.collection.createIndex(
      { phone: 1 },
      { unique: true, sparse: true }
    );
    console.log('✅ New sparse phone index created');
    
    // Verify
    const newIndexes = await User.collection.getIndexes();
    console.log('📋 New indexes:', Object.keys(newIndexes));
    
    console.log('✅ Phone index fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing phone index:', error);
    process.exit(1);
  }
};

fixPhoneIndex();

const mongoose = require('mongoose');
require('dotenv').config();

const fixEmailIndex = async () => {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('📋 Checking existing indexes...');
    const indexes = await usersCollection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Drop the old email index if it exists
    try {
      console.log('🗑️ Dropping old email_1 index...');
      await usersCollection.dropIndex('email_1');
      console.log('✅ Old email index dropped');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️ Index email_1 does not exist, skipping...');
      } else {
        throw error;
      }
    }

    // Create new sparse unique index on email
    console.log('🔨 Creating new sparse unique index on email...');
    await usersCollection.createIndex(
      { email: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'email_1'
      }
    );
    console.log('✅ New sparse email index created');

    console.log('📋 Final indexes:');
    const finalIndexes = await usersCollection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, index.key, index.sparse ? '(sparse)' : '');
    });

    console.log('✅ Email index fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing email index:', error);
    process.exit(1);
  }
};

fixEmailIndex();

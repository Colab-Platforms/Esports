const mongoose = require('mongoose');
require('dotenv').config();

const addFullNameToExistingUsers = async () => {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    console.log('🔍 Finding users without fullName...');
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
      process.exit(0);
    }

    // Update each user
    let updated = 0;
    for (const user of usersWithoutFullName) {
      // Use username as fullName, or generate from email
      let fullName = user.username;
      
      if (!fullName && user.email) {
        // Extract name from email (before @)
        fullName = user.email.split('@')[0].replace(/[._-]/g, ' ');
      }
      
      if (!fullName) {
        fullName = 'User ' + user._id.toString().substring(0, 8);
      }

      // Capitalize first letter of each word
      fullName = fullName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { fullName } }
      );

      console.log(`✅ Updated user ${user.username || user.email}: fullName = "${fullName}"`);
      updated++;
    }

    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📊 Updated ${updated} users`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
};

addFullNameToExistingUsers();

// Script to fix tournament registration statuses
const mongoose = require('mongoose');
const Tournament = require('./server/models/Tournament');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports';

async function fixRegistrationStatuses() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const now = new Date();
    console.log('⏰ Current time:', now.toISOString());
    
    // Find all tournaments
    const tournaments = await Tournament.find({});
    console.log(`\n📊 Found ${tournaments.length} tournaments\n`);
    
    let updatedCount = 0;
    
    for (const tournament of tournaments) {
      const oldStatus = tournament.status;
      let newStatus = oldStatus;
      
      console.log(`\n🎮 Tournament: ${tournament.name}`);
      console.log(`   Current Status: ${oldStatus}`);
      console.log(`   Registration Deadline: ${tournament.registrationDeadline.toISOString()}`);
      console.log(`   Start Date: ${tournament.startDate.toISOString()}`);
      console.log(`   End Date: ${tournament.endDate.toISOString()}`);
      
      // Determine correct status
      if (now >= tournament.endDate) {
        newStatus = 'completed';
        console.log(`   ✅ Should be: completed (end date passed)`);
      } else if (now >= tournament.startDate) {
        newStatus = 'active';
        console.log(`   ✅ Should be: active (start date reached)`);
      } else if (now >= tournament.registrationDeadline) {
        newStatus = 'registration_closed';
        console.log(`   ✅ Should be: registration_closed (deadline passed)`);
      } else if (now < tournament.registrationDeadline) {
        newStatus = 'registration_open';
        console.log(`   ✅ Should be: registration_open (before deadline)`);
      }
      
      // Update if status changed
      if (oldStatus !== newStatus) {
        tournament.status = newStatus;
        await tournament.save();
        updatedCount++;
        console.log(`   🔄 Updated: ${oldStatus} → ${newStatus}`);
      } else {
        console.log(`   ✓ Status correct: ${oldStatus}`);
      }
    }
    
    console.log(`\n\n🎉 Done! Updated ${updatedCount} tournaments`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixRegistrationStatuses();

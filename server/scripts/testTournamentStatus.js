// Test script to verify tournament status update logic
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Tournament = require('../models/Tournament');

async function testTournamentStatusUpdate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find BGMI tournaments that might have status issues
    const bgmiTournaments = await Tournament.find({
      gameType: 'bgmi',
      status: { $in: ['upcoming', 'registration_open', 'registration_closed', 'active'] }
    });
    
    console.log(`\n🔍 Found ${bgmiTournaments.length} BGMI tournaments to check:`);
    
    const now = new Date();
    
    for (const tournament of bgmiTournaments) {
      console.log(`\n📋 Tournament: ${tournament.name}`);
      console.log(`   Current Status: ${tournament.status}`);
      console.log(`   Registration Deadline: ${tournament.registrationDeadline?.toLocaleString() || 'Not set'}`);
      console.log(`   Start Date: ${tournament.startDate?.toLocaleString() || 'Not set'}`);
      console.log(`   End Date: ${tournament.endDate?.toLocaleString() || 'Not set'}`);
      console.log(`   Current Time: ${now.toLocaleString()}`);
      
      // Check what status it should be
      let suggestedStatus = tournament.status;
      
      if (tournament.endDate && now >= tournament.endDate) {
        suggestedStatus = 'completed';
      } else if (tournament.startDate && now >= tournament.startDate && tournament.status === 'registration_closed') {
        suggestedStatus = 'active';
      } else if (tournament.registrationDeadline && now >= tournament.registrationDeadline && 
                 (tournament.status === 'upcoming' || tournament.status === 'registration_open')) {
        suggestedStatus = 'registration_closed';
      }
      
      console.log(`   Suggested Status: ${suggestedStatus}`);
      
      if (suggestedStatus !== tournament.status) {
        console.log(`   ⚠️  STATUS MISMATCH DETECTED!`);
      } else {
        console.log(`   ✅ Status is correct`);
      }
    }
    
    // Run the automatic status update
    console.log(`\n🔄 Running automatic status update...`);
    const result = await Tournament.updateTournamentStatuses();
    
    if (result.success) {
      console.log(`✅ Status update completed. Updated ${result.updatedCount} tournaments.`);
    } else {
      console.log(`❌ Status update failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testTournamentStatusUpdate();
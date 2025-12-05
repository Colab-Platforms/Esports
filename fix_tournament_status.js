// One-time script to fix tournament statuses
const mongoose = require('mongoose');
const Tournament = require('./server/models/Tournament');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports';

async function fixTournamentStatuses() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const now = new Date();
    
    // Fix tournaments with passed registration deadlines
    const result = await Tournament.updateMany(
      {
        status: 'registration_open',
        registrationDeadline: { $lt: now }
      },
      {
        $set: { status: 'registration_closed' }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} tournaments to 'registration_closed'`);
    
    // Also check for tournaments that should be active
    const activeResult = await Tournament.updateMany(
      {
        status: 'registration_closed',
        startDate: { $lte: now }
      },
      {
        $set: { status: 'active' }
      }
    );
    
    console.log(`✅ Updated ${activeResult.modifiedCount} tournaments to 'active'`);
    
    // Check for tournaments that should be completed
    const completedResult = await Tournament.updateMany(
      {
        status: 'active',
        endDate: { $lte: now }
      },
      {
        $set: { status: 'completed' }
      }
    );
    
    console.log(`✅ Updated ${completedResult.modifiedCount} tournaments to 'completed'`);
    
    console.log('\n🎉 All tournament statuses fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTournamentStatuses();

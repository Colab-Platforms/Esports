// Script to create a test CS2 tournament with open registration
const mongoose = require('mongoose');
const Tournament = require('./server/models/Tournament');
const User = require('./server/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://colab_esports:qZgaDLfllrytAKqM@esports.zn4fbf9.mongodb.net/colab-esports';

async function createTestTournament() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find an admin user to be the creator
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('❌ No admin user found');
      process.exit(1);
    }
    
    const now = new Date();
    const registrationDeadline = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const startDate = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    const endDate = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 hours from now
    
    const tournament = new Tournament({
      name: 'CS2 Test Tournament - Registration Open',
      description: 'Test tournament to verify registration is working correctly',
      gameType: 'cs2',
      mode: 'team',
      entryFee: 0,
      prizePool: 10000,
      prizeDistribution: [
        { position: 1, amount: 5000, percentage: 50 },
        { position: 2, amount: 3000, percentage: 30 },
        { position: 3, amount: 2000, percentage: 20 }
      ],
      maxParticipants: 16,
      currentParticipants: 0,
      startDate,
      endDate,
      registrationDeadline,
      status: 'registration_open',
      rules: 'Standard CS2 competitive rules apply. No cheating, no toxic behavior.',
      format: 'elimination',
      createdBy: admin._id,
      featured: true,
      roomDetails: {
        cs2: {
          serverIp: '192.168.1.100',
          serverPort: 27015,
          serverPassword: 'test123',
          connectCommand: 'steam://connect/192.168.1.100:27015/test123'
        }
      }
    });
    
    await tournament.save();
    
    console.log('\n✅ Test tournament created successfully!');
    console.log('\n📋 Tournament Details:');
    console.log(`   Name: ${tournament.name}`);
    console.log(`   ID: ${tournament._id}`);
    console.log(`   Status: ${tournament.status}`);
    console.log(`   Registration Deadline: ${registrationDeadline.toISOString()}`);
    console.log(`   Start Date: ${startDate.toISOString()}`);
    console.log(`   End Date: ${endDate.toISOString()}`);
    console.log(`   Is Registration Open: ${tournament.isRegistrationOpen}`);
    console.log('\n🎮 You can now test registration with this tournament!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestTournament();

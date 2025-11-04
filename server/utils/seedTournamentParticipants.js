const Tournament = require('../models/Tournament');
const User = require('../models/User');

const seedTournamentParticipants = async () => {
  try {
    console.log('👥 Seeding tournament participants...');
    
    // Get some tournaments to add participants to
    const tournaments = await Tournament.find({ gameType: 'cs2' }).limit(2);
    
    if (tournaments.length === 0) {
      console.log('⚠️ No CS2 tournaments found to add participants to');
      return;
    }

    // Get some users to use as participants (or create dummy ones)
    let users = await User.find().limit(10);
    
    if (users.length === 0) {
      console.log('📝 Creating dummy users for tournament participants...');
      
      const dummyUsers = [
        {
          username: 'ProGamer_CS2',
          email: 'progamer@example.com',
          password: 'hashedpassword123',
          gameIds: { steam: '76561198123456789' },
          level: 15,
          currentRank: 'Global Elite',
          totalEarnings: 5000
        },
        {
          username: 'SniperKing',
          email: 'sniper@example.com',
          password: 'hashedpassword123',
          gameIds: { steam: '76561198987654321' },
          level: 12,
          currentRank: 'Supreme Master',
          totalEarnings: 3200
        },
        {
          username: 'FlashMaster',
          email: 'flash@example.com',
          password: 'hashedpassword123',
          gameIds: { steam: '76561198456789123' },
          level: 18,
          currentRank: 'Global Elite',
          totalEarnings: 7500
        },
        {
          username: 'RifleExpert',
          email: 'rifle@example.com',
          password: 'hashedpassword123',
          gameIds: { steam: '76561198789123456' },
          level: 10,
          currentRank: 'Legendary Eagle',
          totalEarnings: 2100
        },
        {
          username: 'ClutchKing',
          email: 'clutch@example.com',
          password: 'hashedpassword123',
          gameIds: { steam: '76561198321654987' },
          level: 14,
          currentRank: 'Supreme Master',
          totalEarnings: 4300
        },
        {
          username: 'HeadshotHero',
          email: 'headshot@example.com',
          password: 'hashedpassword123',
          gameIds: { steam: '76561198654321789' },
          level: 16,
          currentRank: 'Global Elite',
          totalEarnings: 6200
        }
      ];

      users = await User.insertMany(dummyUsers);
      console.log(`✅ Created ${users.length} dummy users`);
    }

    // Add participants to tournaments
    for (const tournament of tournaments) {
      const participantsToAdd = users.slice(0, Math.min(users.length, 6)); // Add up to 6 participants
      
      const participants = participantsToAdd.map((user, index) => ({
        userId: user._id,
        teamName: tournament.mode === 'solo' ? '' : `Team ${user.username}`,
        playerName: user.username,
        gameId: user.gameIds?.steam || `steam_${Date.now()}_${index}`,
        registeredAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last 7 days
        status: 'confirmed',
        paymentStatus: 'completed'
      }));

      // Update tournament with participants
      await Tournament.findByIdAndUpdate(tournament._id, {
        $push: { participants: { $each: participants } },
        currentParticipants: participants.length
      });

      console.log(`👥 Added ${participants.length} participants to "${tournament.name}"`);
    }

    console.log('✅ Tournament participants seeded successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding tournament participants:', error);
    throw error;
  }
};

module.exports = { seedTournamentParticipants };
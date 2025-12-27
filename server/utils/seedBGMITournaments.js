const Tournament = require('../models/Tournament');

// Dummy admin user ID for createdBy
const dummyAdminId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

const bgmiTournamentsData = [
  {
    name: 'BGMI Winter Championship 2024',
    description: 'Epic BGMI tournament with massive prize pool and intense battles',
    gameType: 'bgmi',
    mode: 'squad',
    format: 'battle_royale',
    entryFee: 50,
    prizePool: 50000,
    prizeDistribution: [
      { position: 1, amount: 25000, percentage: 50 },
      { position: 2, amount: 15000, percentage: 30 },
      { position: 3, amount: 7500, percentage: 15 },
      { position: 4, amount: 2500, percentage: 5 }
    ],
    maxParticipants: 100,
    startDate: new Date('2024-12-20T10:00:00Z'),
    endDate: new Date('2024-12-22T18:00:00Z'),
    registrationDeadline: new Date('2024-12-19T23:59:59Z'),
    status: 'completed', // Completed so we can add scoreboards
    region: 'india',
    rules: 'Standard BGMI battle royale rules. Squad mode (4 players per team). Multiple matches will be played. Points system: Placement points + Kill points. Final ranking based on total points across all matches.',
    createdBy: dummyAdminId,

    roomDetails: {
      bgmi: {
        roomId: 'BGMI2024WIN',
        password: 'winter2024',
        map: 'Erangel',
        mode: 'Squad TPP'
      }
    },

    featured: true,
    tags: ['competitive', 'squad', 'battle-royale'],

    // Add sample scoreboards
    scoreboards: [
      {
        imageUrl: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/bgmi-results-1.jpg?v=1703123456',
        description: 'BGMI Winter Championship 2024 - Final Results',
        uploadedBy: dummyAdminId,
        uploadedAt: new Date('2024-12-22T20:00:00Z'),
        order: 0
      },
      {
        imageUrl: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/bgmi-results-2.jpg?v=1703123457',
        description: 'BGMI Winter Championship 2024 - Match 3 Results',
        uploadedBy: dummyAdminId,
        uploadedAt: new Date('2024-12-22T16:00:00Z'),
        order: 1
      }
    ]
  },
  {
    name: 'BGMI Pro League Season 1',
    description: 'Professional BGMI league with top teams competing',
    gameType: 'bgmi',
    mode: 'squad',
    format: 'battle_royale',
    entryFee: 100,
    prizePool: 100000,
    prizeDistribution: [
      { position: 1, amount: 50000, percentage: 50 },
      { position: 2, amount: 30000, percentage: 30 },
      { position: 3, amount: 15000, percentage: 15 },
      { position: 4, amount: 5000, percentage: 5 }
    ],
    maxParticipants: 64,
    startDate: new Date('2024-12-15T10:00:00Z'),
    endDate: new Date('2024-12-18T18:00:00Z'),
    registrationDeadline: new Date('2024-12-14T23:59:59Z'),
    status: 'completed',
    region: 'india',
    rules: 'Professional BGMI tournament rules. Squad mode only. Multiple rounds with elimination system.',
    createdBy: dummyAdminId,

    roomDetails: {
      bgmi: {
        roomId: 'BGMIPRO2024',
        password: 'proleague',
        map: 'Sanhok',
        mode: 'Squad TPP'
      }
    },

    featured: true,
    tags: ['professional', 'squad', 'league'],

    scoreboards: [
      {
        imageUrl: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/bgmi-pro-results.jpg?v=1703123458',
        description: 'BGMI Pro League Season 1 - Championship Results',
        uploadedBy: dummyAdminId,
        uploadedAt: new Date('2024-12-18T20:00:00Z'),
        order: 0
      }
    ]
  },
  {
    name: 'BGMI Daily Challenge',
    description: 'Quick BGMI matches for daily practice and fun',
    gameType: 'bgmi',
    mode: 'squad',
    format: 'battle_royale',
    entryFee: 25,
    prizePool: 5000,
    prizeDistribution: [
      { position: 1, amount: 2500, percentage: 50 },
      { position: 2, amount: 1500, percentage: 30 },
      { position: 3, amount: 750, percentage: 15 },
      { position: 4, amount: 250, percentage: 5 }
    ],
    maxParticipants: 40,
    startDate: new Date('2024-12-25T14:00:00Z'),
    endDate: new Date('2024-12-25T18:00:00Z'),
    registrationDeadline: new Date('2024-12-25T13:30:00Z'),
    status: 'completed',
    region: 'india',
    rules: 'Casual BGMI tournament. Squad mode. Single elimination format.',
    createdBy: dummyAdminId,

    roomDetails: {
      bgmi: {
        roomId: 'BGMIDAILY25',
        password: 'daily25',
        map: 'Miramar',
        mode: 'Squad TPP'
      }
    },

    featured: false,
    tags: ['casual', 'daily', 'squad'],

    scoreboards: [
      {
        imageUrl: 'https://cdn.shopify.com/s/files/1/0636/5226/6115/files/bgmi-daily-results.jpg?v=1703123459',
        description: 'BGMI Daily Challenge - Results',
        uploadedBy: dummyAdminId,
        uploadedAt: new Date('2024-12-25T19:00:00Z'),
        order: 0
      }
    ]
  }
];

const seedBGMITournaments = async () => {
  try {
    console.log('🌱 Starting BGMI tournaments seeding...');
    
    // Clear existing BGMI tournaments
    await Tournament.deleteMany({ gameType: 'bgmi' });
    console.log('🗑️ Cleared existing BGMI tournaments');
    
    // Insert new BGMI tournaments
    const tournaments = await Tournament.insertMany(bgmiTournamentsData);
    console.log(`✅ Successfully seeded ${tournaments.length} BGMI tournaments`);
    
    tournaments.forEach(tournament => {
      console.log(`🏆 ${tournament.name} - ${tournament.status} - ₹${tournament.prizePool} - ${tournament.scoreboards.length} scoreboards`);
    });
    
    return tournaments;
  } catch (error) {
    console.error('❌ Error seeding BGMI tournaments:', error);
    throw error;
  }
};

module.exports = { seedBGMITournaments, bgmiTournamentsData };
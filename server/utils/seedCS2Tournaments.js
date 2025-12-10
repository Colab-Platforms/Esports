const Tournament = require('../models/Tournament');

// First, let's create a dummy admin user ID for createdBy
const dummyAdminId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

const cs2TournamentsData = [
  {
    name: 'CS2 Winter Championship 2024',
    description: 'Premium Counter-Strike 2 tournament with exciting prizes and competitive gameplay',
    gameType: 'cs2',
    mode: 'team', // Changed from '5v5' to 'team'
    format: 'elimination', // Changed from 'Elimination' to 'elimination'
    entryFee: 0, // Free tournament
    prizePool: 25000,
    prizeDistribution: [
      { position: 1, amount: 12500, percentage: 50 },
      { position: 2, amount: 7500, percentage: 30 },
      { position: 3, amount: 3750, percentage: 15 },
      { position: 4, amount: 1250, percentage: 5 }
    ],
    maxParticipants: 32,
    startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    registrationDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    status: 'active', // CS2 servers are always active
    region: 'mumbai', // Changed from 'India' to 'mumbai'
    rules: 'Standard CS2 competitive rules apply. All matches will be played on official Valve servers. Map pool includes de_dust2, de_mirage, de_inferno, de_cache, de_overpass, de_train, de_nuke. Format: MR12 (First to 13 rounds). Overtime: MR3 (First to 4 rounds in OT). Substitutions allowed before match starts.',
    createdBy: dummyAdminId,

    roomDetails: {
      cs2: {
        serverIp: '103.21.58.132',
        serverPort: '27015',
        password: 'cs2_winter_2024',
        connectCommand: 'steam://connect/103.21.58.132:27015/cs2_winter_2024',
        rconPassword: 'admin_cs2_2024'
      }
    },

    featured: true,
    tags: ['competitive', 'premium', 'steam-required']
  },
  {
    name: 'CS2 Daily Grind Tournament',
    description: 'Quick CS2 matches for daily competitive practice',
    gameType: 'cs2',
    mode: 'team',
    format: 'swiss',
    entryFee: 0, // Free tournament
    prizePool: 2000,
    prizeDistribution: [
      { position: 1, amount: 1000, percentage: 50 },
      { position: 2, amount: 600, percentage: 30 },
      { position: 3, amount: 400, percentage: 20 }
    ],
    maxParticipants: 16,
    startDate: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    endDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    registrationDeadline: new Date(Date.now() + 25 * 60 * 1000), // 25 minutes from now
    status: 'active', // CS2 servers are always active
    region: 'delhi',
    rules: 'Fast-paced CS2 matches with shorter rounds. Map pool: de_dust2, de_mirage, de_inferno. Format: MR9 (First to 10 rounds). No overtime - draw allowed. Substitutions not allowed after match starts.',
    createdBy: dummyAdminId,
    roomDetails: {
      cs2: {
        serverIp: '103.21.58.132',
        serverPort: '27015',
        password: 'cs2_daily_grind',
        connectCommand: 'steam://connect/103.21.58.132:27015/cs2_daily_grind',
        rconPassword: 'admin_daily_2024'
      }
    },
    featured: false,
    tags: ['daily', 'quick', 'practice']
  },
  {
    name: 'CS2 Beginner Friendly Cup',
    description: 'Perfect tournament for new CS2 players to get competitive experience',
    gameType: 'cs2',
    mode: 'team',
    format: 'round_robin',
    entryFee: 0, // Free tournament
    prizePool: 1000,
    prizeDistribution: [
      { position: 1, amount: 500, percentage: 50 },
      { position: 2, amount: 300, percentage: 30 },
      { position: 3, amount: 200, percentage: 20 }
    ],
    maxParticipants: 12,
    startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
    registrationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    status: 'active', // CS2 servers are always active
    region: 'bangalore',
    rules: 'Beginner-friendly rules with coaching allowed. Map pool: de_dust2, de_mirage. Format: MR6 (First to 7 rounds). No overtime. Substitutions allowed with admin approval.',
    createdBy: dummyAdminId,
    roomDetails: {
      cs2: {
        serverIp: '103.21.58.132',
        serverPort: '27015',
        password: 'cs2_beginner_cup',
        connectCommand: 'steam://connect/103.21.58.132:27015/cs2_beginner_cup',
        rconPassword: 'admin_beginner_2024'
      }
    },
    featured: true,
    tags: ['beginner', 'friendly', 'learning']
  },
  {
    name: 'CS2 Pro League Qualifier',
    description: 'High-stakes qualifier for professional CS2 league entry',
    gameType: 'cs2',
    mode: 'team',
    format: 'elimination',
    entryFee: 0, // Free tournament
    prizePool: 50000,
    prizeDistribution: [
      { position: 1, amount: 25000, percentage: 50 },
      { position: 2, amount: 15000, percentage: 30 },
      { position: 3, amount: 7500, percentage: 15 },
      { position: 4, amount: 2500, percentage: 5 }
    ],
    maxParticipants: 64,
    startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    registrationDeadline: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
    status: 'active', // CS2 servers are always active
    region: 'chennai',
    rules: 'Professional CS2 tournament rules. ESL/FACEIT compliant. Map pool: de_dust2, de_mirage, de_inferno, de_cache, de_overpass, de_train, de_nuke, de_vertigo, de_ancient. Format: MR12 (First to 13 rounds). Overtime: MR3 (First to 4 rounds in OT). Roster lock 24 hours before tournament.',
    createdBy: dummyAdminId,
    roomDetails: {
      cs2: {
        serverIp: '103.21.58.132',
        serverPort: '27015',
        password: 'cs2_pro_qualifier',
        connectCommand: 'steam://connect/103.21.58.132:27015/cs2_pro_qualifier',
        rconPassword: 'admin_pro_2024'
      }
    },
    featured: true,
    tags: ['professional', 'qualifier', 'high-stakes']
  }
];

const seedCS2Tournaments = async () => {
  try {
    console.log('🎯 Seeding CS2 tournaments...');
    
    // Remove existing CS2 tournaments
    await Tournament.deleteMany({ gameType: 'cs2' });
    
    // Insert new CS2 tournaments
    const tournaments = await Tournament.insertMany(cs2TournamentsData);
    
    console.log('✅ CS2 tournaments seeded successfully!');
    console.log(`📊 Total CS2 tournaments: ${tournaments.length}`);
    
    tournaments.forEach(tournament => {
      console.log(`🏆 ${tournament.name} - ${tournament.status} - ₹${tournament.prizePool}`);
    });
    
    return tournaments;
    
  } catch (error) {
    console.error('❌ Error seeding CS2 tournaments:', error);
    throw error;
  }
};

module.exports = { seedCS2Tournaments, cs2TournamentsData };
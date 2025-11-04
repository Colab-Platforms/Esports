const mongoose = require('mongoose');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');
const User = require('../models/User');
const { seedGames } = require('./seedGames');
const { seedCS2Tournaments } = require('./seedCS2Tournaments');
const { seedTournamentParticipants } = require('./seedTournamentParticipants');

const seedTournaments = async () => {
  try {
    // Check if tournaments already exist
    const existingTournaments = await Tournament.countDocuments();
    if (existingTournaments > 0) {
      console.log('🎮 Tournaments already exist, skipping seed...');
      return;
    }

    const sampleTournaments = [
      {
        name: 'BGMI Championship 2024',
        description: 'Premium BGMI tournament with exciting prizes',
        gameType: 'bgmi',
        mode: 'squad',
        entryFee: 100,
        prizePool: 10000,
        prizeDistribution: [
          { position: 1, amount: 5000, percentage: 50 },
          { position: 2, amount: 3000, percentage: 30 },
          { position: 3, amount: 2000, percentage: 20 }
        ],
        maxParticipants: 100,
        startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        format: 'battle_royale',
        rules: 'No cheating or hacking allowed. All participants must join the room on time. Screenshots required for result verification.',
        status: 'upcoming',
        createdBy: new mongoose.Types.ObjectId()
      },
      {
        name: 'Valorant Pro League',
        description: 'Competitive Valorant tournament for skilled players',
        gameType: 'valorant',
        mode: 'team',
        entryFee: 200,
        prizePool: 20000,
        prizeDistribution: [
          { position: 1, amount: 10000, percentage: 50 },
          { position: 2, amount: 6000, percentage: 30 },
          { position: 3, amount: 4000, percentage: 20 }
        ],
        maxParticipants: 50,
        startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        format: 'elimination',
        rules: 'Team of 5 players required. No substitutions allowed during matches. Server logs will be monitored.',
        status: 'upcoming',
        createdBy: new mongoose.Types.ObjectId()
      },
      {
        name: 'CS2 Masters Cup',
        description: 'Counter-Strike 2 tournament with professional setup',
        gameType: 'cs2',
        mode: 'team',
        entryFee: 300,
        prizePool: 30000,
        prizeDistribution: [
          { position: 1, amount: 15000, percentage: 50 },
          { position: 2, amount: 9000, percentage: 30 },
          { position: 3, amount: 6000, percentage: 20 }
        ],
        maxParticipants: 32,
        startDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        format: 'elimination',
        rules: 'Professional CS2 setup required. Anti-cheat software mandatory. Server demos will be recorded.',
        status: 'upcoming',
        createdBy: new mongoose.Types.ObjectId()
      }
    ];

    await Tournament.insertMany(sampleTournaments);
    console.log('🎮 Sample tournaments created successfully!');
  } catch (error) {
    console.error('❌ Error seeding tournaments:', error);
  }
};

const seedMatches = async () => {
  try {
    // Check if matches already exist
    const existingMatches = await Match.countDocuments();
    if (existingMatches > 0) {
      console.log('🎯 Matches already exist, skipping seed...');
      return;
    }

    // Get a tournament to create matches for
    const tournament = await Tournament.findOne({ gameType: 'bgmi' });
    if (!tournament) {
      console.log('⚠️ No tournament found for creating sample matches');
      return;
    }

    const sampleMatches = [
      {
        tournamentId: tournament._id,
        roundNumber: 1,
        matchNumber: 1,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        gameType: tournament.gameType,
        participants: [],
        matchSettings: {
          mapName: 'Erangel',
          gameMode: 'Classic',
          maxPlayers: 100,
          matchDuration: 30
        },
        createdBy: new mongoose.Types.ObjectId()
      },
      {
        tournamentId: tournament._id,
        roundNumber: 1,
        matchNumber: 2,
        scheduledAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        gameType: tournament.gameType,
        participants: [],
        matchSettings: {
          mapName: 'Sanhok',
          gameMode: 'Classic',
          maxPlayers: 100,
          matchDuration: 30
        },
        createdBy: new mongoose.Types.ObjectId()
      }
    ];

    const createdMatches = await Match.insertMany(sampleMatches);
    
    // Generate room credentials for each match
    for (const match of createdMatches) {
      await match.generateRoomCredentials();
    }

    console.log('🎯 Sample matches created successfully!');
  } catch (error) {
    console.error('❌ Error seeding matches:', error);
  }
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    await seedGames();
    await seedTournaments();
    await seedCS2Tournaments();
    await seedTournamentParticipants();
    await seedMatches();
    console.log('✅ Database seeding completed!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
  }
};

module.exports = {
  seedDatabase,
  seedTournaments,
  seedMatches,
  seedGames
};
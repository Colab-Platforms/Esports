const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import seed data utility
const { seedDatabase } = require('./utils/seedData');

// Debug environment variables
console.log('🔧 Environment Debug:');
console.log('📍 PORT:', process.env.PORT);
console.log('📍 MONGODB_URI:', process.env.MONGODB_URI ? 'Found' : 'Missing');
console.log('📍 JWT_SECRET:', process.env.JWT_SECRET ? 'Found' : 'Missing');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Trust proxy for rate limiting (required when behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// Dynamic CORS configuration - allows access from any IP on port 3000 and Vercel
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost, any IP address on port 3000, and Vercel domains
    const allowedOrigins = [
      'http://localhost:3000',
      'https://esports-62sh.vercel.app',
      process.env.CLIENT_URL
    ];
    
    // Check if origin matches allowed patterns
    if (allowedOrigins.includes(origin) || 
        origin.match(/^http:\/\/[\d.]+:3000$/) ||
        origin.match(/^https:\/\/.*\.vercel\.app$/)) {
      callback(null, true);
    } else {
      callback(null, true); // For development, allow all origins
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// No-cache middleware for API routes to prevent stale data
const noCache = require('./middleware/noCache');
app.use('/api', noCache);

// Session middleware (required for Steam OAuth)
app.use(session({
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
console.log('🔗 Connecting to MongoDB...');
console.log('📍 MongoDB URI:', process.env.MONGODB_URI ? 'URI found' : 'URI missing');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    console.log('🎮 MongoDB connected successfully');
    console.log('📊 Database name:', mongoose.connection.name);
    
    // Seed database with sample data in development
    if (process.env.NODE_ENV === 'development') {
      await seedDatabase();
    }
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.error('🔍 Check your MongoDB URI and network connection');
  });

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join-tournament', (tournamentId) => {
    socket.join(`tournament-${tournamentId}`);
    console.log(`👤 User ${socket.id} joined tournament ${tournamentId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Security tracking middleware
const { securityTracking, checkBannedUser } = require('./middleware/securityTracking');
app.use(securityTracking);
app.use(checkBannedUser);

// Mock endpoints (must be before other routes)
// Mock tournaments endpoint for BGMI (must be before other tournament routes)
app.get('/api/tournaments/mock', (req, res) => {
  const { gameType = 'bgmi', status, page = 1, limit = 12 } = req.query;
  
  // Generate mock tournament data
  const mockTournaments = [
    {
      _id: 'bgmi_tournament_1',
      name: 'BGMI Championship 2024',
      description: 'Ultimate BGMI tournament with massive prize pool. Join the best players and compete for glory!',
      gameType: 'bgmi',
      mode: 'squad',
      entryFee: 0,
      prizePool: 25000,
      prizeDistribution: [
        { position: 1, amount: 12500, percentage: 50 },
        { position: 2, amount: 7500, percentage: 30 },
        { position: 3, amount: 5000, percentage: 20 }
      ],
      maxParticipants: 100,
      currentParticipants: 75,
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'registration_open',
      rules: 'No cheating allowed. Screenshots required for verification.',
      format: 'battle_royale',
      featured: true,
      bannerImage: '',
      tags: ['competitive', 'squad', 'prize'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_2',
      name: 'Solo Masters Cup',
      description: 'Test your individual skills in this intense solo BGMI tournament.',
      gameType: 'bgmi',
      mode: 'solo',
      entryFee: 0,
      prizePool: 15000,
      prizeDistribution: [
        { position: 1, amount: 7500, percentage: 50 },
        { position: 2, amount: 4500, percentage: 30 },
        { position: 3, amount: 3000, percentage: 20 }
      ],
      maxParticipants: 80,
      currentParticipants: 45,
      startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      status: 'registration_open',
      rules: 'Solo gameplay only. No teaming allowed.',
      format: 'battle_royale',
      featured: false,
      bannerImage: '',
      tags: ['solo', 'competitive'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_3',
      name: 'Duo Domination',
      description: 'Partner up and dominate the battlefield in this exciting duo tournament.',
      gameType: 'bgmi',
      mode: 'duo',
      entryFee: 0,
      prizePool: 20000,
      prizeDistribution: [
        { position: 1, amount: 10000, percentage: 50 },
        { position: 2, amount: 6000, percentage: 30 },
        { position: 3, amount: 4000, percentage: 20 }
      ],
      maxParticipants: 60,
      currentParticipants: 38,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'upcoming',
      rules: 'Duo teams only. Both players must register.',
      format: 'battle_royale',
      featured: true,
      bannerImage: '',
      tags: ['duo', 'teamwork'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_4',
      name: 'Weekly Clash - Live Now!',
      description: 'Join the live tournament happening right now!',
      gameType: 'bgmi',
      mode: 'squad',
      entryFee: 0,
      prizePool: 8000,
      prizeDistribution: [
        { position: 1, amount: 4000, percentage: 50 },
        { position: 2, amount: 2400, percentage: 30 },
        { position: 3, amount: 1600, percentage: 20 }
      ],
      maxParticipants: 40,
      currentParticipants: 40,
      startDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // Started 1 hour ago
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Ends in 2 hours
      registrationDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'active',
      rules: 'Live tournament in progress.',
      format: 'battle_royale',
      featured: false,
      bannerImage: '',
      tags: ['live', 'squad'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_5',
      name: 'Legends Tournament - Completed',
      description: 'Epic tournament that concluded with amazing matches.',
      gameType: 'bgmi',
      mode: 'squad',
      entryFee: 0,
      prizePool: 50000,
      prizeDistribution: [
        { position: 1, amount: 25000, percentage: 50 },
        { position: 2, amount: 15000, percentage: 30 },
        { position: 3, amount: 10000, percentage: 20 }
      ],
      maxParticipants: 120,
      currentParticipants: 120,
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      status: 'completed',
      rules: 'Tournament completed successfully.',
      format: 'battle_royale',
      featured: true,
      bannerImage: '',
      tags: ['completed', 'legends'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  // Filter by status if provided
  let filteredTournaments = mockTournaments;
  if (status) {
    const statusArray = status.split(',');
    filteredTournaments = mockTournaments.filter(t => statusArray.includes(t.status));
  }
  
  // Filter by gameType
  if (gameType && gameType !== 'all') {
    filteredTournaments = filteredTournaments.filter(t => t.gameType === gameType);
  }
  
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedData = filteredTournaments.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      tournaments: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredTournaments.length,
        pages: Math.ceil(filteredTournaments.length / parseInt(limit))
      }
    },
    message: 'Mock tournaments retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/games', require('./routes/games'));
app.use('/api/steam', require('./routes/steam'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/bgmi-matches', require('./routes/bgmiMatches'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/security', require('./routes/security'));
app.use('/api/cs2', require('./routes/cs2Logs'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '🎮 Colab Esports Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// Comprehensive database seeding endpoint
app.post('/api/seed-database', async (req, res) => {
  try {
    const User = require('./models/User');
    const Tournament = require('./models/Tournament');
    const Match = require('./models/Match');
    const Leaderboard = require('./models/Leaderboard');
    const bcrypt = require('bcryptjs');
    
    console.log('🌱 Starting comprehensive database seeding...');
    
    // 1. Create sample users
    const sampleUsers = [
      {
        username: 'ProGamer123',
        email: 'progamer@example.com',
        phone: '9876543210',
        passwordHash: await bcrypt.hash('password123', 12),
        gameIds: {
          bgmi: 'PG123456789',
          valorant: 'ProGamer#123',
          steam: 'STEAM_1:0:123456'
        },
        kycStatus: 'verified',
        isActive: true,
        role: 'user'
      },
      {
        username: 'EliteShooter',
        email: 'elite@example.com',
        phone: '9876543211',
        passwordHash: await bcrypt.hash('password123', 12),
        gameIds: {
          bgmi: 'ES987654321',
          valorant: 'EliteShooter#456',
          steam: 'STEAM_1:0:654321'
        },
        kycStatus: 'verified',
        isActive: true,
        role: 'user'
      },
      {
        username: 'SkillMaster',
        email: 'skill@example.com',
        phone: '9876543212',
        passwordHash: await bcrypt.hash('password123', 12),
        gameIds: {
          bgmi: 'SM555666777',
          valorant: 'SkillMaster#789',
          steam: 'STEAM_1:0:555666'
        },
        kycStatus: 'verified',
        isActive: true,
        role: 'user'
      },
      {
        username: 'GameChamp',
        email: 'champ@example.com',
        phone: '9876543213',
        passwordHash: await bcrypt.hash('password123', 12),
        gameIds: {
          bgmi: 'GC111222333',
          valorant: 'GameChamp#012',
          steam: 'STEAM_1:0:111222'
        },
        kycStatus: 'verified',
        isActive: true,
        role: 'user'
      },
      {
        username: 'TopPlayer',
        email: 'top@example.com',
        phone: '9876543214',
        passwordHash: await bcrypt.hash('password123', 12),
        gameIds: {
          bgmi: 'TP444555666',
          valorant: 'TopPlayer#345',
          steam: 'STEAM_1:0:444555'
        },
        kycStatus: 'verified',
        isActive: true,
        role: 'user'
      },
      {
        username: 'AdminUser',
        email: 'admin@example.com',
        phone: '9876543215',
        passwordHash: await bcrypt.hash('admin123', 12),
        gameIds: {
          bgmi: 'AD999888777',
          valorant: 'AdminUser#999',
          steam: 'STEAM_1:0:999888'
        },
        kycStatus: 'verified',
        isActive: true,
        role: 'admin'
      }
    ];
    
    // Clear existing users and create new ones
    await User.deleteMany({});
    const createdUsers = await User.insertMany(sampleUsers);
    console.log(`✅ Created ${createdUsers.length} users`);
    
    // 2. Create sample tournaments with room/server details
    const sampleTournaments = [
      {
        name: 'BGMI Championship 2024',
        description: 'Ultimate BGMI tournament with massive prize pool. Join the best players and compete for glory! This is the biggest tournament of the year.',
        gameType: 'bgmi',
        mode: 'squad',
        entryFee: 0,
        prizePool: 25000,
        prizeDistribution: [
          { position: 1, amount: 12500, percentage: 50 },
          { position: 2, amount: 7500, percentage: 30 },
          { position: 3, amount: 5000, percentage: 20 }
        ],
        maxParticipants: 100,
        currentParticipants: 4,
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'registration_open',
        rules: 'No cheating or hacking allowed. All participants must join the room on time. Screenshots required for result verification. Fair play is mandatory.',
        format: 'battle_royale',
        featured: true,
        region: 'mumbai',
        roomDetails: {
          bgmi: {
            roomId: 'BG123456',
            password: 'COLAB2024',
            map: 'Erangel',
            perspective: 'TPP',
            mode: 'Squad'
          }
        },
        participants: [],
        createdBy: null // Will be set after user creation
      },
      {
        name: 'Solo Masters Cup',
        description: 'Test your individual skills in this intense solo BGMI tournament. Only the best survive!',
        gameType: 'bgmi',
        mode: 'solo',
        entryFee: 0,
        prizePool: 15000,
        prizeDistribution: [
          { position: 1, amount: 7500, percentage: 50 },
          { position: 2, amount: 4500, percentage: 30 },
          { position: 3, amount: 3000, percentage: 20 }
        ],
        maxParticipants: 80,
        currentParticipants: 3,
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        status: 'registration_open',
        rules: 'Solo gameplay only. No teaming allowed. Screenshots mandatory for verification.',
        format: 'battle_royale',
        featured: false,
        region: 'delhi',
        roomDetails: {
          bgmi: {
            roomId: 'BG789012',
            password: 'SOLO2024',
            map: 'Sanhok',
            perspective: 'TPP',
            mode: 'Solo'
          }
        },
        participants: [],
        createdBy: null
      },
      {
        name: 'CS2 Pro Championship',
        description: 'Professional Counter-Strike 2 tournament with dedicated servers. Compete at the highest level!',
        gameType: 'cs2',
        mode: 'team',
        entryFee: 0,
        prizePool: 50000,
        prizeDistribution: [
          { position: 1, amount: 25000, percentage: 50 },
          { position: 2, amount: 15000, percentage: 30 },
          { position: 3, amount: 10000, percentage: 20 }
        ],
        maxParticipants: 32,
        currentParticipants: 2,
        startDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        status: 'registration_open',
        rules: 'Professional CS2 rules apply. Steam account required. Anti-cheat enabled. Server-side result tracking.',
        format: 'elimination',
        featured: true,
        region: 'mumbai',
        roomDetails: {
          cs2: {
            serverIp: '31.97.229.109',
            serverPort: '27015',
            password: 'ColabEsports#456',
            rconPassword: 'admin123',
            connectCommand: 'steam://connect/31.97.229.109:27015/ColabEsports#456',
            mapPool: ['de_dust2', 'de_mirage', 'de_inferno', 'de_cache']
          }
        },
        participants: [],
        createdBy: null
      },
      {
        name: 'Valorant Pro League',
        description: 'Competitive Valorant tournament for skilled players. Show your tactical prowess!',
        gameType: 'valorant',
        mode: 'team',
        entryFee: 0,
        prizePool: 30000,
        prizeDistribution: [
          { position: 1, amount: 15000, percentage: 50 },
          { position: 2, amount: 9000, percentage: 30 },
          { position: 3, amount: 6000, percentage: 20 }
        ],
        maxParticipants: 50,
        currentParticipants: 2,
        startDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'upcoming',
        rules: 'Team of 5 players required. No substitutions allowed during matches. Server logs will be monitored.',
        format: 'elimination',
        featured: true,
        region: 'bangalore',
        roomDetails: {
          valorant: {
            matchId: 'VAL-2024-001',
            serverRegion: 'Mumbai',
            mapPool: ['Bind', 'Haven', 'Split', 'Ascent']
          }
        },
        participants: [],
        createdBy: null
      },
      {
        name: 'Weekly BGMI Clash - Live',
        description: 'Live tournament happening right now! Join the action!',
        gameType: 'bgmi',
        mode: 'squad',
        entryFee: 0,
        prizePool: 8000,
        prizeDistribution: [
          { position: 1, amount: 4000, percentage: 50 },
          { position: 2, amount: 2400, percentage: 30 },
          { position: 3, amount: 1600, percentage: 20 }
        ],
        maxParticipants: 60,
        currentParticipants: 1,
        startDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // Started 1 hour ago
        endDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Ends in 2 hours
        registrationDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000), // Closed 2 hours ago
        status: 'active',
        rules: 'Live tournament in progress. No new registrations allowed.',
        format: 'battle_royale',
        featured: false,
        region: 'delhi',
        roomDetails: {
          bgmi: {
            roomId: 'LIVE123',
            password: 'LIVE2024',
            map: 'Miramar',
            perspective: 'TPP',
            mode: 'Squad'
          }
        },
        participants: [],
        createdBy: null
      },
      {
        name: 'CS2 Quick Match',
        description: 'Fast-paced CS2 tournament for quick matches. Perfect for practice!',
        gameType: 'cs2',
        mode: 'team',
        entryFee: 0,
        prizePool: 12000,
        prizeDistribution: [
          { position: 1, amount: 6000, percentage: 50 },
          { position: 2, amount: 3600, percentage: 30 },
          { position: 3, amount: 2400, percentage: 20 }
        ],
        maxParticipants: 16,
        currentParticipants: 1,
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        registrationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        status: 'registration_open',
        rules: 'Quick matches with standard CS2 competitive rules. Steam required.',
        format: 'elimination',
        featured: false,
        region: 'bangalore',
        roomDetails: {
          cs2: {
            serverIp: '31.97.229.109',
            serverPort: '27015',
            password: 'ColabEsports#456',
            rconPassword: 'admin456',
            connectCommand: 'steam://connect/31.97.229.109:27015/ColabEsports#456',
            mapPool: ['de_dust2', 'de_mirage']
          }
        },
        participants: [],
        createdBy: null
      }
    ];
    
    // Set admin as creator and add participants
    sampleTournaments.forEach((tournament, index) => {
      tournament.createdBy = createdUsers[5]._id; // Admin user
      tournament.participants = createdUsers.slice(0, tournament.currentParticipants).map(user => ({
        userId: user._id,
        gameId: `${user.gameIds.bgmi || user.gameIds.valorant || user.gameIds.steam || '123456789'}`,
        teamName: tournament.mode === 'solo' ? '' : `Team ${user.username}`,
        registeredAt: new Date(),
        status: 'registered'
      }));
    });
    
    // Clear existing tournaments and create new ones
    await Tournament.deleteMany({});
    const createdTournaments = await Tournament.insertMany(sampleTournaments);
    console.log(`✅ Created ${createdTournaments.length} tournaments`);
    
    // 3. Create leaderboard entries with game-specific stats
    const leaderboardEntries = [];
    const games = ['bgmi', 'valorant', 'cs2'];
    const leaderboardTypes = ['overall', 'monthly', 'weekly'];
    
    createdUsers.forEach((user, userIndex) => {
      games.forEach(gameType => {
        leaderboardTypes.forEach(type => {
          // Game-specific stats
          let stats = {};
          if (gameType === 'bgmi') {
            stats = {
              totalMatches: 45 + userIndex * 5,
              wins: 15 + userIndex * 2,
              kills: 600 + userIndex * 50,
              deaths: 300 + userIndex * 20,
              kdRatio: (600 + userIndex * 50) / (300 + userIndex * 20),
              winRate: ((15 + userIndex * 2) / (45 + userIndex * 5)) * 100,
              averageScore: 2500 + userIndex * 100,
              chickenDinners: 15 + userIndex * 2,
              topTenFinishes: 35 + userIndex * 3
            };
          } else if (gameType === 'valorant') {
            stats = {
              totalMatches: 40 + userIndex * 4,
              wins: 22 + userIndex * 2,
              kills: 450 + userIndex * 40,
              deaths: 280 + userIndex * 15,
              kdRatio: (450 + userIndex * 40) / (280 + userIndex * 15),
              winRate: ((22 + userIndex * 2) / (40 + userIndex * 4)) * 100,
              averageScore: 3200 + userIndex * 150,
              roundsWon: 180 + userIndex * 20,
              headshots: 120 + userIndex * 15
            };
          } else if (gameType === 'cs2') {
            stats = {
              totalMatches: 35 + userIndex * 3,
              wins: 20 + userIndex * 2,
              kills: 400 + userIndex * 35,
              deaths: 250 + userIndex * 12,
              kdRatio: (400 + userIndex * 35) / (250 + userIndex * 12),
              winRate: ((20 + userIndex * 2) / (35 + userIndex * 3)) * 100,
              averageScore: 2800 + userIndex * 120,
              mapsWon: 45 + userIndex * 5,
              mvpCount: 8 + userIndex
            };
          }
          
          leaderboardEntries.push({
            userId: user._id,
            gameType,
            leaderboardType: type,
            rank: userIndex + 1,
            points: 1000 - (userIndex * 50) + Math.floor(Math.random() * 100),
            stats,
            rankChange: userIndex === 0 ? 'same' : (Math.random() > 0.5 ? 'up' : 'down'),
            lastUpdated: new Date()
          });
        });
      });
    });
    
    // Clear existing leaderboard and create new entries
    await Leaderboard.deleteMany({});
    const createdLeaderboard = await Leaderboard.insertMany(leaderboardEntries);
    console.log(`✅ Created ${createdLeaderboard.length} leaderboard entries`);
    
    // 4. Create CS2 game servers
    const GameServer = require('./models/GameServer');
    const sampleServers = [
      {
        name: 'Mumbai CS2 Server #1',
        gameType: 'cs2',
        serverDetails: {
          ip: '103.21.58.132',
          port: '27015',
          password: '',
          rconPassword: 'admin123'
        },
        region: 'mumbai',
        maxPlayers: 10,
        currentPlayers: 0,
        status: 'online',
        steamRequired: true,
        serverConfig: {
          tickRate: 128,
          gameMode: 'competitive',
          mapPool: ['de_dust2', 'de_mirage', 'de_inferno'],
          roundTime: 115,
          freezeTime: 15
        },
        performance: {
          averagePing: 25,
          uptime: 99.8
        },
        createdBy: createdUsers[5]._id
      },
      {
        name: 'Delhi CS2 Server #1',
        gameType: 'cs2',
        serverDetails: {
          ip: '103.21.58.133',
          port: '27015',
          password: '',
          rconPassword: 'admin123'
        },
        region: 'delhi',
        maxPlayers: 10,
        currentPlayers: 2,
        status: 'online',
        steamRequired: true,
        serverConfig: {
          tickRate: 128,
          gameMode: 'competitive',
          mapPool: ['de_cache', 'de_overpass', 'de_train'],
          roundTime: 115,
          freezeTime: 15
        },
        performance: {
          averagePing: 30,
          uptime: 99.5
        },
        createdBy: createdUsers[5]._id
      },
      {
        name: 'Bangalore CS2 Server #1',
        gameType: 'cs2',
        serverDetails: {
          ip: '103.21.58.134',
          port: '27015',
          password: 'tournament123',
          rconPassword: 'admin123'
        },
        region: 'bangalore',
        maxPlayers: 10,
        currentPlayers: 8,
        status: 'online',
        steamRequired: true,
        serverConfig: {
          tickRate: 128,
          gameMode: 'competitive',
          mapPool: ['de_dust2', 'de_mirage'],
          roundTime: 115,
          freezeTime: 15
        },
        performance: {
          averagePing: 35,
          uptime: 99.9
        },
        createdBy: createdUsers[5]._id
      }
    ];
    
    await GameServer.deleteMany({});
    const createdServers = await GameServer.insertMany(sampleServers);
    console.log(`✅ Created ${createdServers.length} game servers`);
    
    // All data already created above - no duplicates needed
    
    res.json({
      success: true,
      data: {
        users: createdUsers.length,
        tournaments: createdTournaments.length,
        leaderboardEntries: createdLeaderboard.length,
        gameServers: createdServers.length,
        message: 'Database seeded successfully with comprehensive data'
      },
      message: 'Complete database seeding completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Database seeding error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_SEEDING_FAILED',
        message: 'Failed to seed database',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Test endpoint for match system
app.get('/api/test/matches', async (req, res) => {
  try {
    const Match = require('./models/Match');
    const Tournament = require('./models/Tournament');
    
    const matchCount = await Match.countDocuments();
    const tournamentCount = await Tournament.countDocuments();
    
    res.json({
      success: true,
      data: {
        matches: matchCount,
        tournaments: tournamentCount,
        message: 'Match system is working properly'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'TEST_FAILED',
        message: 'Match system test failed',
        details: error.message
      }
    });
  }
});

// Mock tournaments endpoint for BGMI (must be before other tournament routes)
app.get('/api/tournaments/mock', (req, res) => {
  const { gameType = 'bgmi', status, page = 1, limit = 12 } = req.query;
  
  // Generate mock tournament data
  const mockTournaments = [
    {
      _id: 'bgmi_tournament_1',
      name: 'BGMI Championship 2024',
      description: 'Ultimate BGMI tournament with massive prize pool. Join the best players and compete for glory!',
      gameType: 'bgmi',
      mode: 'squad',
      entryFee: 0,
      prizePool: 25000,
      prizeDistribution: [
        { position: 1, amount: 12500, percentage: 50 },
        { position: 2, amount: 7500, percentage: 30 },
        { position: 3, amount: 5000, percentage: 20 }
      ],
      maxParticipants: 100,
      currentParticipants: 75,
      startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'registration_open',
      rules: 'No cheating allowed. Screenshots required for verification.',
      format: 'battle_royale',
      featured: true,
      bannerImage: '',
      tags: ['competitive', 'squad', 'prize'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_2',
      name: 'Solo Masters Cup',
      description: 'Test your individual skills in this intense solo BGMI tournament.',
      gameType: 'bgmi',
      mode: 'solo',
      entryFee: 0,
      prizePool: 15000,
      prizeDistribution: [
        { position: 1, amount: 7500, percentage: 50 },
        { position: 2, amount: 4500, percentage: 30 },
        { position: 3, amount: 3000, percentage: 20 }
      ],
      maxParticipants: 80,
      currentParticipants: 45,
      startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      status: 'registration_open',
      rules: 'Solo gameplay only. No teaming allowed.',
      format: 'battle_royale',
      featured: false,
      bannerImage: '',
      tags: ['solo', 'competitive'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_3',
      name: 'Duo Domination',
      description: 'Partner up and dominate the battlefield in this exciting duo tournament.',
      gameType: 'bgmi',
      mode: 'duo',
      entryFee: 0,
      prizePool: 20000,
      prizeDistribution: [
        { position: 1, amount: 10000, percentage: 50 },
        { position: 2, amount: 6000, percentage: 30 },
        { position: 3, amount: 4000, percentage: 20 }
      ],
      maxParticipants: 60,
      currentParticipants: 38,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'upcoming',
      rules: 'Duo teams only. Both players must register.',
      format: 'battle_royale',
      featured: true,
      bannerImage: '',
      tags: ['duo', 'teamwork'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_4',
      name: 'Weekly Clash - Live Now!',
      description: 'Join the live tournament happening right now!',
      gameType: 'bgmi',
      mode: 'squad',
      entryFee: 0,
      prizePool: 8000,
      prizeDistribution: [
        { position: 1, amount: 4000, percentage: 50 },
        { position: 2, amount: 2400, percentage: 30 },
        { position: 3, amount: 1600, percentage: 20 }
      ],
      maxParticipants: 40,
      currentParticipants: 40,
      startDate: new Date(Date.now() - 1 * 60 * 60 * 1000), // Started 1 hour ago
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Ends in 2 hours
      registrationDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'active',
      rules: 'Live tournament in progress.',
      format: 'battle_royale',
      featured: false,
      bannerImage: '',
      tags: ['live', 'squad'],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: 'bgmi_tournament_5',
      name: 'Legends Tournament - Completed',
      description: 'Epic tournament that concluded with amazing matches.',
      gameType: 'bgmi',
      mode: 'squad',
      entryFee: 0,
      prizePool: 50000,
      prizeDistribution: [
        { position: 1, amount: 25000, percentage: 50 },
        { position: 2, amount: 15000, percentage: 30 },
        { position: 3, amount: 10000, percentage: 20 }
      ],
      maxParticipants: 120,
      currentParticipants: 120,
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      status: 'completed',
      rules: 'Tournament completed successfully.',
      format: 'battle_royale',
      featured: true,
      bannerImage: '',
      tags: ['completed', 'legends'],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  // Filter by status if provided
  let filteredTournaments = mockTournaments;
  if (status) {
    const statusArray = status.split(',');
    filteredTournaments = mockTournaments.filter(t => statusArray.includes(t.status));
  }
  
  // Filter by gameType
  if (gameType && gameType !== 'all') {
    filteredTournaments = filteredTournaments.filter(t => t.gameType === gameType);
  }
  
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedData = filteredTournaments.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      tournaments: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredTournaments.length,
        pages: Math.ceil(filteredTournaments.length / parseInt(limit))
      }
    },
    message: 'Mock tournaments retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// Mock leaderboard endpoint for testing (when MongoDB is not available)
app.get('/api/leaderboard/mock', (req, res) => {
  const { gameType = 'bgmi', leaderboardType = 'overall', page = 1, limit = 50 } = req.query;
  
  // Generate mock leaderboard data
  const mockLeaderboard = Array.from({ length: 20 }, (_, index) => ({
    _id: `mock_${index + 1}`,
    userId: {
      _id: `user_${index + 1}`,
      username: `Player${index + 1}`,
      avatarUrl: null
    },
    gameType,
    leaderboardType,
    rank: index + 1,
    previousRank: index + 1 + Math.floor(Math.random() * 3) - 1,
    rankChange: ['up', 'down', 'same', 'new'][Math.floor(Math.random() * 4)],
    points: 5000 - (index * 200) + Math.floor(Math.random() * 100),
    stats: {
      totalMatches: 50 - (index * 2) + Math.floor(Math.random() * 10),
      matchesWon: 25 - index + Math.floor(Math.random() * 5),
      matchesLost: 25 - index + Math.floor(Math.random() * 5),
      totalKills: 500 - (index * 20) + Math.floor(Math.random() * 50),
      totalDeaths: 200 - (index * 8) + Math.floor(Math.random() * 20),
      totalAssists: 150 - (index * 6) + Math.floor(Math.random() * 15),
      kdRatio: (500 - (index * 20)) / (200 - (index * 8)) || 1,
      averageScore: 800 - (index * 30) + Math.floor(Math.random() * 50),
      winRate: ((25 - index) / (50 - (index * 2))) * 100 || 50,
      chickenDinners: Math.max(0, 10 - index),
      top5Finishes: Math.max(0, 20 - (index * 2)),
      top10Finishes: Math.max(0, 30 - (index * 3))
    },
    lastUpdated: new Date()
  }));
  
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedData = mockLeaderboard.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      leaderboard: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mockLeaderboard.length,
        pages: Math.ceil(mockLeaderboard.length / parseInt(limit))
      }
    },
    message: 'Mock leaderboard data retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// Mock top performers endpoint
app.get('/api/leaderboard/top-performers/mock', (req, res) => {
  const { gameType = 'bgmi', leaderboardType = 'overall', limit = 10 } = req.query;
  
  const mockTopPerformers = Array.from({ length: parseInt(limit) }, (_, index) => ({
    rank: index + 1,
    user: {
      _id: `user_${index + 1}`,
      username: `TopPlayer${index + 1}`,
      avatarUrl: null
    },
    stats: {
      totalMatches: 100 - (index * 5),
      winRate: 80 - (index * 3),
      kdRatio: 3.5 - (index * 0.2),
      averageScore: 1000 - (index * 50)
    },
    points: 8000 - (index * 300),
    rankChange: ['up', 'down', 'same', 'new'][Math.floor(Math.random() * 4)]
  }));
  
  res.json({
    success: true,
    data: {
      topPerformers: mockTopPerformers
    },
    message: 'Mock top performers retrieved successfully',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on our end. Please try again.',
      timestamp: new Date().toISOString()
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'API endpoint not found',
      timestamp: new Date().toISOString()
    }
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🎮 Colab Esports Platform API ready!`);
});

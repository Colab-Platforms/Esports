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
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:3000',
        'https://esports-62sh.vercel.app',
        'https://esports-eciq.vercel.app',
        process.env.CLIENT_URL
      ];
      
      // Allow all Vercel domains and localhost
      if (allowedOrigins.includes(origin) || 
          origin.match(/^http:\/\/[\d.]+:3000$/) ||
          origin.match(/^https:\/\/.*\.vercel\.app$/)) {
        callback(null, true);
      } else {
        callback(null, true); // For development, allow all
      }
    },
    methods: ["GET", "POST"],
    credentials: true
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




// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
});

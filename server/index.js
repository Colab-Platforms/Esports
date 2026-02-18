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
const compression = require('compression');

// Disable all console output globally
require('./config/console');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Seed data utility removed - use admin panel to create tournaments and games

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://192.168.1.109:3000',
        'http://localhost:3000',
        'https://esports-62sh.vercel.app',
        'https://esports-eciq.vercel.app',
        'https://www.colabesports.in',
        'https://colabesports.in',
        process.env.CLIENT_URL
      ];
      
      // Allow all Vercel domains, localhost, and production domains
      if (allowedOrigins.includes(origin) || 
          origin.match(/^http:\/\/[\d.]+:3000$/) ||
          origin.match(/^https:\/\/.*\.vercel\.app$/) ||
          origin.match(/^https:\/\/.*\.colabesports\.in$/)) {
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
app.use(helmet({
  crossOriginOpenerPolicy: false, // Disable COOP for OAuth compatibility
}));

// Custom headers middleware for cache control and security
const headersMiddleware = require('./middleware/headers');
app.use(headersMiddleware);

// Dynamic CORS configuration - allows access from any IP on port 3000 and Vercel
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost, any IP address on port 3000, Vercel domains, and production domain
    const allowedOrigins = [
      'http://localhost:3000',
      'https://esports-62sh.vercel.app',
      'https://esports-eciq.vercel.app',
      'https://www.colabesports.in',
      'https://colabesports.in',
      process.env.CLIENT_URL
    ];
    
    // Check if origin matches allowed patterns
    if (allowedOrigins.includes(origin) || 
        origin.match(/^http:\/\/[\d.]+:3000$/) ||
        origin.match(/^https:\/\/.*\.vercel\.app$/) ||
        origin.match(/^https:\/\/.*\.colabesports\.in$/)) {
      callback(null, true);
    } else {
      callback(null, true); // For development, allow all origins
    }
  },
  credentials: true
}));

// Rate limiting - More relaxed for development/testing
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per 15 minutes (increased from 500)
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Skip rate limiting for admin users in development
  skip: (req) => {
    // Skip rate limiting for admin panel in development
    if (process.env.NODE_ENV === 'development' && req.path.includes('/admin')) {
      return true;
    }
    return false;
  }
});

// More relaxed rate limiter for OAuth routes
const oauthLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // limit each IP to 50 OAuth requests per 5 minutes
  message: {
    success: false,
    error: {
      code: 'OAUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again in a few minutes.',
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting in development for easier testing
    return process.env.NODE_ENV === 'development';
  }
});

app.use('/api/', limiter);
app.use('/api/auth/google', oauthLimiter);
app.use('/api/auth/steam', oauthLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware with Brotli support
app.use(compression({
  level: 6,
  threshold: 1024,
  brotli: {
    lgwin: 22
  },
  filter: (req, res) => {
    if (req.path.includes('/uploads/')) {
      return false;
    }
    return true;
  }
}));

// Response sanitization middleware (hide sensitive data in production)
// DISABLED FOR NOW - causing performance issues
// const sanitizeResponse = require('./middleware/sanitizeResponse');
// app.use(sanitizeResponse);

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

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/colab-esports', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 45000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    console.log('📍 MongoDB URI:', process.env.MONGODB_URI ? 'Using env variable' : 'Using default localhost');
    
    // Test database connection by checking collections
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 Available collections:', collections.map(c => c.name).join(', '));
    
    // Check games collection
    const gamesCount = await mongoose.connection.collection('games').countDocuments();
    console.log(`🎮 Games in database: ${gamesCount}`);
    
    // Check tournaments collection
    const tournamentsCount = await mongoose.connection.collection('tournaments').countDocuments();
    console.log(`🏆 Tournaments in database: ${tournamentsCount}`);
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('🔍 MongoDB URI:', process.env.MONGODB_URI || 'Using default localhost');
    console.error('🔍 Check your MongoDB URI and network connection');
    console.error('🔍 Full error:', err);
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
app.use('/api/users', require('./routes/users'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/challenges', require('./routes/challenges'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/bgmi-matches', require('./routes/bgmiMatches'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/security', require('./routes/security'));
app.use('/api/cs2', require('./routes/cs2Logs'));
app.use('/api/cs2-leaderboard', require('./routes/cs2Leaderboard'));
app.use('/api/cs2-server', require('./routes/cs2ServerStatus'));
app.use('/api/admin', require('./routes/updateCS2Status'));
app.use('/api/site-images', require('./routes/siteImages'));
console.log('🔄 Loading BGMI Registration routes...');
try {
  // Check if file exists
  const fs = require('fs');
  const path = require('path');
  const routePath = path.join(__dirname, 'routes', 'bgmiRegistration.js');
  console.log('📁 Checking route file:', routePath);
  console.log('📁 File exists:', fs.existsSync(routePath));
  
  const bgmiRoutes = require('./routes/bgmiRegistration');
  app.use('/api/bgmi-registration', bgmiRoutes);
} catch (error) {
  console.error('❌ Failed to load BGMI Registration routes:', error);
  console.error('❌ Error details:', error.message);
  console.error('❌ Error stack:', error.stack);
}
app.use('/api/bgmi-images', require('./routes/bgmiImageUpload'));

console.log('🔄 Loading Free Fire Registration routes...');
try {
  const freeFireRoutes = require('./routes/freeFireRegistration');
  app.use('/api/freefire-registration', freeFireRoutes);
  console.log('✅ Free Fire Registration routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load Free Fire Registration routes:', error);
  console.error('❌ Error details:', error.message);
}
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/debug', require('./routes/debug'));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/testimonials', require('./routes/testimonials'));

// Upload route with Cloudinary (required)
try {
  // Check if Cloudinary is configured
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    const uploadRoute = require('./routes/upload');
    app.use('/api/upload', uploadRoute);
  } else {
    console.error('❌ Cloudinary not configured - Image uploads will fail!');
    console.error('📝 Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env');
  }
} catch (error) {
  console.error('❌ Cloudinary upload route failed:', error.message);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '🎮 Colab Esports Platform API is running',
    timestamp: new Date().toISOString()
  });
});

// WhatsApp service debug endpoint
app.get('/api/whatsapp/debug', (req, res) => {
  const whatsappService = require('./services/whatsappService');
  res.json({
    success: true,
    whatsappConfig: {
      hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      hasAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'Set' : 'Missing',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN ? 'Set (length: ' + process.env.WHATSAPP_ACCESS_TOKEN.length + ')' : 'Missing',
      baseURL: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v24.0'
    },
    timestamp: new Date().toISOString()
  });
});

// BGMI update debug endpoint
app.put('/api/bgmi-registration/debug/:registrationId', async (req, res) => {
  try {
    console.log('🧪 DEBUG: Update route hit');
    console.log('🧪 Registration ID:', req.params.registrationId);
    console.log('🧪 Request body:', JSON.stringify(req.body, null, 2));
    console.log('🧪 Headers:', req.headers.authorization ? 'Auth present' : 'No auth');
    
    res.json({
      success: true,
      message: 'Debug endpoint working',
      receivedData: {
        registrationId: req.params.registrationId,
        bodyKeys: Object.keys(req.body),
        hasAuth: !!req.headers.authorization
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// WhatsApp send message endpoint for admin chat
app.post('/api/whatsapp/send-message', async (req, res) => {
  try {
    const { phoneNumber, message, registrationId } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    console.log('📱 Admin sending WhatsApp message:', {
      phoneNumber,
      messageLength: message.length,
      registrationId
    });

    const whatsappService = require('./services/whatsappService');
    const result = await whatsappService.sendTextMessage(phoneNumber, message);

    if (result.success) {
      
      // Optionally save message to database for chat history
      if (registrationId) {
        try {
          const WhatsAppMessage = require('./models/WhatsAppMessage');
          await WhatsAppMessage.create({
            registrationId,
            phoneNumber,
            messageType: 'admin_chat',
            templateName: null,
            messageContent: message,
            status: 'sent',
            messageId: result.messageId,
            sentAt: new Date()
          });
        } catch (dbError) {
          console.error('❌ Failed to save admin message to database:', dbError);
          // Don't fail the API call if database save fails
        }
      }

      res.json({
        success: true,
        messageId: result.messageId,
        message: 'Message sent successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ Admin WhatsApp message failed:', result.error);
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send message',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ Admin WhatsApp send error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
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

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'working perfectly',
    timestamp: new Date().toISOString()
  });
});


// Import tournament schedulers
const tournamentScheduler = require('./utils/tournamentScheduler');

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  
  // Start tournament status scheduler
  tournamentScheduler.start();
});

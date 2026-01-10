const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const WalletService = require('../services/walletService');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/tournaments
// @desc    Get all tournaments with filtering
// @access  Public
router.get('/', [
  query('gameType').optional().isIn(['bgmi', 'valorant', 'cs2']),
  query('status').optional().custom((value) => {
    if (typeof value === 'string') {
      const statuses = value.split(',');
      // All possible statuses (CS2 uses only 'active'/'inactive', others use full set)
      const validStatuses = ['upcoming', 'registration_open', 'registration_closed', 'active', 'completed', 'cancelled', 'inactive'];
      return statuses.every(status => validStatuses.includes(status.trim()));
    }
    return ['upcoming', 'registration_open', 'registration_closed', 'active', 'completed', 'cancelled', 'inactive'].includes(value);
  }),
  query('mode').optional().isIn(['solo', 'duo', 'squad', 'team']),
  query('entryFeeMin').optional().isNumeric(),
  query('entryFeeMax').optional().isNumeric(),
  query('prizePoolMin').optional().isNumeric(),
  query('prizePoolMax').optional().isNumeric(),
  query('featured').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  // Disable caching for admin requests (check for admin query param or authorization)
  // For public requests, use 5 minute cache
  const isAdminRequest = req.query.admin === 'true' || req.headers.authorization;
  
  if (isAdminRequest) {
    // No cache for admin requests - always get fresh data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  } else {
    // Cache for 5 minutes for public requests
    res.set({
      'Cache-Control': 'public, max-age=300',
      'ETag': `tournaments-${Date.now()}`
    });
  }
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const {
      gameType,
      status,
      mode,
      entryFeeMin,
      entryFeeMax,
      prizePoolMin,
      prizePoolMax,
      featured,
      page = 1,
      limit = 20
    } = req.query;

    const filters = {};
    if (gameType) filters.gameType = gameType;
    if (status) {
      // Handle multiple status values separated by comma
      if (typeof status === 'string' && status.includes(',')) {
        filters.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filters.status = status;
      }
    }
    if (mode) filters.mode = mode;
    if (entryFeeMin) filters.entryFeeMin = parseFloat(entryFeeMin);
    if (entryFeeMax) filters.entryFeeMax = parseFloat(entryFeeMax);
    if (prizePoolMin) filters.prizePoolMin = parseFloat(prizePoolMin);
    if (prizePoolMax) filters.prizePoolMax = parseFloat(prizePoolMax);
    if (featured !== undefined) filters.featured = featured === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔍 Tournaments API Query:');
    console.log('  Filters:', JSON.stringify(filters));
    console.log('  Page:', page, 'Limit:', limit, 'Skip:', skip);

    // Optimize query with lean() for better performance and select only needed fields
    const tournaments = await Tournament.getFilteredTournaments(filters)
      .select('-participants -matches -moderators -scoreboards') // Exclude heavy fields
      .lean() // Return plain objects for better performance
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tournament.countDocuments(
      Tournament.getFilteredTournaments(filters).getQuery()
    );

    console.log(`✅ Tournaments found: ${tournaments.length} out of ${total} total`);
    console.log('📝 Tournament IDs:', tournaments.map(t => ({ id: t._id, name: t.name })));
    console.log('📊 Response will include:', {
      tournamentsCount: tournaments.length,
      totalCount: total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });

    res.json({
      success: true,
      data: {
        tournaments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tournament fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_FETCH_FAILED',
        message: 'Failed to fetch tournaments',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/stats
// @desc    Get platform statistics for hero slider
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeTournaments,
      completedTournaments,
      totalPrizePool,
      totalTransactions
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Tournament.countDocuments({ 
        status: { $in: ['registration_open', 'active'] } 
      }),
      Tournament.countDocuments({ status: 'completed' }),
      Tournament.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$prizePool' } } }
      ]),
      require('../models/Transaction').countDocuments({ status: 'completed' })
    ]);

    const totalPrizes = totalPrizePool[0]?.total || 0;

    // Format numbers for display
    const formatNumber = (num) => {
      if (num >= 100000) return `${Math.floor(num / 1000)}K+`;
      if (num >= 1000) return `${Math.floor(num / 1000)}K+`;
      return `${num}+`;
    };

    const formatCurrency = (amount) => {
      if (amount >= 100000) return `₹${Math.floor(amount / 100000)}L+`;
      if (amount >= 1000) return `₹${Math.floor(amount / 1000)}K+`;
      return `₹${amount}+`;
    };

    res.json({
      success: true,
      data: {
        totalPlayers: formatNumber(totalUsers),
        activeTournaments: activeTournaments.toString(),
        completedTournaments: completedTournaments.toString(),
        totalPrizes: formatCurrency(totalPrizes),
        totalTransactions: formatNumber(totalTransactions),
        rawStats: {
          totalUsers,
          activeTournaments,
          completedTournaments,
          totalPrizes,
          totalTransactions
        }
      },
      message: 'Platform statistics retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: 'Failed to retrieve platform statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/:id/eligible-teams
// @desc    Get user's eligible teams for tournament registration
// @access  Private
router.get('/:id/eligible-teams', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Only for BGMI tournaments
    if (tournament.gameType !== 'bgmi') {
      return res.json({
        success: true,
        data: { teams: [] },
        message: 'Team registration not available for this game type',
        timestamp: new Date().toISOString()
      });
    }

    const Team = require('../models/Team');
    const User = require('../models/User');

    // Get user's BGMI teams
    const teams = await Team.find({
      'members.userId': req.user.userId,
      game: 'bgmi',
      isActive: true
    })
      .populate('captain', 'username avatarUrl gameIds')
      .populate('members.userId', 'username avatarUrl gameIds isActive');

    // Filter and validate teams
    const eligibleTeams = [];
    
    for (const team of teams) {
      const teamInfo = {
        _id: team._id,
        name: team.name,
        tag: team.tag,
        logo: team.logo,
        memberCount: team.members.length,
        isEligible: true,
        issues: []
      };

      // Check team size
      if (team.members.length !== 4) {
        teamInfo.isEligible = false;
        teamInfo.issues.push(`Team needs exactly 4 members (currently has ${team.members.length})`);
      }

      // Check if all members have BGMI IDs and are active
      const memberDetails = [];
      for (const member of team.members) {
        const user = member.userId;
        const memberInfo = {
          userId: user._id,
          username: user.username,
          avatarUrl: user.avatarUrl,
          role: member.role,
          hasGameId: !!user.gameIds?.bgmi,
          isActive: user.isActive,
          gameId: user.gameIds?.bgmi || null
        };

        if (!user.isActive) {
          teamInfo.isEligible = false;
          teamInfo.issues.push(`${user.username} is not active on platform`);
        }

        if (!user.gameIds?.bgmi) {
          teamInfo.isEligible = false;
          teamInfo.issues.push(`${user.username} doesn't have BGMI ID registered`);
        }

        memberDetails.push(memberInfo);
      }

      teamInfo.members = memberDetails;
      eligibleTeams.push(teamInfo);
    }

    res.json({
      success: true,
      data: { 
        teams: eligibleTeams,
        tournament: {
          id: tournament._id,
          name: tournament.name,
          gameType: tournament.gameType
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching eligible teams:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TEAMS_FAILED',
        message: 'Failed to fetch eligible teams',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/:id
// @desc    Get tournament by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    // First fetch tournament without populate to check registration
    const tournament = await Tournament.findById(req.params.id);

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is registered (BEFORE populate)
    let isUserRegistered = false;
    let roomDetails = null;
    
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        console.log('🔍 Checking registration for user:', decoded.userId);
        
        isUserRegistered = tournament.isUserRegistered(decoded.userId);
        console.log('✅ Is user registered:', isUserRegistered);
        
        // Include room details only if user is registered
        if (isUserRegistered) {
          roomDetails = tournament.roomDetails;
        }
      } catch (err) {
        console.error('❌ Token verification error:', err.message);
        // Token invalid, continue without auth
      }
    }
    
    // Now populate for response
    await tournament.populate('createdBy', 'username avatarUrl level');
    await tournament.populate('participants.userId', 'username avatarUrl level currentRank');

    res.json({
      success: true,
      data: { 
        tournament,
        isUserRegistered,
        roomDetails
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tournament fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_FETCH_FAILED',
        message: 'Failed to fetch tournament details',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/tournaments
// @desc    Create a new tournament (Admin only)
// @access  Private (Admin)
router.post('/', auth, [
  body('name')
    .isLength({ min: 3, max: 100 })
    .withMessage('Tournament name must be 3-100 characters'),
  body('gameType')
    .isIn(['bgmi', 'valorant', 'cs2'])
    .withMessage('Invalid game type'),
  // Description - Optional for CS2
  body('description')
    .optional()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be 10-1000 characters'),
  // Mode - Optional for CS2
  body('mode')
    .optional()
    .isIn(['solo', 'duo', 'squad', 'team'])
    .withMessage('Invalid tournament mode'),
  body('entryFee')
    .isNumeric()
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Entry fee must be between 0 and 10000'),
  body('prizePool')
    .if(body('gameType').not().equals('cs2'))
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Prize pool must be a positive number'),
  body('maxParticipants')
    .isInt({ min: 2, max: 1000 })
    .withMessage('Max participants must be between 2 and 1000'),
  // Dates - Optional for CS2
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('registrationDeadline')
    .optional()
    .isISO8601()
    .withMessage('Invalid registration deadline format'),
  // Rules - Completely optional (no validation)
  body('rules')
    .optional({ checkFalsy: true }),
  // Format - Optional for CS2
  body('format')
    .optional()
    .isIn(['elimination', 'round_robin', 'swiss', 'battle_royale'])
    .withMessage('Invalid tournament format'),
  // CS2 Server Details - Only validate if gameType is cs2
  body('roomDetails.cs2.serverName')
    .if(body('gameType').equals('cs2'))
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Server name must be 1-100 characters'),
  body('roomDetails.cs2.serverIp')
    .if(body('gameType').equals('cs2'))
    .optional()
    .isString()
    .withMessage('Server IP must be a valid string'),
  body('roomDetails.cs2.serverPort')
    .if(body('gameType').equals('cs2'))
    .optional()
    .isString()
    .withMessage('Server port must be a valid string'),
  body('roomDetails.cs2.gameMode')
    .if(body('gameType').equals('cs2'))
    .optional()
    .isIn(['casual', 'competitive', 'deathmatch', 'arms_race', 'demolition', 'wingman'])
    .withMessage('Invalid CS2 game mode')
], async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required to create tournaments',
          timestamp: new Date().toISOString()
        }
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const tournamentData = {
      ...req.body,
      createdBy: req.user.userId
    };
    
    // Set appropriate default status based on game type
    if (!tournamentData.status) {
      tournamentData.status = req.body.gameType === 'cs2' ? 'active' : 'upcoming';
    }
    
    // Set default values for CS2 tournaments
    if (req.body.gameType === 'cs2') {
      // Set default mode if not provided
      if (!tournamentData.mode) {
        tournamentData.mode = 'team';
      }
      
      // Set default format if not provided
      if (!tournamentData.format) {
        tournamentData.format = 'elimination';
      }
      
      // CS2 tournaments have no prize pool (just server access)
      tournamentData.prizePool = 0;
      
      // Set default dates if not provided (CS2 tournaments are always active)
      const now = new Date();
      if (!tournamentData.startDate) {
        tournamentData.startDate = now;
      }
      if (!tournamentData.endDate) {
        tournamentData.endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      }
      if (!tournamentData.registrationDeadline) {
        tournamentData.registrationDeadline = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000); // 29 days from now
      }
      
      // Set default room details if not provided
      if (!tournamentData.roomDetails) {
        tournamentData.roomDetails = {};
      }
      if (!tournamentData.roomDetails.cs2) {
        tournamentData.roomDetails.cs2 = {
          serverIp: '103.21.58.132',
          serverPort: '27015',
          serverName: tournamentData.name || 'CS2 Server',
          password: '',
          connectCommand: '',
          mapPool: ['de_dust2']
        };
      }
      
      // Set default rules if not provided
      if (!tournamentData.rules) {
        tournamentData.rules = 'Free CS2 server access for competitive play. Server details will be provided after joining.';
      }
    }

    // Set default prize distribution if not provided (skip for CS2)
    if (tournamentData.gameType !== 'cs2' && (!tournamentData.prizeDistribution || tournamentData.prizeDistribution.length === 0)) {
      tournamentData.prizeDistribution = [
        { position: 1, amount: tournamentData.prizePool * 0.5, percentage: 50 },
        { position: 2, amount: tournamentData.prizePool * 0.3, percentage: 30 },
        { position: 3, amount: tournamentData.prizePool * 0.2, percentage: 20 }
      ];
    } else if (tournamentData.gameType === 'cs2') {
      // CS2 tournaments don't have prize distribution
      tournamentData.prizeDistribution = [];
    }

    const tournament = new Tournament(tournamentData);
    await tournament.save();

    await tournament.populate('createdBy', 'username avatarUrl');

    res.status(201).json({
      success: true,
      data: { tournament },
      message: '🏆 Tournament created successfully!',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tournament creation error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle specific MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tournament validation failed',
          details: validationErrors,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_TOURNAMENT',
          message: 'A tournament with this name already exists',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_CREATION_FAILED',
        message: 'Failed to create tournament',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/tournaments/:id
// @desc    Update a tournament (Admin only)
// @access  Private (Admin)
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('🔍 Updating tournament ID:', req.params.id);
    console.log('📝 Request body keys:', Object.keys(req.body));
    console.log('📝 Full request body:', JSON.stringify(req.body, null, 2));
    
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      console.log('❌ User is not admin/moderator. Role:', user?.role);
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required to update tournaments',
          timestamp: new Date().toISOString()
        }
      });
    }

    const tournament = await Tournament.findById(req.params.id);
    console.log('📊 Tournament found:', tournament ? 'Yes' : 'No');
    
    if (!tournament) {
      console.log('❌ Tournament not found in database');
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('📊 Current tournament data:', {
      name: tournament.name,
      gameType: tournament.gameType,
      status: tournament.status,
      youtubeVideoId: tournament.youtubeVideoId,
      isLiveStreamEnabled: tournament.isLiveStreamEnabled
    });

    // Update tournament fields (excluding participants to avoid validation errors)
    const allowedUpdates = [
      'name', 'description', 'gameType', 'mode', 'format', 'entryFee',
      'prizePool', 'prizeDistribution', 'maxParticipants', 'startDate',
      'endDate', 'registrationDeadline', 'status', 'rules',
      'region', 'featured', 'bannerImage', 'tags', 'youtubeVideoId', 'isLiveStreamEnabled'
    ];

    const updatedFields = [];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        const oldValue = tournament[field];
        tournament[field] = req.body[field];
        updatedFields.push({
          field,
          oldValue,
          newValue: req.body[field]
        });
        console.log(`  ✏️ Updating ${field}: ${oldValue} → ${req.body[field]}`);
      }
    });

    console.log('📝 Updated fields:', updatedFields);

    // Handle roomDetails separately to preserve nested structure
    if (req.body.roomDetails) {
      console.log('  - Updating roomDetails');
      // Merge roomDetails instead of replacing
      if (req.body.roomDetails.cs2) {
        console.log('    - Updating CS2 details:', req.body.roomDetails.cs2);
        tournament.roomDetails.cs2 = {
          ...tournament.roomDetails.cs2.toObject(),
          ...req.body.roomDetails.cs2
        };
      }
      if (req.body.roomDetails.bgmi) {
        console.log('    - Updating BGMI details:', req.body.roomDetails.bgmi);
        tournament.roomDetails.bgmi = {
          ...tournament.roomDetails.bgmi.toObject(),
          ...req.body.roomDetails.bgmi
        };
      }
      if (req.body.roomDetails.valorant) {
        console.log('    - Updating Valorant details:', req.body.roomDetails.valorant);
        tournament.roomDetails.valorant = {
          ...tournament.roomDetails.valorant.toObject(),
          ...req.body.roomDetails.valorant
        };
      }
      tournament.markModified('roomDetails');
    }

    console.log('💾 Saving tournament to database...');
    // Save with validation disabled for participants (to avoid enum errors from seed data)
    const savedTournament = await tournament.save({ validateModifiedOnly: true });
    console.log('✅ Tournament saved successfully!');
    
    await savedTournament.populate('createdBy', 'username avatarUrl');

    console.log('✅ Tournament updated successfully!');
    console.log('📝 Updated tournament:', { 
      id: savedTournament._id, 
      name: savedTournament.name, 
      status: savedTournament.status,
      youtubeVideoId: savedTournament.youtubeVideoId,
      isLiveStreamEnabled: savedTournament.isLiveStreamEnabled
    });
    
    res.json({
      success: true,
      data: { tournament: savedTournament },
      message: '✅ Tournament updated successfully!',
      updatedFields: updatedFields,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Tournament update error:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      console.error('❌ Validation errors:', validationErrors);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Tournament validation failed',
          details: validationErrors,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (error.code === 11000) {
      console.error('❌ Duplicate key error');
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_TOURNAMENT',
          message: 'A tournament with this name already exists',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_UPDATE_FAILED',
        message: 'Failed to update tournament',
        details: error.message,
        errorName: error.name,
        errorCode: error.code,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/tournaments/:id/join-with-team
// @desc    Join a tournament with team (BGMI only)
// @access  Private
router.post('/:id/join-with-team', auth, [
  body('teamId')
    .notEmpty()
    .withMessage('Team ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Only allow for BGMI tournaments
    if (tournament.gameType !== 'bgmi') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GAME_TYPE',
          message: 'Team-based registration is only available for BGMI tournaments',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { teamId } = req.body;
    const Team = require('../models/Team');
    const TournamentRegistration = require('../models/TournamentRegistration');

    // Get team details
    const team = await Team.findById(teamId)
      .populate('members.userId', 'username gameIds isActive');

    if (!team) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TEAM_NOT_FOUND',
          message: 'Team not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Debug logging for team membership
    console.log('🔍 Team membership check:');
    console.log('🔍 User ID:', req.user.userId);
    console.log('🔍 Team captain:', team.captain);
    console.log('🔍 Team members:', team.members.map(m => ({ userId: m.userId, role: m.role })));
    console.log('🔍 Is captain?', team.captain && team.captain.toString() === req.user.userId.toString());
    console.log('🔍 Is member?', team.isMember(req.user.userId));

    // Check if user is member of this team
    if (!team.isMember(req.user.userId)) {
      console.log('❌ User is not a member of this team');
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_TEAM_MEMBER',
          message: 'You are not a member of this team',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ User is a member of this team');

    // Check if team is for BGMI
    if (team.game !== 'bgmi') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TEAM_GAME',
          message: 'Team must be for BGMI',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if team has exactly 4 members
    if (team.members.length !== 4) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TEAM_SIZE',
          message: 'Team must have exactly 4 members for BGMI tournaments',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate all team members are registered on platform and have BGMI IDs
    const User = require('../models/User');
    const invalidMembers = [];
    
    for (const member of team.members) {
      const user = await User.findById(member.userId);
      if (!user || !user.isActive) {
        invalidMembers.push(`User ${member.userId} not found or inactive`);
        continue;
      }
      
      if (!user.gameIds?.bgmi) {
        invalidMembers.push(`${user.username} doesn't have BGMI ID registered`);
      }
    }

    if (invalidMembers.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TEAM_MEMBERS',
          message: 'Some team members are not eligible',
          details: invalidMembers,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if team is already registered for this tournament
    const existingRegistration = await TournamentRegistration.findOne({
      tournamentId: tournament._id,
      userId: req.user.userId
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_REGISTERED',
          message: 'You are already registered for this tournament',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get team captain (for leader info)
    const captain = await User.findById(team.captain);
    
    // Prepare team members data (excluding captain)
    const teamMembersData = [];
    for (const member of team.members) {
      if (member.userId.toString() !== team.captain.toString()) {
        const user = await User.findById(member.userId);
        teamMembersData.push({
          name: user.username,
          bgmiId: user.gameIds.bgmi
        });
      }
    }

    // Ensure we have exactly 3 team members (excluding captain)
    if (teamMembersData.length !== 3) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TEAM_STRUCTURE',
          message: 'Team must have 1 captain + 3 members',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create tournament registration
    const registration = new TournamentRegistration({
      tournamentId: tournament._id,
      userId: req.user.userId,
      teamName: team.name,
      teamLeader: {
        name: captain.username,
        bgmiId: captain.gameIds.bgmi,
        phone: captain.phone || '0000000000' // Default if not available
      },
      teamMembers: teamMembersData,
      whatsappNumber: captain.phone || '0000000000', // Use captain's phone
      status: 'pending'
    });

    await registration.save();

    // Update tournament participant count
    const registrationCount = await TournamentRegistration.countDocuments({
      tournamentId: tournament._id,
      status: { $in: ['pending', 'images_uploaded', 'verified'] }
    });
    
    tournament.currentParticipants = registrationCount;
    await tournament.save();

    // Also add to tournament participants array for consistency
    await tournament.addParticipant(req.user.userId, captain.gameIds.bgmi, team.name);

    res.json({
      success: true,
      data: { 
        registration,
        tournament,
        team: {
          id: team._id,
          name: team.name,
          memberCount: team.members.length
        }
      },
      message: `🎮 Successfully registered team "${team.name}" for the tournament!`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Team tournament join error:', error);
    
    if (error.message.includes('already registered') || 
        error.message.includes('full') || 
        error.message.includes('not open')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'JOIN_FAILED',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_JOIN_FAILED',
        message: error.message || 'Failed to join tournament with team',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/tournaments/:id/join
// @desc    Join a tournament
// @access  Private
router.post('/:id/join', auth, [
  body('gameId')
    .notEmpty()
    .withMessage('Game ID is required'),
  body('teamName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Team name cannot exceed 50 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Commented out to reduce console spam - uncomment for debugging
    // const now = new Date();
    // console.log('🎮 Tournament Join Attempt:', {
    //   tournamentId: tournament._id,
    //   tournamentName: tournament.name,
    //   status: tournament.status,
    //   isRegistrationOpen: tournament.isRegistrationOpen,
    //   now: now.toISOString(),
    //   registrationDeadline: tournament.registrationDeadline.toISOString(),
    //   startDate: tournament.startDate.toISOString(),
    //   currentParticipants: tournament.currentParticipants,
    //   maxParticipants: tournament.maxParticipants,
    //   userId: req.user.userId
    // });

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check KYC status if required (OPTIONAL - disabled for now)
    // KYC check can be enabled later by setting tournament.settings.requireKYC = true
    if (tournament.settings?.requireKYC && user.kycStatus !== 'verified') {
      // For now, just log a warning instead of blocking
      console.log(`⚠️ User ${user.username} joining without KYC verification`);
      // Uncomment below to enforce KYC:
      // return res.status(400).json({
      //   success: false,
      //   error: {
      //     code: 'KYC_REQUIRED',
      //     message: 'KYC verification required to join this tournament',
      //     timestamp: new Date().toISOString()
      //   }
      // });
    }

    const { gameId, teamName = '' } = req.body;

    // CS2 Tournament - Validate Steam Connection
    if (tournament.gameType === 'cs2') {
      const steamId = user.gameIds?.steam || user.steamProfile?.steamId;
      const isSteamConnected = user.steamProfile?.isConnected;
      
      console.log('🔍 CS2 Tournament Join - Steam Check:', {
        userId: user._id,
        username: user.username,
        steamId,
        isSteamConnected,
        gameIdFromRequest: gameId,
        steamProfile: user.steamProfile
      });

      if (!steamId || !isSteamConnected) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'STEAM_NOT_CONNECTED',
            message: 'Steam account not connected. Please connect your Steam account to join CS2 tournaments.',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Use the Steam ID from user profile if gameId is not provided or doesn't match
      if (!gameId || gameId !== steamId) {
        console.log(`⚠️ Using Steam ID from profile: ${steamId} instead of provided gameId: ${gameId}`);
        req.body.gameId = steamId; // Override with correct Steam ID
      }
    }

    // Check wallet balance and deduct entry fee
    if (tournament.entryFee > 0) {
      const hasSufficientBalance = await WalletService.hasSufficientBalance(
        req.user.userId, 
        tournament.entryFee
      );

      if (!hasSufficientBalance) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: `Insufficient wallet balance. Required: ₹${tournament.entryFee}`,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Deduct entry fee from wallet
      await WalletService.deductMoney(
        req.user.userId,
        tournament.entryFee,
        'tournament_fee',
        `Tournament entry fee for ${tournament.name}`,
        { tournamentId: tournament._id }
      );
    }

    // Add participant to tournament
    await tournament.addParticipant(req.user.userId, gameId, teamName);

    // For BGMI tournaments, also update the currentParticipants count based on TournamentRegistration
    if (tournament.gameType === 'bgmi') {
      const TournamentRegistration = require('../models/TournamentRegistration');
      const registrationCount = await TournamentRegistration.countDocuments({
        tournamentId: tournament._id,
        status: { $in: ['pending', 'images_uploaded', 'verified'] }
      });
      
      // Update tournament participant count to match registrations
      tournament.currentParticipants = registrationCount;
      await tournament.save();
    }

    // Populate tournament with creator info
    await tournament.populate('createdBy', 'username avatarUrl');

    res.json({
      success: true,
      data: { 
        tournament,
        roomDetails: tournament.roomDetails, // Include room details for registered user
        isRegistered: true
      },
      message: '🎮 Successfully joined the tournament!',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Tournament join error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      tournamentId: req.params.id,
      userId: req.user.userId,
      gameId: req.body.gameId
    });
    
    if (error.message.includes('already registered') || 
        error.message.includes('full') || 
        error.message.includes('not open')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'JOIN_FAILED',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_JOIN_FAILED',
        message: error.message || 'Failed to join tournament',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/tournaments/:id/leave
// @desc    Leave a tournament
// @access  Private
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Remove participant from tournament
    await tournament.removeParticipant(req.user.userId);

    // TODO: Refund entry fee to wallet (will be implemented in wallet system)

    res.json({
      success: true,
      data: { tournament },
      message: 'Successfully left the tournament',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tournament leave error:', error);
    
    if (error.message.includes('not registered')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LEAVE_FAILED',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_LEAVE_FAILED',
        message: 'Failed to leave tournament',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/tournaments/:id
// @desc    Delete a tournament (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check force delete flag from query parameter
    const forceDelete = req.query.force === 'true';

    // Check if tournament has participants (only if not force deleting)
    if (tournament.currentParticipants > 0 && !forceDelete) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOURNAMENT_HAS_PARTICIPANTS',
          message: 'Cannot delete tournament with registered participants. Use force delete to proceed.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // If force deleting with participants, log warning
    if (tournament.currentParticipants > 0 && forceDelete) {
      console.warn(`⚠️ Force deleting tournament ${tournament._id} with ${tournament.currentParticipants} participants`);
    }

    // Delete the tournament
    await Tournament.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Tournament deleted successfully${forceDelete ? ' (force delete)' : ''}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tournament delete error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_DELETE_FAILED',
        message: 'Failed to delete tournament',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/:id/participants
// @desc    Get tournament participants
// @access  Public
router.get('/:id/participants', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('participants.userId', 'username avatarUrl level currentRank totalEarnings');

    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: { 
        participants: tournament.participants,
        count: tournament.currentParticipants,
        maxParticipants: tournament.maxParticipants
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Participants fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PARTICIPANTS_FETCH_FAILED',
        message: 'Failed to fetch tournament participants',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/tournaments/:id/scoreboards
// @desc    Upload scoreboard image for completed tournament (Admin only)
// @access  Private (Admin)
router.post('/:id/scoreboards', auth, async (req, res) => {
  try {
    const { imageUrl, description = 'Tournament Results' } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_IMAGE_URL',
          message: 'Image URL is required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Check if user is admin (fix user ID field mismatch)
    const user = await User.findById(req.user.userId || req.user.id);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_ACCESS_REQUIRED',
          message: 'Admin access required to upload scoreboards',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Add scoreboard to tournament
    const newScoreboard = {
      imageUrl,
      description,
      uploadedBy: req.user.userId || req.user.id,
      uploadedAt: new Date(),
      order: tournament.scoreboards.length
    };
    
    tournament.scoreboards.push(newScoreboard);
    await tournament.save();
    
    res.json({
      success: true,
      data: {
        message: 'Scoreboard uploaded successfully',
        scoreboard: newScoreboard,
        tournament: {
          id: tournament._id,
          name: tournament.name,
          scoreboardCount: tournament.scoreboards.length
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error uploading scoreboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCOREBOARD_UPLOAD_FAILED',
        message: 'Failed to upload scoreboard',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Specific routes moved before generic /:id routes to avoid conflicts

// @route   DELETE /api/tournaments/:id/scoreboards/:scoreboardId
// @desc    Delete a scoreboard (Admin only)
// @access  Private (Admin)
router.delete('/:id/scoreboards/:scoreboardId', auth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Check if user is admin
    const user = await User.findById(req.user.userId || req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_ACCESS_REQUIRED',
          message: 'Admin access required to delete scoreboards',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Find and remove scoreboard
    const scoreboardIndex = tournament.scoreboards.findIndex(
      sb => sb._id.toString() === req.params.scoreboardId
    );
    
    if (scoreboardIndex === -1) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCOREBOARD_NOT_FOUND',
          message: 'Scoreboard not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    tournament.scoreboards.splice(scoreboardIndex, 1);
    await tournament.save();
    
    res.json({
      success: true,
      data: {
        message: 'Scoreboard deleted successfully',
        tournament: {
          id: tournament._id,
          name: tournament.name,
          scoreboardCount: tournament.scoreboards.length
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error deleting scoreboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCOREBOARD_DELETE_FAILED',
        message: 'Failed to delete scoreboard',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/debug-status/:id
// @desc    Debug tournament status and dates (Admin only)
// @access  Private (Admin)
router.get('/debug-status/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId || req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_ACCESS_REQUIRED',
          message: 'Admin access required to debug tournament status',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const now = new Date();
    
    // Calculate status checks
    const statusChecks = {
      currentTime: now.toISOString(),
      registrationDeadline: tournament.registrationDeadline?.toISOString(),
      startDate: tournament.startDate?.toISOString(),
      endDate: tournament.endDate?.toISOString(),
      currentStatus: tournament.status,
      gameType: tournament.gameType,
      
      // Time comparisons
      isAfterRegistrationDeadline: tournament.registrationDeadline ? now >= tournament.registrationDeadline : null,
      isAfterStartDate: tournament.startDate ? now >= tournament.startDate : null,
      isAfterEndDate: tournament.endDate ? now >= tournament.endDate : null,
      
      // Status logic
      shouldBeRegistrationClosed: tournament.registrationDeadline && now >= tournament.registrationDeadline,
      shouldBeActive: tournament.startDate && now >= tournament.startDate && tournament.status === 'registration_closed',
      shouldBeCompleted: tournament.endDate && now >= tournament.endDate && tournament.status === 'active',
      
      // Registration status
      isRegistrationOpen: tournament.isRegistrationOpen,
      
      // Participants
      currentParticipants: tournament.currentParticipants,
      maxParticipants: tournament.maxParticipants,
      isFull: tournament.isFull
    };
    
    res.json({
      success: true,
      data: {
        tournament: {
          id: tournament._id,
          name: tournament.name,
          gameType: tournament.gameType,
          status: tournament.status
        },
        debug: statusChecks,
        recommendations: {
          suggestedStatus: 
            statusChecks.shouldBeCompleted ? 'completed' :
            statusChecks.shouldBeActive ? 'active' :
            statusChecks.shouldBeRegistrationClosed ? 'registration_closed' :
            tournament.status
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error debugging tournament status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEBUG_FAILED',
        message: 'Failed to debug tournament status',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/tournaments/sync-counts
// @desc    Manually sync tournament participant counts (Admin only)
// @access  Private (Admin)
router.post('/sync-counts', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId || req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_ACCESS_REQUIRED',
          message: 'Admin access required to sync tournament counts',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const TournamentRegistration = require('../models/TournamentRegistration');
    
    // Sync tournament counts
    const result = await TournamentRegistration.syncTournamentCounts();
    
    res.json({
      success: true,
      data: {
        message: 'Tournament participant counts synced successfully',
        updatedCount: result.updatedCount,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error syncing tournament counts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYNC_FAILED',
        message: 'Failed to sync tournament counts',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/tournaments/update-statuses
// @desc    Manually update tournament statuses (Admin only)
// @access  Private (Admin)
router.post('/update-statuses', auth, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.userId || req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_ACCESS_REQUIRED',
          message: 'Admin access required to update tournament statuses',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Update tournament statuses
    const result = await Tournament.updateTournamentStatuses();
    
    res.json({
      success: true,
      data: {
        message: 'Tournament statuses updated successfully',
        updatedCount: result.updatedCount,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error updating tournament statuses:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_UPDATE_FAILED',
        message: 'Failed to update tournament statuses',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/bgmi/scoreboards
// @desc    Get all BGMI tournament scoreboards (public)
// @access  Public
router.get('/bgmi/scoreboards', async (req, res) => {
  try {
    console.log('📥 BGMI Scoreboards API called');
    const { limit = 10 } = req.query;
    console.log('📊 Requested limit:', limit);
    
    // Find all BGMI tournaments with scoreboards
    const tournaments = await Tournament.find({
      gameType: 'bgmi',
      'scoreboards.0': { $exists: true } // Only tournaments with at least one scoreboard
    })
    .select('name gameType status endDate scoreboards')
    .populate('scoreboards.uploadedBy', 'username')
    .sort({ 'scoreboards.uploadedAt': -1 }); // Sort by latest scoreboard upload
    
    // Flatten all scoreboards from all tournaments
    const allScoreboards = [];
    
    tournaments.forEach(tournament => {
      tournament.scoreboards.forEach(scoreboard => {
        allScoreboards.push({
          _id: scoreboard._id,
          imageUrl: scoreboard.imageUrl,
          description: scoreboard.description,
          uploadedAt: scoreboard.uploadedAt,
          tournament: {
            id: tournament._id,
            name: tournament.name,
            gameType: tournament.gameType,
            status: tournament.status,
            endDate: tournament.endDate
          },
          uploadedBy: scoreboard.uploadedBy
        });
      });
    });
    
    // Sort by upload date (newest first) and limit results
    const sortedScoreboards = allScoreboards
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        scoreboards: sortedScoreboards,
        count: sortedScoreboards.length,
        total: allScoreboards.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching BGMI scoreboards:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BGMI_SCOREBOARDS_FETCH_FAILED',
        message: 'Failed to fetch BGMI scoreboards',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/user/scoreboards
// @desc    Get scoreboards for tournaments where user participated
// @access  Private
router.get('/user/scoreboards', auth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    
    // Find tournaments where user participated
    const tournaments = await Tournament.find({
      'participants.userId': userId,
      'scoreboards.0': { $exists: true } // Only tournaments with at least one scoreboard
    })
    .select('name gameType status endDate scoreboards participants')
    .populate('scoreboards.uploadedBy', 'username')
    .sort({ endDate: -1 }); // Most recent first
    
    // Format the response with scoreboard details
    const userScoreboards = [];
    
    tournaments.forEach(tournament => {
      tournament.scoreboards.forEach(scoreboard => {
        userScoreboards.push({
          _id: scoreboard._id,
          imageUrl: scoreboard.imageUrl,
          description: scoreboard.description,
          uploadedAt: scoreboard.uploadedAt,
          tournament: {
            id: tournament._id,
            name: tournament.name,
            gameType: tournament.gameType,
            status: tournament.status,
            endDate: tournament.endDate
          },
          uploadedBy: scoreboard.uploadedBy
        });
      });
    });
    
    res.json({
      success: true,
      data: {
        scoreboards: userScoreboards,
        count: userScoreboards.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching user scoreboards:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_SCOREBOARDS_FETCH_FAILED',
        message: 'Failed to fetch user scoreboards',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/tournaments/:id/scoreboards
// @desc    Get all scoreboards for a tournament
// @access  Public
router.get('/:id/scoreboards', async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('scoreboards.uploadedBy', 'username')
      .select('name gameType status scoreboards');
      
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TOURNAMENT_NOT_FOUND',
          message: 'Tournament not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Sort scoreboards by order
    const sortedScoreboards = tournament.scoreboards.sort((a, b) => a.order - b.order);
    
    res.json({
      success: true,
      data: {
        tournament: {
          id: tournament._id,
          name: tournament.name,
          gameType: tournament.gameType,
          status: tournament.status
        },
        scoreboards: sortedScoreboards
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching scoreboards:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCOREBOARDS_FETCH_FAILED',
        message: 'Failed to fetch scoreboards',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
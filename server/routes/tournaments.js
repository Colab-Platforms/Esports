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
  // Disable caching for tournament data
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  
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

    const tournaments = await Tournament.getFilteredTournaments(filters)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Tournament.countDocuments(
      Tournament.getFilteredTournaments(filters).getQuery()
    );

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
  // Rules - Optional for all
  body('rules')
    .optional()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Rules must be 10-5000 characters'),
  // Format - Optional for CS2
  body('format')
    .optional()
    .isIn(['elimination', 'round_robin', 'swiss', 'battle_royale'])
    .withMessage('Invalid tournament format'),
  // CS2 Server Details - Only validate if gameType is cs2
  body('roomDetails.cs2.serverName')
    .if(body('gameType').equals('cs2'))
    .notEmpty()
    .withMessage('Server name is required for CS2 tournaments')
    .isLength({ min: 1, max: 100 })
    .withMessage('Server name must be 1-100 characters'),
  body('roomDetails.cs2.serverIp')
    .if(body('gameType').equals('cs2'))
    .notEmpty()
    .withMessage('Server IP is required for CS2 tournaments')
    .isString()
    .withMessage('Server IP must be a valid string'),
  body('roomDetails.cs2.serverPort')
    .if(body('gameType').equals('cs2'))
    .notEmpty()
    .withMessage('Server port is required for CS2 tournaments')
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

    // Set default prize distribution if not provided
    if (!tournamentData.prizeDistribution || tournamentData.prizeDistribution.length === 0) {
      tournamentData.prizeDistribution = [
        { position: 1, amount: tournamentData.prizePool * 0.5, percentage: 50 },
        { position: 2, amount: tournamentData.prizePool * 0.3, percentage: 30 },
        { position: 3, amount: tournamentData.prizePool * 0.2, percentage: 20 }
      ];
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
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_CREATION_FAILED',
        message: 'Failed to create tournament',
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
    
    // Check if user is admin
    const user = await User.findById(req.user.userId);
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
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

    // Update tournament fields (excluding participants to avoid validation errors)
    const allowedUpdates = [
      'name', 'description', 'gameType', 'mode', 'format', 'entryFee',
      'prizePool', 'prizeDistribution', 'maxParticipants', 'startDate',
      'endDate', 'registrationDeadline', 'status', 'rules',
      'region', 'featured', 'bannerImage', 'tags'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        console.log(`  - Updating ${field}`);
        tournament[field] = req.body[field];
      }
    });

    // Handle roomDetails separately to preserve nested structure
    if (req.body.roomDetails) {
      console.log('  - Updating roomDetails');
      // Merge roomDetails instead of replacing
      if (req.body.roomDetails.cs2) {
        tournament.roomDetails.cs2 = {
          ...tournament.roomDetails.cs2.toObject(),
          ...req.body.roomDetails.cs2
        };
      }
      if (req.body.roomDetails.bgmi) {
        tournament.roomDetails.bgmi = {
          ...tournament.roomDetails.bgmi.toObject(),
          ...req.body.roomDetails.bgmi
        };
      }
      if (req.body.roomDetails.valorant) {
        tournament.roomDetails.valorant = {
          ...tournament.roomDetails.valorant.toObject(),
          ...req.body.roomDetails.valorant
        };
      }
      tournament.markModified('roomDetails');
    }

    // Save with validation disabled for participants (to avoid enum errors from seed data)
    await tournament.save({ validateModifiedOnly: true });
    await tournament.populate('createdBy', 'username avatarUrl');

    console.log('✅ Tournament updated successfully!');
    res.json({
      success: true,
      data: { tournament },
      message: '✅ Tournament updated successfully!',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Tournament update error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_UPDATE_FAILED',
        message: 'Failed to update tournament',
        details: error.message,
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
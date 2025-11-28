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
      const validStatuses = ['upcoming', 'registration_open', 'registration_closed', 'active', 'completed', 'cancelled'];
      return statuses.every(status => validStatuses.includes(status.trim()));
    }
    return ['upcoming', 'registration_open', 'registration_closed', 'active', 'completed', 'cancelled'].includes(value);
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
    const tournament = await Tournament.findById(req.params.id)
      .populate('createdBy', 'username avatarUrl level')
      .populate('participants.userId', 'username avatarUrl level currentRank');

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

    // Check if user is registered (if authenticated)
    let isUserRegistered = false;
    let roomDetails = null;
    
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        isUserRegistered = tournament.isUserRegistered(decoded.userId);
        
        // Include room details only if user is registered
        if (isUserRegistered) {
          roomDetails = tournament.roomDetails;
        }
      } catch (err) {
        // Token invalid, continue without auth
      }
    }

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
  body('description')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be 10-1000 characters'),
  body('gameType')
    .isIn(['bgmi', 'valorant', 'cs2'])
    .withMessage('Invalid game type'),
  body('mode')
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
  body('startDate')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('registrationDeadline')
    .isISO8601()
    .withMessage('Invalid registration deadline format'),
  body('rules')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Rules must be 10-5000 characters'),
  body('format')
    .isIn(['elimination', 'round_robin', 'swiss', 'battle_royale'])
    .withMessage('Invalid tournament format')
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
      createdBy: req.user.userId,
      status: 'upcoming'
    };

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
      'endDate', 'registrationDeadline', 'status', 'rules', 'roomDetails',
      'region', 'featured', 'bannerImage', 'tags'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        console.log(`  - Updating ${field}`);
        tournament[field] = req.body[field];
      }
    });

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

module.exports = router;
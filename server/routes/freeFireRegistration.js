const express = require('express');
const { body, validationResult, query } = require('express-validator');
const TournamentRegistration = require('../models/TournamentRegistration');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');
const auth = require('../middleware/auth');

const router = express.Router();

console.log('🔥 Free Fire Registration routes loading...');

// EMERGENCY TEST ROUTE
router.get('/emergency-test', (req, res) => {
  res.json({
    success: true,
    message: 'EMERGENCY: Free Fire Route is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// EMERGENCY ADMIN TEST
router.get('/admin/emergency-test', (req, res) => {
  res.json({
    success: true,
    message: 'EMERGENCY: Free Fire Admin Route is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// @route   POST /api/freefire-registration/:tournamentId/register
// @desc    Register a 4-player team for Free Fire tournament
// @access  Private
router.post('/:tournamentId/register', auth, [
  // Team Details Validation
  body('teamName')
    .isLength({ min: 3, max: 50 })
    .withMessage('Team name must be 3-50 characters')
    .trim(),
  
  // Team Leader Validation
  body('teamLeader.name')
    .isLength({ min: 2, max: 50 })
    .withMessage('Team leader name must be 2-50 characters')
    .trim(),
  body('teamLeader.freeFireId')
    .isLength({ min: 3, max: 30 })
    .withMessage('Team leader Free Fire ID must be 3-30 characters')
    .trim(),
  body('teamLeader.phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Team leader phone must be a valid Indian number'),
  
  // Team Members Validation (exactly 3 members)
  body('teamMembers')
    .isArray({ min: 3, max: 3 })
    .withMessage('Team must have exactly 3 members'),
  body('teamMembers.*.name')
    .isLength({ min: 2, max: 50 })
    .withMessage('Team member name must be 2-50 characters')
    .trim(),
  body('teamMembers.*.freeFireId')
    .isLength({ min: 3, max: 30 })
    .withMessage('Team member Free Fire ID must be 3-30 characters')
    .trim(),

  // WhatsApp Number Validation
  body('whatsappNumber')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('WhatsApp number must be a valid Indian number')
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

    const { tournamentId } = req.params;
    const { teamName, teamLeader, teamMembers, whatsappNumber } = req.body;

    // Check if tournament exists and is Free Fire
    const tournament = await Tournament.findById(tournamentId);
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

    if (tournament.gameType !== 'freefire') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GAME_TYPE',
          message: 'This endpoint is only for Free Fire tournaments',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if registration is open
    if (!tournament.isRegistrationOpen) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_CLOSED',
          message: 'Registration is not open for this tournament',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check for duplicate registration
    const existingRegistration = await TournamentRegistration.findOne({
      tournamentId,
      userId: req.user.userId
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_REGISTRATION',
          message: 'You have already registered for this tournament',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate unique Free Fire IDs within the team
    const allFreeFireIds = [teamLeader.freeFireId, ...teamMembers.map(m => m.freeFireId)];
    const uniqueFreeFireIds = [...new Set(allFreeFireIds)];
    if (allFreeFireIds.length !== uniqueFreeFireIds.length) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_FREEFIRE_IDS',
          message: 'All team members must have unique Free Fire IDs',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create registration
    const registration = new TournamentRegistration({
      tournamentId,
      userId: req.user.userId,
      teamName,
      teamLeader,
      teamMembers,
      whatsappNumber,
      status: 'pending'
    });

    await registration.save();

    // Send WhatsApp "Registration Successful" message
    try {
      await WhatsAppMessage.createRegistrationSuccessMessage(
        registration._id,
        whatsappNumber,
        teamName,
        tournament.name
      );

      const whatsappResult = await whatsappService.sendRegistrationSuccess(
        whatsappNumber,
        teamName,
        tournament.name
      );

      if (whatsappResult.success) {
        console.log('✅ WhatsApp registration success message sent');
      } else {
        console.error('❌ WhatsApp message send failed:', whatsappResult.error);
      }
    } catch (whatsappError) {
      console.error('❌ WhatsApp message creation failed:', whatsappError);
    }

    await registration.populate('tournamentId', 'name gameType mode');
    await registration.populate('userId', 'username email');

    res.status(201).json({
      success: true,
      data: { registration },
      message: '🔥 Team registered successfully! WhatsApp confirmation sent.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Free Fire registration error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_REGISTRATION',
          message: 'You have already registered for this tournament',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to register team',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/freefire-registration/my-registrations
// @desc    Get current user's registrations
// @access  Private
router.get('/my-registrations', auth, [
  query('status').optional().isIn(['pending', 'images_uploaded', 'verified', 'rejected']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
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

    const { status, page = 1, limit = 10 } = req.query;

    const filters = { userId: req.user.userId };
    if (status) filters.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const registrations = await TournamentRegistration.getFilteredRegistrations(filters)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TournamentRegistration.countDocuments(filters);

    res.json({
      success: true,
      data: {
        registrations,
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
    console.error('❌ Get my registrations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_MY_REGISTRATIONS_FAILED',
        message: 'Failed to fetch your registrations',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/freefire-registration/:registrationId/status
// @desc    Get registration status
// @access  Private
router.get('/:registrationId/status', auth, async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await TournamentRegistration.findById(registrationId)
      .populate('tournamentId', 'name gameType mode startDate')
      .populate('userId', 'username')
      .populate('verifiedBy', 'username');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = await User.findById(req.user.userId);
    const isOwner = registration.userId._id.toString() === req.user.userId;
    const isAdmin = user && ['admin', 'moderator'].includes(user.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only view your own registrations',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: { registration },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get registration status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_STATUS_FAILED',
        message: 'Failed to fetch registration status',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/freefire-registration/admin/last-update
// @desc    Get last update timestamp
// @access  Private (Admin)
router.get('/admin/last-update', auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const lastRegistration = await TournamentRegistration
      .findOne({})
      .sort({ updatedAt: -1 })
      .select('updatedAt');

    const lastMessage = await WhatsAppMessage
      .findOne({})
      .sort({ createdAt: -1 })
      .select('createdAt');

    let lastUpdate = null;
    if (lastRegistration && lastMessage) {
      lastUpdate = lastRegistration.updatedAt > lastMessage.createdAt 
        ? lastRegistration.updatedAt 
        : lastMessage.createdAt;
    } else if (lastRegistration) {
      lastUpdate = lastRegistration.updatedAt;
    } else if (lastMessage) {
      lastUpdate = lastMessage.createdAt;
    }

    res.json({
      success: true,
      lastUpdate: lastUpdate,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get last update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LAST_UPDATE_FAILED',
        message: 'Failed to get last update time',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/freefire-registration/admin/assign-groups/:tournamentId
// @desc    Assign groups to all registrations
// @access  Private (Admin)
router.post('/admin/assign-groups/:tournamentId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { tournamentId } = req.params;

    const tournament = await Tournament.findById(tournamentId);

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

    if (tournament.gameType !== 'freefire') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GAME_TYPE',
          message: 'Grouping is only available for Free Fire tournaments',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!tournament.grouping || !tournament.grouping.enabled) {
      tournament.grouping = {
        enabled: true,
        groupSize: 20
      };
      await tournament.save();
      console.log(`✅ Enabled grouping for tournament ${tournament.name} with default group size 20`);
    }

    const result = await TournamentRegistration.assignGroups(tournamentId);

    res.json({
      success: true,
      data: result,
      message: `Groups assigned successfully! ${result.updatedCount} registrations updated across ${result.totalGroups} groups.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Assign groups error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ASSIGN_GROUPS_FAILED',
        message: 'Failed to assign groups',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/freefire-registration/admin/registrations
// @desc    Get all Free Fire registrations for admin dashboard
// @access  Private (Admin)
router.get('/admin/registrations', auth, [
  query('status').optional().isIn(['pending', 'images_uploaded', 'verified', 'rejected', 'not_verified']),
  query('tournamentId').optional().isMongoId(),
  query('teamName').optional().isLength({ min: 1, max: 50 }),
  query('playerName').optional().isLength({ min: 1, max: 50 }),
  query('group').optional().isLength({ min: 1, max: 10 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
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
          message: 'Invalid query parameters',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { status, tournamentId, teamName, playerName, group, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (tournamentId) query.tournamentId = tournamentId;
    if (teamName) query.teamName = new RegExp(teamName, 'i');
    if (group) query.group = group;
    if (playerName) {
      query.$or = [
        { 'teamLeader.name': new RegExp(playerName, 'i') },
        { 'teamMembers.name': new RegExp(playerName, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const registrations = await TournamentRegistration.find(query)
      .populate('tournamentId', 'name gameType mode grouping currentParticipants maxParticipants')
      .populate('userId', 'username email')
      .populate('verifiedBy', 'username')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await TournamentRegistration.countDocuments(query);

    const stats = {
      total: totalCount,
      pending: await TournamentRegistration.countDocuments({ ...query, status: 'pending' }),
      imagesUploaded: await TournamentRegistration.countDocuments({ ...query, status: 'images_uploaded' }),
      verified: await TournamentRegistration.countDocuments({ ...query, status: 'verified' }),
      rejected: await TournamentRegistration.countDocuments({ 
        ...query,
        status: 'rejected', 
        rejectionReason: { $not: /^Not Verified/ } 
      }),
      notVerified: await TournamentRegistration.countDocuments({ 
        ...query,
        status: 'rejected', 
        rejectionReason: /^Not Verified/ 
      })
    };

    res.json({
      success: true,
      data: {
        registrations,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get admin registrations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_REGISTRATIONS_FAILED',
        message: 'Failed to fetch registrations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/freefire-registration/admin/registrations/:registrationId
// @desc    Get single Free Fire registration
// @access  Private (Admin)
router.get('/admin/registrations/:registrationId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { registrationId } = req.params;

    const registration = await TournamentRegistration.findById(registrationId)
      .populate('tournamentId', 'name gameType mode')
      .populate('userId', 'username email')
      .populate('verifiedBy', 'username');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: {
        registration
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get single registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_REGISTRATION_FAILED',
        message: 'Failed to fetch registration',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/freefire-registration/admin/:registrationId/status
// @desc    Update registration status (Admin only)
// @access  Private (Admin)
router.put('/admin/:registrationId/status', auth, [
  body('status')
    .isIn(['pending', 'images_uploaded', 'verified', 'rejected', 'not_verified'])
    .withMessage('Invalid status'),
  body('rejectionReason')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Rejection reason must be 5-200 characters')
], async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
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
          message: 'Invalid input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { registrationId } = req.params;
    const { status, rejectionReason } = req.body;

    const registration = await TournamentRegistration.findById(registrationId)
      .populate('tournamentId', 'name');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (status === 'verified') {
      await registration.verify(req.user.userId);
      
      try {
        console.log('🔄 Sending WhatsApp verification message to:', registration.whatsappNumber);
        
        await WhatsAppMessage.createVerificationMessage(
          registration._id,
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name
        );

        const whatsappResult = await whatsappService.sendVerificationApproval(
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name
        );

        if (whatsappResult.success) {
          console.log('✅ WhatsApp verification message sent successfully');
        } else {
          console.error('❌ WhatsApp verification message failed:', whatsappResult.error);
        }
      } catch (whatsappError) {
        console.error('❌ WhatsApp verification message error:', whatsappError.message);
      }
    } else if (status === 'rejected') {
      if (!rejectionReason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'REJECTION_REASON_REQUIRED',
            message: 'Rejection reason is required when rejecting registration',
            timestamp: new Date().toISOString()
          }
        });
      }
      await registration.reject(req.user.userId, rejectionReason);
      
      try {
        await WhatsAppMessage.createVerificationRejectedMessage(
          registration._id,
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name,
          rejectionReason
        );

        const whatsappResult = await whatsappService.sendVerificationRejected(
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name,
          rejectionReason
        );

        if (whatsappResult.success) {
          console.log('✅ WhatsApp rejection message sent');
        } else {
          console.error('❌ WhatsApp rejection message failed:', whatsappResult.error);
        }
      } catch (whatsappError) {
        console.error('❌ WhatsApp rejection message error:', whatsappError);
      }
    } else if (status === 'pending') {
      registration.status = status;
      registration.rejectionReason = rejectionReason || null;
      await registration.save();
      
      try {
        const whatsappResult = await whatsappService.sendPendingStatusMessage(
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name,
          rejectionReason
        );

        if (whatsappResult.success) {
          console.log('✅ WhatsApp pending status message sent');
        } else {
          console.error('❌ WhatsApp pending status message failed:', whatsappResult.error);
        }
      } catch (whatsappError) {
        console.error('❌ WhatsApp pending status message error:', whatsappError);
      }
    } else if (status === 'not_verified') {
      registration.status = 'rejected';
      registration.rejectionReason = rejectionReason || 'Not Verified by Admin';
      await registration.save();
      
      try {
        const whatsappResult = await whatsappService.sendVerificationRejected(
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name,
          rejectionReason || 'Not Verified by Admin'
        );

        if (whatsappResult.success) {
          console.log('✅ WhatsApp not verified message sent');
        } else {
          console.error('❌ WhatsApp not verified message failed:', whatsappResult.error);
        }
      } catch (whatsappError) {
        console.error('❌ WhatsApp not verified message error:', whatsappError);
      }
    } else {
      registration.status = status;
      if (status !== 'rejected' && status !== 'not_verified') {
        registration.rejectionReason = null;
      }
      await registration.save();
    }

    await registration.populate('tournamentId', 'name gameType mode');
    await registration.populate('userId', 'username email');
    await registration.populate('verifiedBy', 'username');

    res.json({
      success: true,
      data: { registration },
      message: `Registration ${status} successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Update registration status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_UPDATE_FAILED',
        message: 'Failed to update registration status',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Debug endpoint
router.get('/debug/registrations-count', auth, async (req, res) => {
  try {
    const total = await TournamentRegistration.countDocuments({});
    const registrations = await TournamentRegistration.find({}).limit(5);
    res.json({ 
      success: true, 
      total,
      sampleRegistrations: registrations.map(r => ({
        id: r._id,
        teamName: r.teamName,
        status: r.status,
        registeredAt: r.registeredAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Free Fire Registration route is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint for admin route
router.get('/admin/test', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    res.json({
      success: true,
      message: 'Free Fire Admin route is working',
      user: {
        id: user._id,
        role: user.role || 'no role set',
        isAdmin: ['admin', 'moderator'].includes(user.role)
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Free Fire Admin route test failed'
    });
  }
});

// Debug endpoint to check user role
router.get('/debug/user-role', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    res.json({ 
      success: true, 
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        role: user.role || 'no role set'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Temporary endpoint to make user admin
router.post('/make-admin', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId, 
      { role: 'admin' }, 
      { new: true }
    );
    res.json({ success: true, message: 'User made admin', user: { id: user._id, role: user.role } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   PUT /api/freefire-registration/admin/:registrationId
// @desc    Update registration (Admin only)
// @access  Private (Admin)
router.put('/admin/:registrationId', auth, [
  body('teamName')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('Team name must be 3-50 characters')
    .trim(),
  body('teamLeader.name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Team leader name must be 2-50 characters')
    .trim(),
  body('teamLeader.freeFireId')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Team leader Free Fire ID must be 3-30 characters')
    .trim(),
  body('teamLeader.phone')
    .optional()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Team leader phone must be a valid Indian number'),
  body('teamMembers')
    .optional()
    .isArray({ min: 3, max: 3 })
    .withMessage('Team must have exactly 3 members'),
  body('teamMembers.*.name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Team member name must be 2-50 characters')
    .trim(),
  body('teamMembers.*.freeFireId')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Team member Free Fire ID must be 3-30 characters')
    .trim(),
  body('whatsappNumber')
    .optional()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('WhatsApp number must be a valid Indian number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
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

    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { registrationId } = req.params;
    const updateData = req.body;

    console.log('🔍 Finding registration:', registrationId);
    console.log('📝 Update data received:', JSON.stringify(updateData, null, 2));
    
    const registration = await TournamentRegistration.findById(registrationId);
    
    if (!registration) {
      console.log('❌ Registration not found');
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ Registration found, current data:');
    console.log('- Team Name:', registration.teamName);
    console.log('- Team Members Count:', registration.teamMembers.length);
    
    // Validate unique Free Fire IDs if updating team data
    if (updateData.teamLeader || updateData.teamMembers) {
      const newTeamLeader = updateData.teamLeader || registration.teamLeader;
      const newTeamMembers = updateData.teamMembers || registration.teamMembers;
      
      const allFreeFireIds = [newTeamLeader.freeFireId, ...newTeamMembers.map(m => m.freeFireId)];
      const uniqueFreeFireIds = [...new Set(allFreeFireIds)];
      
      if (allFreeFireIds.length !== uniqueFreeFireIds.length) {
        console.log('❌ Duplicate Free Fire IDs found:', allFreeFireIds);
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_FREEFIRE_IDS',
            message: 'All team members must have unique Free Fire IDs',
            timestamp: new Date().toISOString()
          }
        });
      }
    }
    
    if (updateData.teamName) {
      console.log('📝 Updating team name:', updateData.teamName);
      registration.teamName = updateData.teamName;
    }
    
    if (updateData.teamLeader) {
      console.log('📝 Updating team leader:', updateData.teamLeader);
      registration.teamLeader = { ...registration.teamLeader.toObject(), ...updateData.teamLeader };
    }
    
    if (updateData.teamMembers) {
      console.log('📝 Updating team members:', updateData.teamMembers.length, 'members');
      if (updateData.teamMembers.length !== 3) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TEAM_SIZE',
            message: 'Team must have exactly 3 members',
            timestamp: new Date().toISOString()
          }
        });
      }
      registration.teamMembers = updateData.teamMembers;
    }
    
    if (updateData.whatsappNumber) {
      console.log('📝 Updating WhatsApp number:', updateData.whatsappNumber);
      registration.whatsappNumber = updateData.whatsappNumber;
    }

    console.log('💾 Saving registration...');
    await registration.save();
    console.log('✅ Registration saved successfully');

    await registration.populate('tournamentId', 'name gameType mode');
    await registration.populate('userId', 'username email');

    res.json({
      success: true,
      data: { registration },
      message: 'Registration updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Update registration error:', error);
    console.error('❌ Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (error.message?.includes('unique Free Fire IDs')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_FREEFIRE_IDS',
          message: 'All team members must have unique Free Fire IDs',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (error.message?.includes('exactly 3 members')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TEAM_SIZE',
          message: 'Team must have exactly 3 members',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update registration',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/freefire-registration/admin/:registrationId
// @desc    Delete registration (Admin only)
// @access  Private (Admin)
router.delete('/admin/:registrationId', auth, async (req, res) => {
  try {
    console.log('🗑️ DELETE route hit:', req.params.registrationId);
    
    const user = await User.findById(req.user.userId);
    console.log('👤 User role:', user?.role);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { registrationId } = req.params;

    const registration = await TournamentRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('🔄 Deleting WhatsApp messages for registration:', registrationId);
    await WhatsAppMessage.deleteMany({ registrationId });

    console.log('🔄 Deleting registration from database...');
    await TournamentRegistration.findByIdAndDelete(registrationId);

    console.log('✅ Registration deleted successfully');
    res.json({
      success: true,
      message: 'Registration deleted successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Delete registration error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      registrationId: req.params.registrationId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete registration',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/freefire-registration/:tournamentId/registrations
// @desc    Get all registrations for a tournament (Admin only)
// @access  Private (Admin)
router.get('/:tournamentId/registrations', auth, [
  query('status').optional().isIn(['pending', 'images_uploaded', 'verified', 'rejected']),
  query('teamName').optional().isLength({ min: 1, max: 50 }),
  query('playerName').optional().isLength({ min: 1, max: 50 }),
  query('phone').optional().matches(/^[6-9]\d{9}$/),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required',
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
          message: 'Invalid query parameters',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const { tournamentId } = req.params;
    const { status, teamName, playerName, phone, page = 1, limit = 20 } = req.query;

    const query = { tournamentId };
    if (status) query.status = status;
    if (teamName) query.teamName = new RegExp(teamName, 'i');
    if (playerName) {
      query.$or = [
        { 'teamLeader.name': new RegExp(playerName, 'i') },
        { 'teamMembers.name': new RegExp(playerName, 'i') }
      ];
    }
    if (phone) {
      query.$or = [
        { 'teamLeader.phone': phone },
        { 'teamMembers.phone': phone },
        { whatsappNumber: phone }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const registrations = await TournamentRegistration.find(query)
      .populate('tournamentId', 'name gameType mode')
      .populate('userId', 'username email')
      .populate('verifiedBy', 'username')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await TournamentRegistration.countDocuments(query);

    res.json({
      success: true,
      data: {
        registrations,
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
    console.error('❌ Get registrations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_REGISTRATIONS_FAILED',
        message: 'Failed to fetch registrations',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/freefire-registration/:registrationId
// @desc    Cancel registration (only if pending)
// @access  Private
router.delete('/:registrationId', auth, async (req, res) => {
  try {
    const { registrationId } = req.params;

    const registration = await TournamentRegistration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGISTRATION_NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (registration.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only cancel your own registrations',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANCELLATION_NOT_ALLOWED',
          message: 'Registration can only be cancelled when status is pending',
          timestamp: new Date().toISOString()
        }
      });
    }

    await TournamentRegistration.findByIdAndDelete(registrationId);

    res.json({
      success: true,
      message: 'Registration cancelled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cancel registration error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CANCELLATION_FAILED',
        message: 'Failed to cancel registration',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/freefire-registration/check-user/:phone
// @desc    Check if user is Free Fire user
// @access  Public
router.get('/check-user/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    
    const registration = await TournamentRegistration.findOne({
      $or: [
        { whatsappNumber: phone },
        { 'teamLeader.phone': phone }
      ]
    });
    
    res.json({
      success: true,
      isFreeFireUser: !!registration,
      phone: phone
    });
    
  } catch (error) {
    console.error('❌ Check Free Fire user error:', error);
    res.status(500).json({
      success: false,
      isFreeFireUser: false,
      error: error.message
    });
  }
});

// @route   GET /api/freefire-registration/tournament/:tournamentId/teams
// @desc    Get all registered teams for a tournament (public view)
// @access  Public
router.get('/tournament/:tournamentId/teams', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const teams = await TournamentRegistration.find({
      tournamentId,
      status: 'verified'
    })
      .populate('tournamentId', 'name gameType mode')
      .populate('userId', 'username email')
      .sort({ registeredAt: -1 });

    res.json({
      success: true,
      data: {
        teams,
        total: teams.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get tournament teams error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TEAMS_FAILED',
        message: 'Failed to fetch tournament teams',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/freefire-registration/admin/:registrationId/group
// @desc    Manually assign group to a registration (Admin only)
// @access  Private (Admin)
router.put('/admin/:registrationId/group', auth, [
  body('group')
    .notEmpty()
    .withMessage('Group is required')
    .matches(/^G\d+$/)
    .withMessage('Group must be in format G1, G2, G3, etc.')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin privileges required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { registrationId } = req.params;
    const { group } = req.body;

    console.log(`🔄 Manually assigning group ${group} to registration ${registrationId}`);

    const registration = await TournamentRegistration.findByIdAndUpdate(
      registrationId,
      { group },
      { new: true, runValidators: true }
    ).populate('userId', 'username email');

    if (!registration) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Registration not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`✅ Group ${group} assigned to team ${registration.teamName}`);

    res.json({
      success: true,
      message: `Team "${registration.teamName}" moved to ${group}`,
      data: {
        registration
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Manual group assignment error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GROUP_ASSIGNMENT_FAILED',
        message: 'Failed to assign group',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

console.log('✅ Free Fire Registration routes loaded successfully');
module.exports = router;

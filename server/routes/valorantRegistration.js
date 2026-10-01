const express = require('express');
const { body, validationResult, query } = require('express-validator');
const TournamentRegistration = require('../models/TournamentRegistration');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Tournament = require('../models/Tournament');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Team = require('../features/teams/team.model');
const whatsappService = require('../services/whatsappService');
const auth = require('../middleware/auth');
const {
  registerValorantTeam,
  rejectValorantRegistration,
  cancelValorantRegistration
} = require('../services/valorant-registration.service');

const router = express.Router();

console.log('🎯 Valorant Registration routes loading...');

const sendRegistrationError = (res, error, fallbackCode = 'REGISTRATION_FAILED', fallbackMessage = 'Failed to register team') => {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    error: {
      code: error.code || fallbackCode,
      message: error.message || fallbackMessage,
      ...(error.conflictingPlayers && { conflictingPlayers: error.conflictingPlayers }),
      ...(error.duplicateUserIds && { duplicateUserIds: error.duplicateUserIds }),
      details: process.env.NODE_ENV === 'development' ? error.details : undefined,
      timestamp: new Date().toISOString()
    }
  });
};

// @route   POST /api/valorant-registration/:tournamentId/register
// @desc    Register an authoritative 5+1 Valorant roster from a saved Team
// @access  Private
router.post('/:tournamentId/register', auth, [
  body('teamId')
    .isMongoId()
    .withMessage('A valid teamId is required')
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
    const { teamId } = req.body;

    const prepared = await registerValorantTeam({
      tournamentId,
      requesterUserId: req.user.userId,
      teamId,
      models: {
        Tournament,
        Team,
        User,
        TournamentRegistration
      }
    });
    const { registration } = prepared;

    // Award 50 coins to authoritative roster users
    // (best-effort; must never block registration if it fails)
    try {
      for (const memberId of prepared.rosterUserIds) {
        const memberWallet = await Wallet.findOne({ userId: memberId });
        if (memberWallet) {
          await memberWallet.addCoins(
            50,
            'earn',
            'Tournament Registration Bonus',
            {
              source: 'tournament_registration',
              referenceId: registration._id,
              referenceModel: 'TournamentRegistration'
            }
          );
        }
      }
    } catch (coinError) {
      console.error('⚠️ Failed to award Valorant registration coins:', coinError.message);
    }

    // Send WhatsApp "Registration Successful" message
    try {
      await WhatsAppMessage.createRegistrationSuccessMessage(
        registration._id,
        prepared.snapshot.whatsappNumber,
        prepared.snapshot.teamName,
        prepared.tournament.name,
        'valorant'
      );

      const whatsappResult = await whatsappService.sendRegistrationSuccess(
        prepared.snapshot.whatsappNumber,
        prepared.snapshot.teamName,
        prepared.tournament.name,
        'valorant'
      );

      if (!whatsappResult.success) {
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
      message: '🎯 Team registered successfully! WhatsApp confirmation sent.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Valorant registration error:', error);

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

    if (error.code) {
      return sendRegistrationError(res, error);
    }

    return sendRegistrationError(res, error, 'REGISTRATION_FAILED', 'Failed to register team');
  }
});

// @route   GET /api/valorant-registration/my-registrations
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
    console.error('❌ Get my Valorant registrations error:', error);
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

// @route   GET /api/valorant-registration/:registrationId/status
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
    console.error('❌ Get Valorant registration status error:', error);
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

// @route   DELETE /api/valorant-registration/:registrationId
// @desc    Cancel registration (only if pending, only own registration)
// @access  Private
router.delete('/:registrationId', auth, async (req, res) => {
  try {
    const { registrationId } = req.params;

    await cancelValorantRegistration({
      registrationId,
      requesterUserId: req.user.userId,
      models: {
        Tournament,
        TournamentRegistration
      }
    });

    res.json({
      success: true,
      message: 'Registration cancelled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cancel Valorant registration error:', error);
    return sendRegistrationError(res, error, 'CANCELLATION_FAILED', 'Failed to cancel registration');
  }
});

// @route   GET /api/valorant-registration/tournament/:tournamentId/teams
// @desc    Get all verified registered teams for a tournament (public view)
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
      data: { teams, total: teams.length },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get Valorant tournament teams error:', error);
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

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

const requireAdmin = async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user || !['admin', 'moderator'].includes(user.role)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin privileges required',
        timestamp: new Date().toISOString()
      }
    });
    return null;
  }
  return user;
};

// @route   GET /api/valorant-registration/admin/registrations
// @desc    Get all Valorant registrations for admin dashboard
// @access  Private (Admin)
router.get('/admin/registrations', auth, [
  query('status').optional().isIn(['pending', 'images_uploaded', 'verified', 'rejected']),
  query('tournamentId').optional().isMongoId(),
  query('teamName').optional().isLength({ min: 1, max: 50 }),
  query('playerName').optional().isLength({ min: 1, max: 50 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

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

    const { status, tournamentId, teamName, playerName, page = 1, limit = 20 } = req.query;

    // Only ever return registrations for Valorant tournaments, regardless of
    // what tournamentId is passed, so this endpoint can't be used to browse
    // other games' rosters.
    const valorantTournamentIds = await Tournament.find({ gameType: 'valorant' }).distinct('_id');

    const dbQuery = { tournamentId: { $in: valorantTournamentIds } };
    if (tournamentId) dbQuery.tournamentId = { $in: valorantTournamentIds, $eq: tournamentId };
    if (status) dbQuery.status = status;
    if (teamName) dbQuery.teamName = new RegExp(teamName, 'i');
    if (playerName) {
      dbQuery.$or = [
        { 'teamLeader.name': new RegExp(playerName, 'i') },
        { 'teamMembers.name': new RegExp(playerName, 'i') }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const registrations = await TournamentRegistration.find(dbQuery)
      .populate('tournamentId', 'name gameType mode currentParticipants maxParticipants')
      .populate('userId', 'username email')
      .populate('verifiedBy', 'username')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await TournamentRegistration.countDocuments(dbQuery);

    const stats = {
      total: totalCount,
      pending: await TournamentRegistration.countDocuments({ ...dbQuery, status: 'pending' }),
      imagesUploaded: await TournamentRegistration.countDocuments({ ...dbQuery, status: 'images_uploaded' }),
      verified: await TournamentRegistration.countDocuments({ ...dbQuery, status: 'verified' }),
      rejected: await TournamentRegistration.countDocuments({ ...dbQuery, status: 'rejected' })
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
    console.error('❌ Get admin Valorant registrations error:', error);
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

// @route   GET /api/valorant-registration/admin/registrations/:registrationId
// @desc    Get single Valorant registration for admin dashboard
// @access  Private (Admin)
router.get('/admin/registrations/:registrationId', auth, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { registrationId } = req.params;
    const registration = await TournamentRegistration.findById(registrationId)
      .populate('tournamentId', 'name gameType mode')
      .populate('userId', 'username email')
      .populate('verifiedBy', 'username');

    if (!registration || registration.tournamentId?.gameType !== 'valorant') {
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
      data: { registration },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Get single Valorant registration error:', error);
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

// @route   PUT /api/valorant-registration/admin/:registrationId/status
// @desc    Accept or reject a Valorant registration (Admin only)
// @access  Private (Admin)
router.put('/admin/:registrationId/status', auth, [
  body('status')
    .isIn(['pending', 'images_uploaded', 'verified', 'rejected'])
    .withMessage('Invalid status'),
  body('rejectionReason')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Rejection reason must be 5-200 characters')
], async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

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
      .populate('tournamentId', 'name gameType');

    if (!registration || registration.tournamentId?.gameType !== 'valorant') {
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
        await WhatsAppMessage.createVerificationMessage(
          registration._id,
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name
        );
        await whatsappService.sendVerificationApproval(
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name
        );
      } catch (whatsappError) {
        console.error('❌ WhatsApp verification message error:', whatsappError.message);
      }
    } else if (status === 'rejected') {
      const reason = rejectionReason;
      if (!reason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'REJECTION_REASON_REQUIRED',
            message: 'Rejection reason is required when rejecting registration',
            timestamp: new Date().toISOString()
          }
        });
      }
      await rejectValorantRegistration({
        registrationId,
        adminUserId: req.user.userId,
        reason,
        models: {
          Tournament,
          TournamentRegistration
        }
      });
      registration.status = 'rejected';
      registration.verifiedBy = req.user.userId;
      registration.verificationDate = new Date();
      registration.rejectionReason = reason;

      try {
        await WhatsAppMessage.createVerificationRejectedMessage(
          registration._id,
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name,
          reason
        );
        await whatsappService.sendVerificationRejected(
          registration.whatsappNumber,
          registration.teamName,
          registration.tournamentId.name,
          reason
        );
      } catch (whatsappError) {
        console.error('❌ WhatsApp rejection message error:', whatsappError);
      }
    } else {
      registration.status = status;
      registration.rejectionReason = null;
      await registration.save();
    }

    await registration.populate('userId', 'username email');
    await registration.populate('verifiedBy', 'username');

    res.json({
      success: true,
      data: { registration },
      message: `Registration ${status} successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Update Valorant registration status error:', error);
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

console.log('✅ Valorant Registration routes loaded successfully');
module.exports = router;

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Clan = require('../models/Clan');
const ClanMember = require('../models/ClanMember');
const ClanMessage = require('../models/ClanMessage');
const ClanCounter = require('../models/ClanCounter');
const User = require('../models/User');
const auth = require('../middleware/auth');
const ClanService = require('../services/clanService');
const ClanAnnouncement = require('../models/ClanAnnouncement');

const router = express.Router();

console.log('🎮 Clan routes loading...');

// ============================================================================
// MIDDLEWARE
// ============================================================================

/**
 * Middleware to check clan member role
 * @param {Array<String>} allowedRoles - Array of allowed roles
 */
const checkClanRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const { id: clanId } = req.params;
      const userId = req.user.userId;

      const clanMember = await ClanMember.findOne({ clan: clanId, user: userId });

      if (!clanMember) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this clan',
          timestamp: new Date().toISOString()
        });
      }

      // If no specific roles required, just check membership
      if (allowedRoles.length === 0) {
        req.clanMember = clanMember;
        return next();
      }

      // Check if user has required role
      if (!allowedRoles.includes(clanMember.role)) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`,
          timestamp: new Date().toISOString()
        });
      }

      req.clanMember = clanMember;
      next();
    } catch (error) {
      console.error('❌ Error checking clan role:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking permissions',
        timestamp: new Date().toISOString()
      });
    }
  };
};

// ============================================================================
// GET USER'S CLAN (for Navbar)
// ============================================================================

/**
 * @route   GET /api/clans/me/clan
 * @desc    Get the clan the logged-in user belongs to (if any)
 * @access  Private
 */
router.get('/me/clan', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find clan membership for this user
    const clanMember = await ClanMember.findOne({ user: userId })
      .populate('clan', 'name tag avatar visibility isLocked');

    if (!clanMember) {
      return res.json({
        success: true,
        data: null,
        timestamp: new Date().toISOString()
      });
    }

    // Return clan info with user's role and mute status
    res.json({
      success: true,
      data: {
        clan: {
          _id: clanMember.clan._id,
          name: clanMember.clan.name,
          tag: clanMember.clan.tag,
          avatar: clanMember.clan.avatar
        },
        role: clanMember.role,
        mutedUntil: clanMember.mutedUntil
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching user clan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clan info',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// CREATE CLAN
// ============================================================================

/**
 * @route   POST /api/clans
 * @desc    Create a new clan
 * @access  Private
 */
router.post('/', auth, [
  body('name')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Clan name must be 3-50 characters'),
  body('tag')
    .optional()
    .trim()
    .isLength({ max: 5 })
    .withMessage('Clan tag cannot exceed 5 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'invite'])
    .withMessage('Visibility must be public, private, or invite'),
  body('maxMembers')
    .optional()
    .isInt({ min: 2, max: 1000 })
    .withMessage('Max members must be between 2 and 1000')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { name, tag, description, visibility, maxMembers } = req.body;
    const userId = req.user.userId;

    // Check if user is already a member of any clan
    const userMembership = await ClanMember.findOne({ user: userId });
    if (userMembership) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of a clan. You must leave your current clan before creating a new one.',
        timestamp: new Date().toISOString()
      });
    }

    // Check if clan name already exists
    const existingClan = await Clan.findOne({ name });
    if (existingClan) {
      return res.status(400).json({
        success: false,
        message: 'Clan name already exists',
        timestamp: new Date().toISOString()
      });
    }

    // Create clan
    const clan = await ClanService.createClan({
      name,
      tag: tag?.toUpperCase() || null,
      description: description || '',
      owner: userId,
      visibility: visibility || 'public',
      maxMembers: maxMembers || 100
    });

    console.log(`✅ Clan "${clan.name}" created by user ${userId}`);

    res.status(201).json({
      success: true,
      data: {
        clan: clan.toObject()
      },
      message: '🎉 Clan created successfully!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating clan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create clan',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// LIST PUBLIC CLANS
// ============================================================================

/**
 * @route   GET /api/clans
 * @desc    List public clans with search and filter
 * @access  Public
 */
router.get('/', [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long'),
  query('game')
    .optional()
    .trim(),
  query('visibility')
    .optional()
    .isIn(['public', 'private', 'invite'])
    .withMessage('Invalid visibility filter'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be >= 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { search, visibility, game, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    const filter = { isLocked: false };

    if (visibility) {
      filter.visibility = visibility;
    } else {
      filter.visibility = 'public';
    }

    if (game) {
      filter.game = { $regex: new RegExp('^' + game + '$', 'i') };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch clans
    const clans = await Clan.find(filter)
      .populate('owner', 'username avatarUrl level')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Clan.countDocuments(filter);

    // Add member count to each clan
    const clansWithCounts = await Promise.all(
      clans.map(async (clan) => {
        const memberCount = await ClanMember.countDocuments({ clan: clan._id });
        return {
          ...clan.toObject(),
          memberCount
        };
      })
    );

    console.log(`📊 Fetched ${clansWithCounts.length} clans`);

    res.json({
      success: true,
      data: {
        clans: clansWithCounts,
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
    console.error('❌ Error fetching clans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clans',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET UNREAD MESSAGE COUNT
// ============================================================================

/**
 * @route   GET /api/clans/:id/unread?since=
 * @desc    Get count of unread messages in a clan since a given timestamp
 * @access  Private (user must be clan member)
 */
router.get('/:id/unread', auth, [
  query('since')
    .notEmpty()
    .withMessage('since parameter is required')
    .isISO8601()
    .withMessage('since must be a valid ISO 8601 date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { since } = req.query;
    const userId = req.user.userId;

    // Verify user is a member of this clan
    const clanMember = await ClanMember.findOne({ clan: clanId, user: userId });
    if (!clanMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this clan',
        timestamp: new Date().toISOString()
      });
    }

    // Count unread messages (messages after 'since' timestamp, not from current user, not deleted)
    const count = await ClanMessage.countDocuments({
      clan: clanId,
      createdAt: { $gt: new Date(since) },
      sender: { $ne: userId },
      isDeleted: false
    });

    console.log(`📨 Unread count for clan ${clanId}: ${count}`);

    res.json({
      success: true,
      data: { count },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET CLAN DETAIL
// ============================================================================

/**
 * @route   GET /api/clans/:id
 * @desc    Get clan detail with member count
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id: clanId } = req.params;

    const clan = await Clan.findById(clanId)
      .populate('owner', 'username avatarUrl level email');

    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Get member count
    const memberCount = await ClanMember.countDocuments({ clan: clanId });

    // Get online count (placeholder - would need real-time tracking)
    const onlineCount = 0;

    // Get recent messages count
    const messageCount = await ClanMessage.countDocuments({ clan: clanId, isDeleted: false });

    const clanData = clan.toObject();
    clanData.memberCount = memberCount;
    clanData.onlineCount = onlineCount;
    clanData.messageCount = messageCount;

    console.log(`📖 Fetched clan detail: ${clan.name}`);

    res.json({
      success: true,
      data: { clan: clanData },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching clan detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clan',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// UPDATE CLAN
// ============================================================================

/**
 * @route   PATCH /api/clans/:id
 * @desc    Update clan (owner/admin only)
 * @access  Private
 */
router.patch('/:id', auth, checkClanRole(['owner', 'admin']), [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Clan name must be 3-50 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'invite'])
    .withMessage('Visibility must be public, private, or invite'),
  body('maxMembers')
    .optional()
    .isInt({ min: 2, max: 1000 })
    .withMessage('Max members must be between 2 and 1000'),
  body('isLocked')
    .optional()
    .isBoolean()
    .withMessage('isLocked must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { name, description, visibility, maxMembers, isLocked } = req.body;

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if new name already exists (if changing name)
    if (name && name !== clan.name) {
      const existingClan = await Clan.findOne({ name });
      if (existingClan) {
        return res.status(400).json({
          success: false,
          message: 'Clan name already exists',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Update fields
    if (name) clan.name = name;
    if (description !== undefined) clan.description = description;
    if (visibility) clan.visibility = visibility;
    if (maxMembers) clan.maxMembers = maxMembers;
    if (isLocked !== undefined) clan.isLocked = isLocked;

    await clan.save();

    console.log(`✅ Clan ${clanId} updated`);

    res.json({
      success: true,
      data: { clan: clan.toObject() },
      message: '✅ Clan updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating clan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update clan',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// DELETE CLAN
// ============================================================================

/**
 * @route   DELETE /api/clans/:id
 * @desc    Delete clan (owner only), cascade delete members and messages
 * @access  Private
 */
router.delete('/:id', auth, checkClanRole(['owner']), async (req, res) => {
  try {
    const { id: clanId } = req.params;

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Delete clan and cascade
    await ClanService.deleteClan(clanId);

    console.log(`✅ Clan ${clanId} deleted`);

    res.json({
      success: true,
      message: '✅ Clan deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting clan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete clan',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// JOIN CLAN
// ============================================================================

/**
 * @route   POST /api/clans/:id/join
 * @desc    Join clan with validation
 * @access  Private
 */
router.post('/:id/join', auth, async (req, res) => {
  try {
    const { id: clanId } = req.params;
    const userId = req.user.userId;

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Validation checks
    if (clan.isLocked) {
      return res.status(400).json({
        success: false,
        message: 'Clan is locked and cannot accept new members',
        timestamp: new Date().toISOString()
      });
    }

    if (clan.isBanned(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are banned from this clan',
        timestamp: new Date().toISOString()
      });
    }

    if (clan.stats.totalMembers >= clan.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Clan is full',
        timestamp: new Date().toISOString()
      });
    }

    // Check if already member of any clan
    const existingMember = await ClanMember.findOne({ user: userId });
    if (existingMember) {
      if (existingMember.clan.toString() === clanId) {
        return res.status(400).json({
          success: false,
          message: 'You are already a member of this clan',
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'You are already a member of another clan. You must leave your current clan before joining this one.',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Add member
    const clanMember = await ClanService.addMember(clanId, userId, 'member');

    console.log(`✅ User ${userId} joined clan ${clanId}`);

    res.status(201).json({
      success: true,
      data: { member: clanMember.toObject() },
      message: '🎉 Successfully joined clan!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error joining clan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to join clan',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// LEAVE CLAN
// ============================================================================

/**
 * @route   POST /api/clans/:id/leave
 * @desc    Leave clan (prevent owner from leaving)
 * @access  Private
 */
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const { id: clanId } = req.params;
    const userId = req.user.userId;

    const clanMember = await ClanMember.findOne({ clan: clanId, user: userId });
    if (!clanMember) {
      return res.status(404).json({
        success: false,
        message: 'You are not a member of this clan',
        timestamp: new Date().toISOString()
      });
    }

    // Prevent owner from leaving
    if (clanMember.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Owner cannot leave clan. Transfer ownership first.',
        timestamp: new Date().toISOString()
      });
    }

    // Remove member
    await ClanService.removeMember(clanId, userId);

    console.log(`✅ User ${userId} left clan ${clanId}`);

    res.json({
      success: true,
      message: '✅ Successfully left clan',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error leaving clan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to leave clan',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET CLAN MEMBERS
// ============================================================================

/**
 * @route   GET /api/clans/:id/members
 * @desc    List all clan members with user info
 * @access  Public
 */
router.get('/:id/members', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be >= 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100'),
  query('role')
    .optional()
    .isIn(['owner', 'admin', 'mod', 'member'])
    .withMessage('Invalid role filter')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { page = 1, limit = 50, role } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Check clan exists
    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Build filter
    const filter = { clan: clanId };
    if (role) filter.role = role;

    // Fetch members
    const members = await ClanMember.find(filter)
      .populate('user', 'username email avatarUrl level')
      .sort({ role: 1, joinedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ClanMember.countDocuments(filter);

    console.log(`📊 Fetched ${members.length} members for clan ${clanId}`);

    res.json({
      success: true,
      data: {
        members: members.map(m => m.toObject()),
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
    console.error('❌ Error fetching members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET CLAN PRESENCE
// ============================================================================

/**
 * @route   GET /api/clans/:id/presence
 * @desc    Get accurate list of online users in clan
 * @access  Private
 */
router.get('/:id/presence', auth, async (req, res) => {
  try {
    const { id: clanId } = req.params;

    // Check if member
    const member = await ClanMember.findOne({ clan: clanId, user: req.user.userId });
    if (!member) {
      return res.json({ success: true, data: { onlineUserIds: [] } });
    }

    const io = req.app.get('io');
    const onlineUserIds = [];

    if (io) {
      const room = io.sockets.adapter.rooms.get(`clan-${clanId}`);
      if (room) {
        room.forEach((socketId) => {
          const s = io.sockets.sockets.get(socketId);
          if (s && s.userId) {
            onlineUserIds.push(s.userId.toString());
          }
        });
      }
    }

    // Filter duplicates just in case user has multiple tabs
    const uniqueUserIds = [...new Set(onlineUserIds)];

    return res.json({
      success: true,
      data: { onlineUserIds: uniqueUserIds },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching clan presence:', error);
    return res.json({ success: true, data: { onlineUserIds: [] } });
  }
});

// ============================================================================
// SEND CLAN MESSAGE
// ============================================================================

/**
 * @route   POST /api/clans/:id/messages
 * @desc    Send a message to clan chat
 * @access  Private (user must be clan member)
 */
router.post('/:id/messages', auth, [
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Message content is required')
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    // Verify user is a member of this clan
    const clanMember = await ClanMember.findOne({ clan: clanId, user: userId });
    if (!clanMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this clan',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user is muted
    if (clanMember.mutedUntil && new Date(clanMember.mutedUntil) > new Date()) {
      return res.status(403).json({
        success: false,
        message: `You are muted until ${new Date(clanMember.mutedUntil).toLocaleString()}`,
        timestamp: new Date().toISOString()
      });
    }

    // Get next sequence number
    const counter = await ClanCounter.findOneAndUpdate(
      { _id: clanId },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    // Create message
    const message = await ClanMessage.create({
      clan: clanId,
      sender: userId,
      content,
      seq: counter.seq
    });

    // Populate sender info
    await message.populate('sender', 'username avatarUrl level');

    // Emit via socket to all clan members
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('MESSAGE_NEW', {
        _id: message._id,
        clan: clanId,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt,
        seq: message.seq
      });
    }

    console.log(`💬 Message sent to clan ${clanId} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: { message: message.toObject() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error sending message:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET CLAN MESSAGES
// ============================================================================

/**
 * @route   GET /api/clans/:id/messages
 * @desc    Get paginated message history with cursor-based pagination
 * @access  Public
 */
router.get('/:id/messages', [
  query('before')
    .optional()
    .isInt({ min: 0 })
    .withMessage('before must be a valid sequence number'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { before, limit = 50 } = req.query;

    // Check clan exists
    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Build filter
    const filter = { clan: clanId, isDeleted: false };
    if (before) {
      filter.seq = { $lt: parseInt(before) };
    }

    // Fetch messages
    const messages = await ClanMessage.find(filter)
      .populate('sender', 'username avatarUrl level')
      .populate('replyTo', 'content sender')
      .sort({ seq: -1 })
      .limit(parseInt(limit));

    // Get total count
    const total = await ClanMessage.countDocuments({ clan: clanId, isDeleted: false });

    // Get next cursor (oldest message seq)
    const nextCursor = messages.length > 0 ? messages[messages.length - 1].seq : null;

    console.log(`📨 Fetched ${messages.length} messages for clan ${clanId}`);

    res.json({
      success: true,
      data: {
        messages: messages.reverse().map(m => m.toObject()),
        pagination: {
          limit: parseInt(limit),
          total,
          nextCursor,
          hasMore: nextCursor !== null && nextCursor > 0
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// PROMOTE/DEMOTE MEMBER
// ============================================================================

/**
 * @route   PUT /api/clans/:id/members/:memberId/role
 * @desc    Promote or demote member (admin/owner only)
 * @access  Private
 */
router.put('/:id/members/:memberId/role', auth, checkClanRole(['owner', 'admin']), [
  body('role')
    .isIn(['member', 'mod', 'admin'])
    .withMessage('Role must be member, mod, or admin')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user.userId;

    // Get current user's role
    const currentMember = await ClanMember.findOne({ clan: clanId, user: userId });
    if (!currentMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this clan',
        timestamp: new Date().toISOString()
      });
    }

    // Only owner can promote to admin
    if (role === 'admin' && currentMember.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only owner can promote to admin',
        timestamp: new Date().toISOString()
      });
    }

    // Get target member
    const targetMember = await ClanMember.findById(memberId);
    if (!targetMember || targetMember.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
        timestamp: new Date().toISOString()
      });
    }

    // Cannot demote owner
    if (targetMember.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot demote owner',
        timestamp: new Date().toISOString()
      });
    }

    const oldRole = targetMember.role;
    targetMember.role = role;
    await targetMember.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('ROLE_UPDATED', {
        userId: targetMember.user,
        oldRole,
        newRole: role,
        updatedBy: userId
      });
    }

    console.log(`✅ Member ${memberId} role changed from ${oldRole} to ${role}`);

    res.json({
      success: true,
      data: { member: targetMember.toObject() },
      message: `✅ Member role updated to ${role}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating member role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update member role',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// MUTE MEMBER
// ============================================================================

/**
 * @route   PUT /api/clans/:id/members/:memberId/mute
 * @desc    Mute member for specified duration (mod/admin/owner only)
 * @access  Private
 */
router.put('/:id/members/:memberId/mute', auth, checkClanRole(['owner', 'admin', 'mod']), [
  body('duration')
    .isInt({ min: 1, max: 10080 })
    .withMessage('Duration must be 1-10080 minutes (1 week max)')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId, memberId } = req.params;
    const { duration } = req.body;

    const targetMember = await ClanMember.findById(memberId);
    if (!targetMember || targetMember.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
        timestamp: new Date().toISOString()
      });
    }

    // Cannot mute owner
    if (targetMember.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot mute owner',
        timestamp: new Date().toISOString()
      });
    }

    // Set mute until time
    const muteUntil = new Date(Date.now() + duration * 60 * 1000);
    targetMember.mutedUntil = muteUntil;
    await targetMember.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('MEMBER_MUTED', {
        userId: targetMember.user,
        mutedUntil
      });
    }

    console.log(`🔇 Member ${memberId} muted until ${muteUntil}`);

    res.json({
      success: true,
      data: { member: targetMember.toObject() },
      message: `✅ Member muted for ${duration} minutes`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error muting member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mute member',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// REMOVE MEMBER
// ============================================================================

/**
 * @route   DELETE /api/clans/:id/members/:memberId
 * @desc    Remove member from clan (admin/owner only)
 * @access  Private
 */
router.delete('/:id/members/:memberId', auth, checkClanRole(['owner', 'admin']), async (req, res) => {
  try {
    const { id: clanId, memberId } = req.params;

    const targetMember = await ClanMember.findById(memberId);
    if (!targetMember || targetMember.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
        timestamp: new Date().toISOString()
      });
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove owner',
        timestamp: new Date().toISOString()
      });
    }

    const userId = targetMember.user;
    await ClanMember.findByIdAndDelete(memberId);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('MEMBER_REMOVED', {
        userId,
        removedAt: new Date()
      });
    }

    console.log(`✅ Member ${memberId} removed from clan ${clanId}`);

    res.json({
      success: true,
      message: '✅ Member removed from clan',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// BAN MEMBER
// ============================================================================

/**
 * @route   POST /api/clans/:id/bans
 * @desc    Ban member from clan (admin/owner only)
 * @access  Private
 */
router.post('/:id/bans', auth, checkClanRole(['owner', 'admin']), [
  body('userId')
    .notEmpty()
    .withMessage('userId is required'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { userId, reason } = req.body;

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if already banned
    if (clan.bannedUsers.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already banned',
        timestamp: new Date().toISOString()
      });
    }

    // Add to banned list
    clan.bannedUsers.push(userId);
    await clan.save();

    // Remove from members if exists
    await ClanMember.deleteOne({ clan: clanId, user: userId });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('MEMBER_BANNED', {
        userId,
        reason: reason || 'No reason provided',
        bannedAt: new Date()
      });
    }

    console.log(`🚫 User ${userId} banned from clan ${clanId}`);

    res.status(201).json({
      success: true,
      message: '✅ User banned from clan',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error banning user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ban user',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// UNBAN MEMBER
// ============================================================================

/**
 * @route   DELETE /api/clans/:id/bans/:userId
 * @desc    Unban member from clan (admin/owner only)
 * @access  Private
 */
router.delete('/:id/bans/:userId', auth, checkClanRole(['owner', 'admin']), async (req, res) => {
  try {
    const { id: clanId, userId } = req.params;

    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Remove from banned list
    clan.bannedUsers = clan.bannedUsers.filter(id => id.toString() !== userId);
    await clan.save();

    console.log(`✅ User ${userId} unbanned from clan ${clanId}`);

    res.json({
      success: true,
      message: '✅ User unbanned from clan',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error unbanning user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban user',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET BAN LIST
// ============================================================================

/**
 * @route   GET /api/clans/:id/bans
 * @desc    Get list of banned users (admin/owner only)
 * @access  Private
 */
router.get('/:id/bans', auth, checkClanRole(['owner', 'admin']), async (req, res) => {
  try {
    const { id: clanId } = req.params;

    const clan = await Clan.findById(clanId)
      .populate('bannedUsers', 'username email avatarUrl level');

    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📋 Fetched ban list for clan ${clanId}`);

    res.json({
      success: true,
      data: { bannedUsers: clan.bannedUsers },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching ban list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ban list',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// REPORT MESSAGE
// ============================================================================

/**
 * @route   POST /api/clans/:id/reports
 * @desc    Report a message (any member)
 * @access  Private
 */
router.post('/:id/reports', auth, checkClanRole(), [
  body('messageId')
    .notEmpty()
    .withMessage('messageId is required'),
  body('reason')
    .isIn(['spam', 'harassment', 'inappropriate', 'other'])
    .withMessage('Invalid report reason'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { messageId, reason, description } = req.body;
    const userId = req.user.userId;

    // Check message exists
    const message = await ClanMessage.findById(messageId);
    if (!message || message.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        timestamp: new Date().toISOString()
      });
    }

    // Create report
    const ClanReport = require('../models/ClanReport');
    const report = await ClanReport.create({
      clan: clanId,
      message: messageId,
      reportedBy: userId,
      reason,
      description: description || '',
      status: 'pending'
    });

    console.log(`📢 Message reported in clan ${clanId}`);

    res.status(201).json({
      success: true,
      data: { report: report.toObject() },
      message: '✅ Report submitted',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create report',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET REPORTS
// ============================================================================

/**
 * @route   GET /api/clans/:id/reports
 * @desc    Get pending reports (admin/owner only)
 * @access  Private
 */
router.get('/:id/reports', auth, checkClanRole(['owner', 'admin']), [
  query('status')
    .optional()
    .isIn(['pending', 'resolved', 'dismissed'])
    .withMessage('Invalid status filter'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be >= 1'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const ClanReport = require('../models/ClanReport');
    const reports = await ClanReport.find({ clan: clanId, status })
      .populate({
        path: 'message',
        select: 'content sender',
        populate: { path: 'sender', select: 'username avatarUrl' }
      })
      .populate('reportedBy', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ClanReport.countDocuments({ clan: clanId, status });

    console.log(`📋 Fetched ${reports.length} reports for clan ${clanId}`);

    res.json({
      success: true,
      data: {
        reports: reports.map(r => r.toObject()),
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
    console.error('❌ Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// HANDLE REPORT
// ============================================================================

/**
 * @route   PUT /api/clans/:id/reports/:reportId
 * @desc    Handle report - resolve or dismiss (admin/owner only)
 * @access  Private
 */
router.put('/:id/reports/:reportId', auth, checkClanRole(['owner', 'admin']), [
  body('action')
    .isIn(['resolve', 'dismiss', 'warn', 'ban'])
    .withMessage('Action must be resolve, dismiss, warn, or ban'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId, reportId } = req.params;
    const { action, notes } = req.body;

    const ClanReport = require('../models/ClanReport');
    const report = await ClanReport.findById(reportId);
    if (!report || report.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
        timestamp: new Date().toISOString()
      });
    }

    // Update report status
    report.status = action === 'resolve' ? 'resolved' : action === 'dismiss' ? 'dismissed' : 'resolved';
    report.handledBy = req.user.userId;
    report.handledAt = new Date();
    report.notes = notes || '';
    await report.save();

    // If ban action, ban the user
    if (action === 'ban') {
      const clan = await Clan.findById(clanId);
      const message = await ClanMessage.findById(report.message);
      if (message && !clan.bannedUsers.includes(message.sender)) {
        clan.bannedUsers.push(message.sender);
        await clan.save();
      }
    }

    console.log(`✅ Report ${reportId} handled with action: ${action}`);

    res.json({
      success: true,
      data: { report: report.toObject() },
      message: `✅ Report ${action}d`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error handling report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle report',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// PIN MESSAGE
// ============================================================================

/**
 * @route   POST /api/clans/:id/messages/:msgId/pin
 * @desc    Pin message (member/mod/admin/owner)
 * @access  Private
 */
router.post('/:id/messages/:msgId/pin', auth, checkClanRole(), async (req, res) => {
  try {
    const { id: clanId, msgId } = req.params;

    const message = await ClanMessage.findById(msgId);
    if (!message || message.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        timestamp: new Date().toISOString()
      });
    }

    message.isPinned = true;
    message.pinnedAt = new Date();
    await message.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('MESSAGE_PINNED', {
        messageId: msgId,
        pinnedAt: message.pinnedAt
      });
    }

    console.log(`📌 Message ${msgId} pinned in clan ${clanId}`);

    res.json({
      success: true,
      data: { message: message.toObject() },
      message: '✅ Message pinned',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error pinning message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pin message',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// DELETE MESSAGE
// ============================================================================

/**
 * @route   DELETE /api/clans/:id/messages/:msgId
 * @desc    Delete message (sender/mod/admin/owner)
 * @access  Private
 */
router.delete('/:id/messages/:msgId', auth, checkClanRole(), async (req, res) => {
  try {
    const { id: clanId, msgId } = req.params;
    const userId = req.user.userId;

    const message = await ClanMessage.findById(msgId);
    if (!message || message.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check permission
    const clanMember = await ClanMember.findOne({ clan: clanId, user: userId });
    const isOwner = message.sender.toString() === userId;
    const isMod = ['owner', 'admin', 'mod'].includes(clanMember?.role);

    if (!isOwner && !isMod) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete this message',
        timestamp: new Date().toISOString()
      });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;
    await message.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('MESSAGE_DELETED', {
        messageId: msgId,
        deletedAt: message.deletedAt
      });
    }

    console.log(`🗑️ Message ${msgId} deleted from clan ${clanId}`);

    res.json({
      success: true,
      message: '✅ Message deleted',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// ADD MESSAGE REACTION
// ============================================================================

/**
 * @route   POST /api/clans/:id/messages/:msgId/reactions
 * @desc    Add emoji reaction to message
 * @access  Private
 */
router.post('/:id/messages/:msgId/reactions', auth, checkClanRole(), [
  body('emoji')
    .notEmpty()
    .withMessage('emoji is required')
    .isLength({ max: 2 })
    .withMessage('emoji must be a single emoji')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId, msgId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;

    const message = await ClanMessage.findById(msgId);
    if (!message || message.clan.toString() !== clanId) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(r => r.emoji === emoji && r.users.includes(userId));
    if (existingReaction) {
      return res.status(400).json({
        success: false,
        message: 'You already reacted with this emoji',
        timestamp: new Date().toISOString()
      });
    }

    // Add or update reaction
    const reaction = message.reactions.find(r => r.emoji === emoji);
    if (reaction) {
      reaction.users.push(userId);
      reaction.count = reaction.users.length;
    } else {
      message.reactions.push({
        emoji,
        users: [userId],
        count: 1
      });
    }

    await message.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`clan-${clanId}`).emit('MESSAGE_REACTED', {
        messageId: msgId,
        emoji,
        userId,
        reactions: message.reactions
      });
    }

    console.log(`😊 Reaction ${emoji} added to message ${msgId}`);

    res.status(201).json({
      success: true,
      data: { message: message.toObject() },
      message: '✅ Reaction added',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error adding reaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add reaction',
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// DEBUG: Check user membership in clan
// ============================================================================

/**
 * @route   GET /api/clans/:id/debug/membership
 * @desc    Debug endpoint to check if current user is a member of the clan
 * @access  Private
 */
router.get('/:id/debug/membership', auth, async (req, res) => {
  try {
    const { id: clanId } = req.params;
    const userId = req.user.userId;

    console.log(`🔍 DEBUG: Checking membership for user ${userId} in clan ${clanId}`);

    // Check if clan exists
    const clan = await Clan.findById(clanId);
    if (!clan) {
      return res.status(404).json({
        success: false,
        message: 'Clan not found',
        timestamp: new Date().toISOString()
      });
    }

    // Check if user is a member
    const clanMember = await ClanMember.findOne({ clan: clanId, user: userId })
      .populate('user', 'username email _id');

    if (!clanMember) {
      // List all members for debugging
      const allMembers = await ClanMember.find({ clan: clanId })
        .populate('user', 'username email _id');

      return res.json({
        success: false,
        message: 'User is not a member of this clan',
        debug: {
          userId,
          clanId,
          userIdType: typeof userId,
          allMembers: allMembers.map(m => ({
            userId: m.user._id,
            userIdType: typeof m.user._id,
            username: m.user.username,
            role: m.role
          }))
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'User is a member of this clan',
      debug: {
        userId,
        clanId,
        userIdType: typeof userId,
        member: {
          userId: clanMember.user._id,
          userIdType: typeof clanMember.user._id,
          username: clanMember.user.username,
          role: clanMember.role,
          joinedAt: clanMember.joinedAt
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error checking membership:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check membership',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});


// ============================================================================
// CLAN ANNOUNCEMENTS
// ============================================================================

/**
 * @route   GET /api/clans/:id/announcements
 * @desc    Get all announcements for a clan
 * @access  Private (user must be clan member)
 */
router.get('/:id/announcements', auth, checkClanRole(), async (req, res) => {
  try {
    const { id: clanId } = req.params;

    const announcements = await ClanAnnouncement.find({ clanId })
      .populate('author', 'username avatarUrl')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: announcements || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching announcements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   POST /api/clans/:id/announcements
 * @desc    Create a new announcement (admin/owner only)
 * @access  Private
 */
router.post('/:id/announcements', auth, checkClanRole(['owner', 'admin']), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('content').trim().notEmpty().withMessage('Content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId } = req.params;
    const { title, content } = req.body;
    const userId = req.user.userId;

    const announcement = await ClanAnnouncement.create({
      clanId,
      title,
      content,
      author: userId
    });

    await announcement.populate('author', 'username avatarUrl');

    console.log(`📢 New announcement created in clan ${clanId}`);

    res.status(201).json({
      success: true,
      data: announcement,
      message: '🎉 Announcement posted successfully!',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   PATCH /api/clans/:id/announcements/:announcementId
 * @desc    Update an announcement (admin/owner only)
 * @access  Private
 */
router.patch('/:id/announcements/:announcementId', auth, checkClanRole(['owner', 'admin']), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('content').optional().trim().notEmpty().withMessage('Content cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { id: clanId, announcementId } = req.params;
    const { title, content } = req.body;

    const announcement = await ClanAnnouncement.findOneAndUpdate(
      { _id: announcementId, clanId },
      { $set: { title, content } },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📝 Announcement ${announcementId} updated in clan ${clanId}`);

    res.json({
      success: true,
      data: announcement,
      message: '✅ Announcement updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error updating announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   DELETE /api/clans/:id/announcements/:announcementId
 * @desc    Delete an announcement (admin/owner only)
 * @access  Private
 */
router.delete('/:id/announcements/:announcementId', auth, checkClanRole(['owner', 'admin']), async (req, res) => {
  try {
    const { id: clanId, announcementId } = req.params;

    const announcement = await ClanAnnouncement.findOneAndDelete({
      _id: announcementId,
      clanId
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🗑️ Announcement ${announcementId} deleted from clan ${clanId}`);

    res.json({
      success: true,
      message: '✅ Announcement deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error deleting announcement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;


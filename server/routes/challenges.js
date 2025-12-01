const express = require('express');
const Challenge = require('../models/Challenge');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/challenges
// @desc    Send challenge
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { opponentId, game, matchDetails } = req.body;
    const challengerId = req.user.userId;

    // Validation
    if (!opponentId || !game) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Opponent ID and game are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (challengerId === opponentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CHALLENGE',
          message: 'Cannot challenge yourself',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if opponent exists
    const [challenger, opponent] = await Promise.all([
      User.findById(challengerId),
      User.findById(opponentId)
    ]);

    if (!opponent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Opponent not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if they are friends
    const areFriends = challenger.friends && challenger.friends.some(
      friendId => friendId.toString() === opponentId
    );

    if (!areFriends) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_FRIENDS',
          message: 'You can only challenge your friends',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check for existing pending challenge
    const existingChallenge = await Challenge.findOne({
      challenger: challengerId,
      opponent: opponentId,
      status: 'pending'
    });

    if (existingChallenge) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CHALLENGE_EXISTS',
          message: 'You already have a pending challenge with this player',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create challenge
    const challenge = new Challenge({
      challenger: challengerId,
      opponent: opponentId,
      game,
      matchDetails: matchDetails || {},
      status: 'pending'
    });

    await challenge.save();

    // Create notification for opponent
    const notification = new Notification({
      user: opponentId,
      type: 'challenge',
      title: 'New Challenge!',
      message: `${challenger.username} challenged you to a ${game.toUpperCase()} match`,
      actionUrl: `/challenges/${challenge._id}`,
      isRead: false,
      metadata: {
        challengeId: challenge._id,
        game
      }
    });

    await notification.save();

    console.log(`⚔️ Challenge sent: ${challenger.username} → ${opponent.username} (${game})`);

    res.status(201).json({
      success: true,
      data: {
        challenge: {
          id: challenge._id,
          game: challenge.game,
          status: challenge.status,
          createdAt: challenge.createdAt
        }
      },
      message: 'Challenge sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error sending challenge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to send challenge',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/challenges
// @desc    Get user's challenges
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, type } = req.query;

    let query = {};

    // Filter by type (sent or received)
    if (type === 'sent') {
      query.challenger = userId;
    } else if (type === 'received') {
      query.opponent = userId;
    } else {
      // Both sent and received
      query.$or = [
        { challenger: userId },
        { opponent: userId }
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    const challenges = await Challenge.find(query)
      .populate('challenger', 'username avatarUrl level currentRank')
      .populate('opponent', 'username avatarUrl level currentRank')
      .sort({ createdAt: -1 })
      .lean();

    const formattedChallenges = challenges.map(challenge => ({
      id: challenge._id,
      challenger: {
        id: challenge.challenger._id,
        username: challenge.challenger.username,
        avatarUrl: challenge.challenger.avatarUrl,
        level: challenge.challenger.level,
        currentRank: challenge.challenger.currentRank
      },
      opponent: {
        id: challenge.opponent._id,
        username: challenge.opponent.username,
        avatarUrl: challenge.opponent.avatarUrl,
        level: challenge.opponent.level,
        currentRank: challenge.opponent.currentRank
      },
      game: challenge.game,
      status: challenge.status,
      matchDetails: challenge.matchDetails,
      result: challenge.result,
      createdAt: challenge.createdAt,
      acceptedAt: challenge.acceptedAt,
      completedAt: challenge.completedAt,
      expiresAt: challenge.expiresAt,
      isChallenger: challenge.challenger._id.toString() === userId
    }));

    res.json({
      success: true,
      data: { challenges: formattedChallenges },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching challenges:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch challenges',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/challenges/:id
// @desc    Get challenge details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const challenge = await Challenge.findById(id)
      .populate('challenger', 'username avatarUrl level currentRank')
      .populate('opponent', 'username avatarUrl level currentRank')
      .lean();

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Challenge not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user is part of this challenge
    if (challenge.challenger._id.toString() !== userId && 
        challenge.opponent._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'You are not authorized to view this challenge',
          timestamp: new Date().toISOString()
        }
      });
    }

    const formattedChallenge = {
      id: challenge._id,
      challenger: {
        id: challenge.challenger._id,
        username: challenge.challenger.username,
        avatarUrl: challenge.challenger.avatarUrl,
        level: challenge.challenger.level,
        currentRank: challenge.challenger.currentRank
      },
      opponent: {
        id: challenge.opponent._id,
        username: challenge.opponent.username,
        avatarUrl: challenge.opponent.avatarUrl,
        level: challenge.opponent.level,
        currentRank: challenge.opponent.currentRank
      },
      game: challenge.game,
      status: challenge.status,
      matchDetails: challenge.matchDetails,
      result: challenge.result,
      createdAt: challenge.createdAt,
      acceptedAt: challenge.acceptedAt,
      completedAt: challenge.completedAt,
      expiresAt: challenge.expiresAt,
      isChallenger: challenge.challenger._id.toString() === userId
    };

    res.json({
      success: true,
      data: { challenge: formattedChallenge },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching challenge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch challenge',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/challenges/:id/accept
// @desc    Accept challenge (opponent accepts, no room details needed)
// @access  Private
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const challenge = await Challenge.findById(id).populate('challenger opponent');

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Challenge not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Only opponent can accept
    if (challenge.opponent._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only the opponent can accept this challenge',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (challenge.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'This challenge has already been processed',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update challenge - just accept, no room details yet
    challenge.status = 'accepted';
    challenge.acceptedAt = new Date();

    await challenge.save();

    // Create notification for challenger to add room details
    const notification = new Notification({
      user: challenge.challenger._id,
      type: 'challenge',
      title: 'Challenge Accepted!',
      message: `${challenge.opponent.username} accepted your challenge! Please add room details.`,
      actionUrl: `/profile?tab=challenges`,
      isRead: false,
      metadata: {
        challengeId: challenge._id,
        game: challenge.game
      }
    });

    await notification.save();

    console.log(`✅ Challenge accepted: ${challenge.opponent.username} accepted ${challenge.challenger.username}'s challenge`);

    res.json({
      success: true,
      message: 'Challenge accepted successfully. Waiting for room details from challenger.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error accepting challenge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to accept challenge',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/challenges/:id/room-details
// @desc    Add room details (challenger only)
// @access  Private
router.post('/:id/room-details', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomId, password } = req.body;
    const userId = req.user.userId;

    if (!roomId || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Room ID and password are required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const challenge = await Challenge.findById(id).populate('challenger opponent');

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Challenge not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Only challenger can add room details
    if (challenge.challenger._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only the challenger can add room details',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (challenge.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Challenge must be accepted first',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Update room details
    challenge.matchDetails.roomId = roomId;
    challenge.matchDetails.password = password;

    await challenge.save();

    // Notify opponent that room is ready
    const notification = new Notification({
      user: challenge.opponent._id,
      type: 'challenge',
      title: 'Room Details Available!',
      message: `${challenge.challenger.username} added room details. Match is ready!`,
      actionUrl: `/profile?tab=challenges`,
      isRead: false,
      metadata: {
        challengeId: challenge._id,
        game: challenge.game
      }
    });

    await notification.save();

    console.log(`🎮 Room details added for challenge: ${challenge._id}`);

    res.json({
      success: true,
      message: 'Room details added successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error adding room details:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to add room details',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/challenges/:id/decline
// @desc    Decline challenge
// @access  Private
router.post('/:id/decline', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const challenge = await Challenge.findById(id).populate('challenger opponent');

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Challenge not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Only opponent can decline
    if (challenge.opponent._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only the opponent can decline this challenge',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (challenge.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'This challenge has already been processed',
          timestamp: new Date().toISOString()
        }
      });
    }

    challenge.status = 'declined';
    await challenge.save();

    // Create notification for challenger
    const notification = new Notification({
      user: challenge.challenger._id,
      type: 'challenge',
      title: 'Challenge Declined',
      message: `${challenge.opponent.username} declined your challenge`,
      actionUrl: `/challenges`,
      isRead: false
    });

    await notification.save();

    console.log(`❌ Challenge declined: ${challenge.opponent.username} declined ${challenge.challenger.username}'s challenge`);

    res.json({
      success: true,
      message: 'Challenge declined',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error declining challenge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to decline challenge',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/challenges/:id/cancel
// @desc    Cancel challenge
// @access  Private
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const challenge = await Challenge.findById(id).populate('challenger opponent');

    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Challenge not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Only challenger can cancel
    if (challenge.challenger._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Only the challenger can cancel this challenge',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (challenge.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Cannot cancel a completed challenge',
          timestamp: new Date().toISOString()
        }
      });
    }

    challenge.status = 'cancelled';
    await challenge.save();

    // Create notification for opponent if challenge was accepted
    if (challenge.status === 'accepted') {
      const notification = new Notification({
        user: challenge.opponent._id,
        type: 'challenge',
        title: 'Challenge Cancelled',
        message: `${challenge.challenger.username} cancelled the challenge`,
        actionUrl: `/challenges`,
        isRead: false
      });

      await notification.save();
    }

    console.log(`🚫 Challenge cancelled: ${challenge.challenger.username} cancelled challenge`);

    res.json({
      success: true,
      message: 'Challenge cancelled',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error cancelling challenge:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to cancel challenge',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;

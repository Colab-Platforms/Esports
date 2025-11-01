const express = require('express');
const auth = require('../middleware/auth');
const LeaderboardService = require('../services/leaderboardService');
const Leaderboard = require('../models/Leaderboard');

const router = express.Router();

// @route   GET /api/leaderboard
// @desc    Get leaderboard data with filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      gameType = 'bgmi',
      leaderboardType = 'overall',
      tournamentId,
      page = 1,
      limit = 50
    } = req.query;

    const result = await LeaderboardService.getLeaderboard({
      gameType,
      leaderboardType,
      tournamentId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result,
      message: 'Leaderboard retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LEADERBOARD_FETCH_FAILED',
        message: 'Failed to fetch leaderboard',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/leaderboard/user/:userId
// @desc    Get user's position in leaderboard
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      gameType = 'bgmi',
      leaderboardType = 'overall',
      tournamentId
    } = req.query;

    const userPosition = await LeaderboardService.getUserPosition(
      userId,
      gameType,
      leaderboardType,
      tournamentId
    );

    if (!userPosition) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found in leaderboard',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: { userPosition },
      message: 'User position retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('User position fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_POSITION_FAILED',
        message: 'Failed to fetch user position',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/leaderboard/me
// @desc    Get current user's position in leaderboard
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const {
      gameType = 'bgmi',
      leaderboardType = 'overall',
      tournamentId
    } = req.query;

    const userPosition = await LeaderboardService.getUserPosition(
      req.user.id,
      gameType,
      leaderboardType,
      tournamentId
    );

    res.json({
      success: true,
      data: { userPosition },
      message: 'User position retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('User position fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_POSITION_FAILED',
        message: 'Failed to fetch user position',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/leaderboard/top-performers
// @desc    Get top performers for a specific period
// @access  Public
router.get('/top-performers', async (req, res) => {
  try {
    const {
      gameType = 'bgmi',
      leaderboardType = 'overall',
      limit = 10
    } = req.query;

    const topPerformers = await LeaderboardService.getTopPerformers({
      gameType,
      leaderboardType,
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: { topPerformers },
      message: 'Top performers retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Top performers fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOP_PERFORMERS_FAILED',
        message: 'Failed to fetch top performers',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/leaderboard/stats
// @desc    Get leaderboard statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const stats = await LeaderboardService.getLeaderboardStats();

    res.json({
      success: true,
      data: { stats },
      message: 'Leaderboard statistics retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Leaderboard stats fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LEADERBOARD_STATS_FAILED',
        message: 'Failed to fetch leaderboard statistics',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/leaderboard/initialize
// @desc    Initialize leaderboards from existing matches (Admin only)
// @access  Private
router.post('/initialize', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only administrators can initialize leaderboards',
          timestamp: new Date().toISOString()
        }
      });
    }

    await LeaderboardService.initializeLeaderboards();

    res.json({
      success: true,
      data: { message: 'Leaderboards initialized successfully' },
      message: 'Leaderboard initialization completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Leaderboard initialization error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LEADERBOARD_INIT_FAILED',
        message: 'Failed to initialize leaderboards',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/leaderboard/update-rankings
// @desc    Update rankings for a specific game type (Admin only)
// @access  Private
router.post('/update-rankings', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only administrators can update rankings',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { gameType, tournamentId } = req.body;

    if (!gameType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GAME_TYPE',
          message: 'Game type is required',
          timestamp: new Date().toISOString()
        }
      });
    }

    await LeaderboardService.updateAllRankings(gameType, tournamentId);

    res.json({
      success: true,
      data: { message: 'Rankings updated successfully' },
      message: 'Ranking update completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ranking update error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RANKING_UPDATE_FAILED',
        message: 'Failed to update rankings',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   DELETE /api/leaderboard/cleanup
// @desc    Clean up old leaderboard entries (Admin only)
// @access  Private
router.delete('/cleanup', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only administrators can cleanup leaderboards',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { monthsToKeep = 6 } = req.query;
    const deletedCount = await LeaderboardService.cleanupOldLeaderboards(parseInt(monthsToKeep));

    res.json({
      success: true,
      data: { deletedCount },
      message: 'Leaderboard cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Leaderboard cleanup error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LEADERBOARD_CLEANUP_FAILED',
        message: 'Failed to cleanup leaderboards',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
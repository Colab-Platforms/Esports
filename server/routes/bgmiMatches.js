const express = require('express');
const router = express.Router();
const BGMIMatch = require('../models/BGMIMatch');
const BGMILeaderboard = require('../models/BGMILeaderboard');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'uploads/bgmi-screenshots';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
    }
  }
});

// Create match (Admin only)
router.post('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create matches'
      });
    }
    
    const match = new BGMIMatch(req.body);
    await match.save();
    
    res.json({
      success: true,
      data: { match },
      message: 'Match created successfully'
    });
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating match'
    });
  }
});

// Get match details
router.get('/:matchId', async (req, res) => {
  try {
    const match = await BGMIMatch.findById(req.params.matchId)
      .populate('tournamentId')
      .populate('teamResults.teamId');
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    res.json({
      success: true,
      data: { match }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching match'
    });
  }
});

// Upload screenshot
router.post('/:matchId/screenshot', auth, upload.single('screenshot'), async (req, res) => {
  try {
    const match = await BGMIMatch.findById(req.params.matchId);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    const { teamId } = req.body;
    
    // Find or create team result
    let teamResult = match.teamResults.find(
      t => t.teamId && t.teamId.toString() === teamId
    );
    
    if (!teamResult) {
      teamResult = {
        teamId,
        screenshots: []
      };
      match.teamResults.push(teamResult);
    }
    
    // Add screenshot
    teamResult.screenshots.push({
      url: `/uploads/bgmi-screenshots/${req.file.filename}`,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    });
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Screenshot uploaded successfully',
      data: {
        screenshotUrl: `/uploads/bgmi-screenshots/${req.file.filename}`
      }
    });
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading screenshot'
    });
  }
});

// Submit result
router.post('/:matchId/submit-result', auth, async (req, res) => {
  try {
    const { teamId, teamName, placement, kills } = req.body;
    const match = await BGMIMatch.findById(req.params.matchId);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    // Calculate points
    const points = match.calculatePoints(parseInt(placement), parseInt(kills));
    
    // Find or update team result
    let teamResult = match.teamResults.find(
      t => t.teamId && t.teamId.toString() === teamId
    );
    
    if (teamResult) {
      teamResult.placement = parseInt(placement);
      teamResult.kills = parseInt(kills);
      teamResult.points = points;
      teamResult.submittedAt = new Date();
    } else {
      match.teamResults.push({
        teamId,
        teamName,
        placement: parseInt(placement),
        kills: parseInt(kills),
        points,
        submittedAt: new Date()
      });
    }
    
    await match.save();
    
    res.json({
      success: true,
      message: 'Result submitted successfully. Waiting for admin verification.',
      data: { points }
    });
  } catch (error) {
    console.error('Error submitting result:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting result'
    });
  }
});

// Verify result (Admin only)
router.post('/:matchId/verify/:teamId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can verify results'
      });
    }
    
    const match = await BGMIMatch.findById(req.params.matchId);
    const teamResult = match.teamResults.find(
      t => t.teamId && t.teamId.toString() === req.params.teamId
    );
    
    if (!teamResult) {
      return res.status(404).json({
        success: false,
        message: 'Team result not found'
      });
    }
    
    teamResult.verified = true;
    teamResult.verifiedBy = req.user.id;
    teamResult.verifiedAt = new Date();
    
    await match.save();
    
    // Update leaderboard
    await updateLeaderboard(match.tournamentId, teamResult, match.matchNumber);
    
    // Clear cache and recalculate ranks asynchronously (non-blocking)
    try {
      const redisService = require('../services/redisService');
      await redisService.del(`bgmi-leaderboard:${match.tournamentId}`);
    } catch (err) {
      console.warn('Failed to clear cache');
    }
    
    // Run rank recalculation in background
    recalculateRanks(match.tournamentId).catch(err => 
      console.error('Background rank recalculation failed:', err)
    );
    
    res.json({
      success: true,
      message: 'Result verified and leaderboard updated'
    });
  } catch (error) {
    console.error('Error verifying result:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying result'
    });
  }
});

// Get leaderboard
router.get('/tournament/:tournamentId/leaderboard', async (req, res) => {
  try {
    const cacheKey = `bgmi-leaderboard:${req.params.tournamentId}`;
    
    // Try Redis cache first
    try {
      const redisService = require('../services/redisService');
      const cached = await redisService.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: { leaderboard: JSON.parse(cached) },
          cached: true
        });
      }
    } catch (err) {
      console.warn('Redis unavailable, querying database');
    }
    
    // Query with lean() for performance
    const leaderboard = await BGMILeaderboard.find({
      tournamentId: req.params.tournamentId
    })
      .sort({ totalPoints: -1 })
      .lean()
      .exec();
    
    // Add ranks
    const ranked = leaderboard.map((entry, index) => ({
      ...entry,
      currentRank: index + 1
    }));
    
    // Cache for 5 minutes
    try {
      const redisService = require('../services/redisService');
      await redisService.setex(cacheKey, 300, JSON.stringify(ranked));
    } catch (err) {
      console.warn('Failed to cache leaderboard');
    }
    
    res.json({
      success: true,
      data: { leaderboard: ranked },
      cached: false
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leaderboard'
    });
  }
});

// Helper function to update leaderboard
async function updateLeaderboard(tournamentId, teamResult, matchNumber) {
  try {
    let leaderboardEntry = await BGMILeaderboard.findOne({
      tournamentId,
      teamId: teamResult.teamId
    });
    
    if (!leaderboardEntry) {
      leaderboardEntry = new BGMILeaderboard({
        tournamentId,
        teamId: teamResult.teamId,
        teamName: teamResult.teamName,
        matchHistory: []
      });
    }
    
    // Update stats
    leaderboardEntry.totalPoints += teamResult.points;
    leaderboardEntry.totalKills += teamResult.kills;
    leaderboardEntry.matchesPlayed += 1;
    
    // Update best performance
    if (!leaderboardEntry.bestPlacement || teamResult.placement < leaderboardEntry.bestPlacement) {
      leaderboardEntry.bestPlacement = teamResult.placement;
    }
    if (!leaderboardEntry.highestKills || teamResult.kills > leaderboardEntry.highestKills) {
      leaderboardEntry.highestKills = teamResult.kills;
    }
    
    // Add to match history
    leaderboardEntry.matchHistory.push({
      matchNumber,
      placement: teamResult.placement,
      kills: teamResult.kills,
      points: teamResult.points,
      playedAt: new Date()
    });
    
    leaderboardEntry.lastUpdated = new Date();
    
    await leaderboardEntry.save();
    
    // Recalculate all ranks
    await recalculateRanks(tournamentId);
    
  } catch (error) {
    console.error('Error updating leaderboard:', error);
    throw error;
  }
}

// Recalculate ranks for all teams - using bulk operations
async function recalculateRanks(tournamentId) {
  const entries = await BGMILeaderboard.find({ tournamentId })
    .sort({ totalPoints: -1 })
    .lean();
  
  const bulkOps = entries.map((entry, index) => ({
    updateOne: {
      filter: { _id: entry._id },
      update: {
        $set: {
          previousRank: entry.currentRank || 0,
          currentRank: index + 1
        }
      }
    }
  }));
  
  if (bulkOps.length > 0) {
    await BGMILeaderboard.bulkWrite(bulkOps);
  }
}

module.exports = router;

const express = require('express');
const router = express.Router();
const BGMIMatch = require('../models/BGMIMatch');
const BGMILeaderboard = require('../models/BGMILeaderboard');
const auth = require('../middleware/auth');
const results = require('../features/game-results/bgmi-result.service');
const { filterPublicTeams } = require('../features/game-results/public-result-privacy');
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
    
    const match = await results.createMatch(req.body);
    
    res.json({
      success: true,
      data: { match },
      message: 'Match created successfully'
    });
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Error creating match'
    });
  }
});

// Get match details
router.get('/:matchId', async (req, res) => {
  try {
    const match = await BGMIMatch.findById(req.params.matchId)
      .select('tournamentId matchNumber map status scheduledTime startTime endTime totalTeams winner teamResults')
      .populate('tournamentId', 'name gameType status startDate endDate')
      .lean();
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }
    
    match.teamResults = await filterPublicTeams((match.teamResults || []).filter(row => row.verified).map(row => ({
      teamId: row.teamId, teamName: row.teamName, placement: row.placement,
      kills: row.kills, points: row.points, verified: true, verifiedAt: row.verifiedAt
    })), 'teamId');
    res.json({
      success: true,
      data: { match }
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      message: 'Error fetching match'
    });
  }
});

// Upload screenshot
router.post('/:matchId/screenshot', auth, upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Screenshot required' });
    await results.mutateResult({ matchId: req.params.matchId, teamId: req.body.teamId, actor: req.user,
      screenshot: { url: `/uploads/bgmi-screenshots/${req.file.filename}`, uploadedBy: req.user.id, uploadedAt: new Date() } });

    res.json({
      success: true,
      message: 'Screenshot uploaded successfully',
      data: {
        screenshotUrl: `/uploads/bgmi-screenshots/${req.file.filename}`
      }
    });
  } catch (error) {
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    console.error('Error uploading screenshot:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Error uploading screenshot'
    });
  }
});

// Submit result
router.post('/:matchId/submit-result', auth, async (req, res) => {
  try {
    const { points } = await results.mutateResult({ matchId: req.params.matchId, teamId: req.body.teamId,
      actor: req.user, payload: req.body });

    res.json({
      success: true,
      message: 'Result submitted successfully. Waiting for admin verification.',
      data: { points }
    });
  } catch (error) {
    console.error('Error submitting result:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error submitting result'
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
    
    await results.mutateResult({ matchId: req.params.matchId, teamId: req.params.teamId, actor: req.user, verify: true });

    res.json({
      success: true,
      message: 'Result verified and leaderboard updated'
    });
  } catch (error) {
    console.error('Error verifying result:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Error verifying result'
    });
  }
});

// Get leaderboard
router.get('/tournament/:tournamentId/leaderboard', async (req, res) => {
  try {
    
    // Query with lean() for performance
    const leaderboard = await BGMILeaderboard.find({
      tournamentId: req.params.tournamentId
    })
      .sort({ totalPoints: -1 })
      .lean()
      .exec();
    
    // Add ranks
    const ranked = await filterPublicTeams(leaderboard.map((entry, index) => ({
      ...entry,
      currentRank: index + 1
    })), 'teamId');
    
    res.json({
      success: true,
      data: { leaderboard: ranked },
      cached: false
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(error.status || 500).json({
      success: false,
      message: 'Error fetching leaderboard'
    });
  }
});

module.exports = router;

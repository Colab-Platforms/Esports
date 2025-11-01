const express = require('express');
const auth = require('../middleware/auth');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
const RoomGenerator = require('../services/roomGenerator');
const fileUpload = require('../services/fileUpload');

const router = express.Router();

// @route   GET /api/matches
// @desc    Get matches for user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, gameType, limit = 20, page = 1 } = req.query;
    
    const options = {};
    if (status) options.status = status;
    if (gameType) options.gameType = gameType;
    
    const matches = await Match.getMatchesForUser(req.user.id, options)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.json({
      success: true,
      data: { 
        matches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: matches.length
        }
      },
      message: 'Matches retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Match fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MATCH_FETCH_FAILED',
        message: 'Failed to fetch matches',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/matches/:id
// @desc    Get specific match details
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('participants.userId', 'username avatarUrl')
      .populate('tournamentId', 'name gameType entryFee prizePool')
      .populate('createdBy', 'username');
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Check if user is participant or admin
    const isParticipant = match.participants.some(p => p.userId._id.toString() === req.user.id);
    const isAdmin = req.user.role === 'admin';
    
    if (!isParticipant && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You are not authorized to view this match',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    res.json({
      success: true,
      data: { match },
      message: 'Match details retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Match details fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MATCH_DETAILS_FAILED',
        message: 'Failed to fetch match details',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/matches
// @desc    Create a new match (Admin only)
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only administrators can create matches',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const {
      tournamentId,
      roundNumber,
      matchNumber,
      scheduledAt,
      participants,
      matchSettings
    } = req.body;
    
    // Validate tournament exists
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
    
    // Create match
    const match = new Match({
      tournamentId,
      roundNumber,
      matchNumber,
      scheduledAt: new Date(scheduledAt),
      gameType: tournament.gameType,
      participants: participants || [],
      matchSettings: matchSettings || {},
      createdBy: req.user.id
    });
    
    // Generate room credentials
    await match.generateRoomCredentials();
    
    await match.save();
    
    res.status(201).json({
      success: true,
      data: { match },
      message: 'Match created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Match creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MATCH_CREATION_FAILED',
        message: 'Failed to create match',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/matches/:id/room-credentials
// @desc    Generate new room credentials for a match
// @access  Private (Admin or participants)
router.put('/:id/room-credentials', auth, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Check if user is participant or admin
    const isParticipant = match.participants.some(p => p.userId.toString() === req.user.id);
    const isAdmin = req.user.role === 'admin';
    
    if (!isParticipant && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You are not authorized to generate room credentials',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Generate new room credentials
    await match.generateRoomCredentials();
    
    res.json({
      success: true,
      data: { 
        roomId: match.roomId,
        roomPassword: match.roomPassword,
        serverDetails: match.serverDetails
      },
      message: 'Room credentials generated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Room credentials generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ROOM_CREDENTIALS_FAILED',
        message: 'Failed to generate room credentials',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/matches/:id/start
// @desc    Start a match
// @access  Private (Admin only)
router.post('/:id/start', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only administrators can start matches',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    await match.startMatch();
    
    res.json({
      success: true,
      data: { match },
      message: 'Match started successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Match start error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MATCH_START_FAILED',
        message: error.message || 'Failed to start match',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/matches/:id/submit-result
// @desc    Submit match result
// @access  Private
router.post('/:id/submit-result', auth, async (req, res) => {
  try {
    const { kills, deaths, assists, finalPosition } = req.body;
    
    // Validate required fields
    if (kills === undefined || deaths === undefined || assists === undefined || finalPosition === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RESULT_DATA',
          message: 'Kills, deaths, assists, and final position are required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Check if match is active
    if (match.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MATCH_NOT_ACTIVE',
          message: 'Can only submit results for active matches',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const resultData = {
      kills: parseInt(kills),
      deaths: parseInt(deaths),
      assists: parseInt(assists),
      finalPosition: parseInt(finalPosition)
    };
    
    await match.submitResult(req.user.id, resultData);
    
    // Check if all results are submitted and complete match
    if (match.allResultsSubmitted) {
      await match.completeMatch();
    }
    
    res.json({
      success: true,
      data: { match },
      message: 'Result submitted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Result submission error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESULT_SUBMISSION_FAILED',
        message: error.message || 'Failed to submit result',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/matches/:id/upload-screenshot
// @desc    Upload screenshot for match result
// @access  Private
router.post('/:id/upload-screenshot', auth, fileUpload.getScreenshotUpload().single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'Screenshot file is required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Find participant
    const participant = match.participants.find(p => p.userId.toString() === req.user.id);
    
    if (!participant) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'You are not a participant in this match',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Update participant's screenshot URL
    participant.screenshotUrl = fileUpload.getFileUrl(req.file.filename, 'screenshots');
    
    await match.save();
    
    res.json({
      success: true,
      data: { 
        screenshotUrl: participant.screenshotUrl,
        filename: req.file.filename
      },
      message: 'Screenshot uploaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Screenshot upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCREENSHOT_UPLOAD_FAILED',
        message: 'Failed to upload screenshot',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/matches/:id/upload-server-log
// @desc    Upload server log for match (CS2 matches)
// @access  Private (Admin only)
router.post('/:id/upload-server-log', auth, fileUpload.getServerLogUpload().single('serverLog'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only administrators can upload server logs',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_UPLOADED',
          message: 'Server log file is required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Update match server log URL
    match.serverLogUrl = fileUpload.getFileUrl(req.file.filename, 'server-logs');
    
    await match.save();
    
    res.json({
      success: true,
      data: { 
        serverLogUrl: match.serverLogUrl,
        filename: req.file.filename
      },
      message: 'Server log uploaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Server log upload error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_LOG_UPLOAD_FAILED',
        message: 'Failed to upload server log',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   POST /api/matches/:id/dispute
// @desc    Create a dispute for a match
// @access  Private
router.post('/:id/dispute', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DISPUTE_REASON',
          message: 'Dispute reason must be at least 10 characters long',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Check if user is participant
    const isParticipant = match.participants.some(p => p.userId.toString() === req.user.id);
    
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'NOT_PARTICIPANT',
          message: 'Only participants can create disputes',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    await match.createDispute(req.user.id, reason.trim());
    
    res.json({
      success: true,
      data: { match },
      message: 'Dispute created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dispute creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DISPUTE_CREATION_FAILED',
        message: error.message || 'Failed to create dispute',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   PUT /api/matches/:id/resolve-dispute
// @desc    Resolve a match dispute (Admin only)
// @access  Private
router.put('/:id/resolve-dispute', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Only administrators can resolve disputes',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const { resolution, adminNotes } = req.body;
    
    if (!resolution || !['resolved', 'rejected'].includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RESOLUTION',
          message: 'Resolution must be either "resolved" or "rejected"',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const match = await Match.findById(req.params.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MATCH_NOT_FOUND',
          message: 'Match not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    await match.resolveDispute(req.user.id, resolution, adminNotes || '');
    
    res.json({
      success: true,
      data: { match },
      message: 'Dispute resolved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Dispute resolution error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DISPUTE_RESOLUTION_FAILED',
        message: error.message || 'Failed to resolve dispute',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/matches/tournament/:tournamentId
// @desc    Get matches for a specific tournament
// @access  Private
router.get('/tournament/:tournamentId', auth, async (req, res) => {
  try {
    const { roundNumber, status } = req.query;
    
    const options = {};
    if (roundNumber) options.roundNumber = parseInt(roundNumber);
    if (status) options.status = status;
    
    const matches = await Match.getMatchesForTournament(req.params.tournamentId, options);
    
    res.json({
      success: true,
      data: { matches },
      message: 'Tournament matches retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Tournament matches fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOURNAMENT_MATCHES_FAILED',
        message: 'Failed to fetch tournament matches',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
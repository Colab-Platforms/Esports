const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Configure multer for video upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/tournament-videos');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: tournamentId_timestamp_originalname
    const tournamentId = req.params.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${tournamentId}_${timestamp}_${sanitizedBasename}${ext}`);
  }
});

// File filter - only accept video files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only video files are allowed (MP4, MOV, AVI, MKV)'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max file size
  }
});

// @route   POST /api/tournaments/:id/distribute-rewards
// @desc    Distribute coins to winner teams and participation rewards
// @access  Admin only
router.post('/:id/distribute-rewards', auth, adminAuth, async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const { winners, participationReward } = req.body;
    
    // Validation
    if (!winners || !Array.isArray(winners) || winners.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Winners array is required with at least one winner'
      });
    }
    
    // Validate each winner
    for (const winner of winners) {
      if (!winner.teamId || !winner.position || !winner.amount) {
        return res.status(400).json({
          success: false,
          error: 'Each winner must have teamId, position, and amount'
        });
      }
      
      if (winner.amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Reward amount must be greater than 0'
        });
      }
    }
    
    // Validate participation reward
    if (participationReward && participationReward < 0) {
      return res.status(400).json({
        success: false,
        error: 'Participation reward cannot be negative'
      });
    }
    
    // Find tournament
    const tournament = await Tournament.findById(tournamentId);
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Check if rewards already distributed
    if (tournament.rewardDistribution.rewardsDistributed) {
      return res.status(400).json({
        success: false,
        error: 'Rewards have already been distributed for this tournament'
      });
    }
    
    const TournamentRegistration = require('../models/TournamentRegistration');
    
    // Get all registered teams for this tournament
    let allTeams = [];
    if (tournament.gameType === 'bgmi' || tournament.gameType === 'freefire') {
      allTeams = await TournamentRegistration.find({
        tournamentId: tournamentId,
        status: { $in: ['pending', 'images_uploaded', 'verified'] }
      }).populate('userId', 'username email');
    } else {
      allTeams = await Team.find({
        game: tournament.gameType,
        isActive: true
      }).populate('members.userId', 'username email');
    }
    
    console.log(`💰 Starting reward distribution for ${tournament.name}:`, {
      tournamentId,
      totalTeams: allTeams.length,
      winners: winners.length,
      participationReward: participationReward || 0
    });
    
    const allRecipients = [];
    const errors = [];
    const winnerTeamIds = winners.map(w => w.teamId);
    
    // Helper function to distribute coins to a team
    const distributeToTeam = async (recipientId, amount, position = null) => {
      let teamMembers = [];
      let teamName = '';
      
      if (tournament.gameType === 'bgmi' || tournament.gameType === 'freefire') {
        const registration = await TournamentRegistration.findById(recipientId)
          .populate('userId', 'username email');
        
        if (!registration) {
          throw new Error(`Team registration ${recipientId} not found`);
        }
        
        teamName = registration.teamName;
        teamMembers = [registration.userId];
        
      } else {
        // Find participant by ID or check if it's a Team model entry
        const participant = tournament.participants?.id(recipientId);
        
        if (participant) {
          // If we found a direct participant ID
          teamName = participant.teamName || `Solo: ${participant.userId.username || 'User'}`;
          
          // Populate the userId manually if it was just an ID
          const User = require('../models/User');
          const userObj = await User.findById(participant.userId).select('username email');
          if (userObj) {
            teamMembers = [userObj];
          }
        } else {
          // Fallback for older entries/Team model
          const team = await Team.findById(recipientId).populate('members.userId', 'username email');
          if (!team) {
            throw new Error(`Recipient ${recipientId} not found in participants or teams`);
          }
          teamName = team.name;
          teamMembers = team.members.map(m => m.userId);
        }
      }
      
      // Distribute to each member
      console.log(`👥 Processing ${teamMembers.length} members for team: ${teamName}`);
      
      for (const member of teamMembers) {
        try {
          if (!member || !member._id) {
            console.warn(`⚠️ Skipping invalid member in team ${teamName}`);
            continue;
          }

          let wallet = await Wallet.findOne({ userId: member._id });
          if (!wallet) {
            wallet = new Wallet({ userId: member._id });
          }
          
          const description = position 
            ? `Tournament ${position} Place - ${tournament.name}`
            : `Tournament Participation - ${tournament.name}`;
          
          await wallet.addCoins(
            amount,
            'earn',
            description,
            {
              source: 'tournament_reward',
              tournamentId: tournament._id,
              teamId: recipientId,
              teamName: teamName,
              position: position || 'participation'
            }
          );
          
          const lastTransaction = wallet.transactions[wallet.transactions.length - 1]; // Fixed: Wallet uses 'transactions'
          
          allRecipients.push({
            userId: member._id,
            username: member.username || 'Unknown',
            teamId: recipientId,
            teamName: teamName,
            amount: amount,
            position: position || 'participation',
            transactionId: lastTransaction?._id?.toString() || 'manual'
          });
          
          console.log(`✅ ${amount} coins → ${member.username || member._id} (${teamName}) - ${position || 'Participation'}`);
          
        } catch (error) {
          console.error(`❌ Error distributing to ${member.username}:`, error);
          errors.push({
            userId: member._id,
            username: member.username,
            teamName: teamName,
            error: error.message
          });
        }
      }
    };
    
    // 1. Distribute to winners (1st, 2nd, 3rd, etc.)
    for (const winner of winners) {
      try {
        await distributeToTeam(winner.teamId, winner.amount, winner.position);
      } catch (error) {
        console.error(`❌ Error distributing to winner ${winner.position}:`, error);
        errors.push({
          teamId: winner.teamId,
          position: winner.position,
          error: error.message
        });
      }
    }
    
    // 2. Distribute participation rewards to all other teams
    if (participationReward && participationReward > 0) {
      for (const team of allTeams) {
        const teamId = team._id.toString();
        
        // Skip if this team is already a winner
        if (winnerTeamIds.includes(teamId)) {
          continue;
        }
        
        try {
          await distributeToTeam(teamId, participationReward);
        } catch (error) {
          console.error(`❌ Error distributing participation reward:`, error);
          errors.push({
            teamId: teamId,
            error: error.message
          });
        }
      }
    }
    
    // Calculate totals
    const totalCoinsDistributed = allRecipients.reduce((sum, r) => sum + r.amount, 0);
    const winnerCount = allRecipients.filter(r => r.position !== 'participation').length;
    const participationCount = allRecipients.filter(r => r.position === 'participation').length;
    
    // Update tournament with reward distribution info
    tournament.rewardDistribution = {
      winners: winners.map(w => ({
        teamId: w.teamId,
        position: w.position,
        amount: w.amount
      })),
      participationReward: participationReward || 0,
      rewardsDistributed: true,
      distributedAt: new Date(),
      distributedBy: req.user.userId,
      recipients: allRecipients.map(r => ({
        userId: r.userId,
        teamId: r.teamId,
        amount: r.amount,
        position: r.position,
        transactionId: r.transactionId
      }))
    };
    
    await tournament.save();
    
    // Prepare response
    const response = {
      success: true,
      message: `Rewards distributed successfully to ${allRecipients.length} recipients`,
      data: {
        tournamentId: tournamentId,
        tournamentName: tournament.name,
        totalCoinsDistributed: totalCoinsDistributed,
        winners: {
          count: winnerCount,
          teams: winners.length
        },
        participation: {
          count: participationCount,
          rewardPerPerson: participationReward || 0
        },
        recipients: allRecipients
      }
    };
    
    if (errors.length > 0) {
      response.warnings = {
        message: `${errors.length} distributions failed`,
        errors: errors
      };
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('Error distributing rewards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to distribute rewards',
      details: error.message
    });
  }
});

// @route   GET /api/tournaments/:id/reward-status
// @desc    Get reward distribution status for a tournament
// @access  Admin only
router.get('/:id/reward-status', auth, adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('rewardDistribution.distributedBy', 'username')
      .populate('rewardDistribution.recipients.userId', 'username email');
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        rewardsDistributed: tournament.rewardDistribution.rewardsDistributed,
        winners: tournament.rewardDistribution.winners || [],
        participationReward: tournament.rewardDistribution.participationReward || 0,
        distributedAt: tournament.rewardDistribution.distributedAt,
        distributedBy: tournament.rewardDistribution.distributedBy,
        recipients: tournament.rewardDistribution.recipients || []
      }
    });
    
  } catch (error) {
    console.error('Error fetching reward status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reward status'
    });
  }
});

// @route   GET /api/tournaments/:id/registered-teams
// @desc    Get list of registered teams for a tournament
// @access  Admin only
router.get('/:id/registered-teams', auth, adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    console.log('🔍 Fetching teams for tournament:', {
      tournamentId: req.params.id,
      gameType: tournament.gameType,
      participantsCount: tournament.participants?.length || 0
    });
    
    let teams = [];
    
    // For BGMI/FreeFire: Fetch from TournamentRegistration model
    if (tournament.gameType === 'bgmi' || tournament.gameType === 'freefire') {
      const TournamentRegistration = require('../models/TournamentRegistration');
      
      const registrations = await TournamentRegistration.find({
        tournamentId: req.params.id,
        status: { $in: ['pending', 'images_uploaded', 'verified'] }
      }).populate('userId', 'username email');
      
      console.log(`✅ Found ${registrations.length} registrations for ${tournament.gameType}`);
      
      // Convert registrations to team format
      teams = registrations.map(reg => {
        // Collect all team members (leader + members)
        const allMembers = [
          {
            userId: reg.userId._id,
            username: reg.userId.username,
            role: 'leader',
            gameId: tournament.gameType === 'bgmi' ? reg.teamLeader.bgmiId : reg.teamLeader.freeFireId
          },
          ...reg.teamMembers.map((member, index) => ({
            userId: null, // Team members don't have user accounts
            username: member.name,
            role: `member${index + 1}`,
            gameId: tournament.gameType === 'bgmi' ? member.bgmiId : member.freeFireId
          }))
        ];
        
        return {
          _id: reg._id, // Use registration ID as team ID
          name: reg.teamName,
          tag: null,
          memberCount: allMembers.length,
          members: allMembers,
          registrationId: reg._id
        };
      });
      
    } else {
      // For CS2/Valorant: We MUST only use participants actually in this tournament
      // We group them by teamName. If teamName is empty, we treat them as individual participants.
      
      const participants = tournament.participants || [];
      console.log(`✅ Processing ${participants.length} participants for ${tournament.gameType} tournament reward mapping`);
      
      // Group by teamName
      const teamGroups = {};
      
      participants.forEach(p => {
        const tName = p.teamName || `Solo: ${p.userId.username || 'User'}`;
        if (!teamGroups[tName]) {
          teamGroups[tName] = {
            _id: p._id, // Use participant ID as a temporary unique ID
            name: tName,
            members: []
          };
        }
        teamGroups[tName].members.push({
          userId: p.userId._id,
          username: p.userId.username,
          role: 'member'
        });
      });
      
      teams = Object.values(teamGroups).map(group => ({
        ...group,
        memberCount: group.members.length
      }));
      
      console.log(`✅ Mapped ${teams.length} unique teams/solos from participants`);
    }
    
    res.json({
      success: true,
      data: {
        teams: teams
      }
    });
    
  } catch (error) {
    console.error('Error fetching registered teams:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch registered teams'
    });
  }
});

// @route   POST /api/tournaments/:id/upload-video
// @desc    Upload tournament video for processing
// @access  Admin only
router.post('/:id/upload-video', auth, adminAuth, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file uploaded'
      });
    }
    
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      // Delete uploaded file if tournament not found
      fs.unlinkSync(req.file.path);
      
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    // Delete old video if exists
    if (tournament.videoUpload.filePath && fs.existsSync(tournament.videoUpload.filePath)) {
      try {
        fs.unlinkSync(tournament.videoUpload.filePath);
        console.log('🗑️ Deleted old video file');
      } catch (error) {
        console.error('Error deleting old video:', error);
      }
    }
    
    // Update tournament with video info
    tournament.videoUpload = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.user.userId,
      processed: false,
      processedAt: null,
      extractedData: null
    };
    
    await tournament.save();
    
    console.log('✅ Video uploaded successfully:', {
      tournamentId: req.params.id,
      filename: req.file.filename,
      size: `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`
    });
    
    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        uploadedAt: tournament.videoUpload.uploadedAt
      }
    });
    
  } catch (error) {
    console.error('Error uploading video:', error);
    
    // Delete uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to upload video',
      details: error.message
    });
  }
});

// @route   GET /api/tournaments/:id/video-status
// @desc    Get video upload status
// @access  Admin only
router.get('/:id/video-status', auth, adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id)
      .populate('videoUpload.uploadedBy', 'username');
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        hasVideo: !!tournament.videoUpload.filename,
        filename: tournament.videoUpload.filename,
        originalName: tournament.videoUpload.originalName,
        fileSize: tournament.videoUpload.fileSize,
        uploadedAt: tournament.videoUpload.uploadedAt,
        uploadedBy: tournament.videoUpload.uploadedBy,
        processed: tournament.videoUpload.processed,
        processedAt: tournament.videoUpload.processedAt,
        extractedData: tournament.videoUpload.extractedData
      }
    });
    
  } catch (error) {
    console.error('Error fetching video status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch video status'
    });
  }
});

// @route   DELETE /api/tournaments/:id/delete-video
// @desc    Delete uploaded video
// @access  Admin only
router.delete('/:id/delete-video', auth, adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    if (!tournament.videoUpload.filename) {
      return res.status(404).json({
        success: false,
        error: 'No video found for this tournament'
      });
    }
    
    // Delete video file
    if (tournament.videoUpload.filePath && fs.existsSync(tournament.videoUpload.filePath)) {
      fs.unlinkSync(tournament.videoUpload.filePath);
      console.log('🗑️ Video file deleted');
    }
    
    // Clear video upload data
    tournament.videoUpload = {
      filename: null,
      originalName: null,
      filePath: null,
      fileSize: 0,
      mimeType: null,
      uploadedAt: null,
      uploadedBy: null,
      processed: false,
      processedAt: null,
      extractedData: null
    };
    
    await tournament.save();
    
    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video'
    });
  }
});

// @route   POST /api/tournaments/:id/process-video
// @desc    Process uploaded video using Python OCR microservice
// @access  Admin only
router.post('/:id/process-video', auth, adminAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found'
      });
    }
    
    if (!tournament.videoUpload.filename) {
      return res.status(400).json({
        success: false,
        error: 'No video uploaded for this tournament'
      });
    }
    
    if (tournament.videoUpload.processed) {
      return res.status(400).json({
        success: false,
        error: 'Video has already been processed'
      });
    }
    
    console.log('🎥 Starting video processing:', {
      tournamentId: req.params.id,
      videoPath: tournament.videoUpload.filePath
    });
    
    // Call Python OCR microservice
    const axios = require('axios');
    
    try {
      const pythonServiceUrl = process.env.PYTHON_OCR_SERVICE_URL || 'http://localhost:8000';
      
      const response = await axios.post(`${pythonServiceUrl}/process-video`, {
        video_path: tournament.videoUpload.filePath,
        tournament_id: req.params.id
      }, {
        timeout: 300000 // 5 minutes timeout
      });
      
      if (response.data.success) {
        // Update tournament with extracted data
        tournament.videoUpload.processed = true;
        tournament.videoUpload.processedAt = new Date();
        tournament.videoUpload.extractedData = {
          teams: response.data.teams,
          totalTeams: response.data.total_teams,
          processedAt: new Date()
        };
        
        await tournament.save();
        
        console.log('✅ Video processed successfully:', {
          tournamentId: req.params.id,
          teamsFound: response.data.total_teams
        });
        
        res.json({
          success: true,
          message: response.data.message,
          data: {
            teams: response.data.teams,
            totalTeams: response.data.total_teams
          }
        });
      } else {
        throw new Error('Python service returned unsuccessful response');
      }
      
    } catch (pythonError) {
      console.error('❌ Python OCR service error:', pythonError.message);
      
      // Check if it's a connection error
      if (pythonError.code === 'ECONNREFUSED') {
        return res.status(503).json({
          success: false,
          error: 'OCR service is not running. Please start the Python microservice.',
          details: 'Run: cd python-ocr-service && python main.py'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Failed to process video with OCR service',
        details: pythonError.response?.data?.detail || pythonError.message
      });
    }
    
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process video',
      details: error.message
    });
  }
});

module.exports = router;

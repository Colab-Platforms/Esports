const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: [true, 'Tournament ID is required']
  },
  roundNumber: {
    type: Number,
    required: [true, 'Round number is required'],
    min: [1, 'Round number must be at least 1']
  },
  matchNumber: {
    type: Number,
    required: [true, 'Match number is required'],
    min: [1, 'Match number must be at least 1']
  },
  roomId: {
    type: String,
    default: ''
  },
  roomPassword: {
    type: String,
    default: ''
  },
  serverDetails: {
    ip: { type: String, default: '' },
    port: { type: String, default: '' },
    password: { type: String, default: '' }
  },
  scheduledAt: {
    type: Date,
    required: [true, 'Scheduled time is required']
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: {
      values: ['scheduled', 'active', 'completed', 'disputed', 'cancelled'],
      message: 'Invalid match status'
    },
    default: 'scheduled'
  },
  gameType: {
    type: String,
    required: [true, 'Game type is required'],
    enum: {
      values: ['bgmi', 'cs2'],
      message: 'Game type must be one of: bgmi, cs2'
    }
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    gameId: {
      type: String,
      required: true
    },
    teamName: {
      type: String,
      default: ''
    },
    kills: {
      type: Number,
      default: 0,
      min: 0
    },
    deaths: {
      type: Number,
      default: 0,
      min: 0
    },
    assists: {
      type: Number,
      default: 0,
      min: 0
    },
    finalPosition: {
      type: Number,
      default: 0,
      min: 0
    },
    score: {
      type: Number,
      default: 0
    },
    screenshotUrl: {
      type: String,
      default: ''
    },
    resultSubmittedAt: {
      type: Date,
      default: null
    },
    isResultVerified: {
      type: Boolean,
      default: false
    }
  }],
  serverLogUrl: {
    type: String,
    default: ''
  },
  serverLogs: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    logData: {
      type: String,
      required: true
    },
    logType: {
      type: String,
      enum: ['kill', 'death', 'round_end', 'match_end', 'player_connect', 'player_disconnect'],
      default: 'kill'
    }
  }],
  disputeInfo: {
    isDisputed: {
      type: Boolean,
      default: false
    },
    disputeReason: {
      type: String,
      default: ''
    },
    disputedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    disputedAt: {
      type: Date,
      default: null
    },
    adminNotes: {
      type: String,
      default: ''
    },
    resolution: {
      type: String,
      enum: ['pending', 'resolved', 'rejected'],
      default: 'pending'
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  matchSettings: {
    mapName: {
      type: String,
      default: ''
    },
    gameMode: {
      type: String,
      default: ''
    },
    maxPlayers: {
      type: Number,
      default: 100
    },
    matchDuration: {
      type: Number, // in minutes
      default: 30
    }
  },
  results: {
    winnerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    topPerformers: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      position: Number,
      score: Number
    }],
    matchSummary: {
      totalKills: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      matchDuration: { type: Number, default: 0 } // actual duration in minutes
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Match creator is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for match duration
matchSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return Math.ceil((this.completedAt - this.startedAt) / (1000 * 60)); // in minutes
  }
  return 0;
});

// Virtual for participants count
matchSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

// Virtual for results submitted count
matchSchema.virtual('resultsSubmittedCount').get(function() {
  return this.participants.filter(p => p.resultSubmittedAt !== null).length;
});

// Virtual for all results submitted
matchSchema.virtual('allResultsSubmitted').get(function() {
  return this.participants.length > 0 && 
         this.participants.every(p => p.resultSubmittedAt !== null);
});

// Indexes for efficient queries
matchSchema.index({ tournamentId: 1, roundNumber: 1 });
matchSchema.index({ status: 1, scheduledAt: 1 });
matchSchema.index({ 'participants.userId': 1 });
matchSchema.index({ createdBy: 1 });
matchSchema.index({ gameType: 1, status: 1 });

// Method to generate room credentials
matchSchema.methods.generateRoomCredentials = function() {
  if (this.gameType === 'bgmi' || this.gameType === 'valorant') {
    // Generate 9-digit room ID and 6-character password
    this.roomId = Math.floor(100000000 + Math.random() * 900000000).toString();
    this.roomPassword = Math.random().toString(36).substring(2, 8).toUpperCase();
  } else if (this.gameType === 'cs2') {
    // Generate server connection details for CS2
    this.serverDetails = {
      ip: '192.168.1.100', // This would be dynamic in production
      port: '27015',
      password: Math.random().toString(36).substring(2, 10).toUpperCase()
    };
  }
  
  return this.save();
};

// Method to add participant
matchSchema.methods.addParticipant = function(userId, gameId, teamName = '') {
  // Check if user is already in this match
  const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (existingParticipant) {
    throw new Error('User is already registered for this match');
  }
  
  this.participants.push({
    userId,
    gameId,
    teamName
  });
  
  return this.save();
};

// Method to submit result for a participant
matchSchema.methods.submitResult = function(userId, resultData) {
  const participant = this.participants.find(p => p.userId.toString() === userId.toString());
  
  if (!participant) {
    throw new Error('User is not a participant in this match');
  }
  
  if (participant.resultSubmittedAt) {
    throw new Error('Result already submitted for this match');
  }
  
  // Update participant data
  participant.kills = resultData.kills || 0;
  participant.deaths = resultData.deaths || 0;
  participant.assists = resultData.assists || 0;
  participant.finalPosition = resultData.finalPosition || 0;
  participant.screenshotUrl = resultData.screenshotUrl || '';
  participant.resultSubmittedAt = new Date();
  
  // Calculate score using the formula: (kills × 100) + (assists × 50) - (deaths × 20) + win_bonus
  const winBonus = participant.finalPosition === 1 ? 500 : 0;
  participant.score = (participant.kills * 100) + (participant.assists * 50) - (participant.deaths * 20) + winBonus;
  
  return this.save();
};

// Method to start match
matchSchema.methods.startMatch = function() {
  if (this.status !== 'scheduled') {
    throw new Error('Match is not in scheduled state');
  }
  
  this.status = 'active';
  this.startedAt = new Date();
  
  return this.save();
};

// Method to complete match
matchSchema.methods.completeMatch = async function() {
  if (this.status !== 'active') {
    throw new Error('Match is not in active state');
  }
  
  this.status = 'completed';
  this.completedAt = new Date();
  
  // Calculate match results
  this.calculateMatchResults();
  
  await this.save();
  
  // Update leaderboards after match completion
  try {
    const LeaderboardService = require('../services/leaderboardService');
    await LeaderboardService.updateLeaderboardsFromMatch(this);
  } catch (error) {
    console.error('Error updating leaderboards after match completion:', error);
    // Don't throw error to prevent match completion failure
  }
  
  return this;
};

// Method to calculate match results
matchSchema.methods.calculateMatchResults = function() {
  if (this.participants.length === 0) return;
  
  // Sort participants by score (highest first)
  const sortedParticipants = this.participants
    .filter(p => p.resultSubmittedAt !== null)
    .sort((a, b) => b.score - a.score);
  
  if (sortedParticipants.length > 0) {
    // Set winner
    this.results.winnerUserId = sortedParticipants[0].userId;
    
    // Set top performers (top 3)
    this.results.topPerformers = sortedParticipants.slice(0, 3).map((p, index) => ({
      userId: p.userId,
      position: index + 1,
      score: p.score
    }));
    
    // Calculate match summary
    const totalKills = sortedParticipants.reduce((sum, p) => sum + p.kills, 0);
    const averageScore = sortedParticipants.reduce((sum, p) => sum + p.score, 0) / sortedParticipants.length;
    
    this.results.matchSummary = {
      totalKills,
      averageScore: Math.round(averageScore),
      matchDuration: this.duration
    };
  }
};

// Method to create dispute
matchSchema.methods.createDispute = function(userId, reason) {
  if (this.disputeInfo.isDisputed) {
    throw new Error('Match is already disputed');
  }
  
  this.disputeInfo = {
    isDisputed: true,
    disputeReason: reason,
    disputedBy: userId,
    disputedAt: new Date(),
    resolution: 'pending'
  };
  
  this.status = 'disputed';
  
  return this.save();
};

// Method to resolve dispute
matchSchema.methods.resolveDispute = function(adminUserId, resolution, adminNotes = '') {
  if (!this.disputeInfo.isDisputed) {
    throw new Error('No active dispute to resolve');
  }
  
  this.disputeInfo.resolution = resolution;
  this.disputeInfo.resolvedBy = adminUserId;
  this.disputeInfo.resolvedAt = new Date();
  this.disputeInfo.adminNotes = adminNotes;
  
  // Update match status based on resolution
  if (resolution === 'resolved') {
    this.status = 'completed';
  }
  
  return this.save();
};

// Static method to get matches for a tournament
matchSchema.statics.getMatchesForTournament = function(tournamentId, options = {}) {
  const query = { tournamentId };
  
  if (options.roundNumber) {
    query.roundNumber = options.roundNumber;
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate('participants.userId', 'username avatarUrl')
    .populate('tournamentId', 'name gameType')
    .populate('createdBy', 'username')
    .sort({ roundNumber: 1, matchNumber: 1 });
};

// Static method to get matches for a user
matchSchema.statics.getMatchesForUser = function(userId, options = {}) {
  const query = { 'participants.userId': userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.gameType) {
    query.gameType = options.gameType;
  }
  
  return this.find(query)
    .populate('participants.userId', 'username avatarUrl')
    .populate('tournamentId', 'name gameType entryFee prizePool')
    .populate('createdBy', 'username')
    .sort({ scheduledAt: -1 });
};

module.exports = mongoose.model('Match', matchSchema);
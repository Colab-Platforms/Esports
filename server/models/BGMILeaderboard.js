const mongoose = require('mongoose');

const bgmiLeaderboardSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  teamName: String,
  
  // Cumulative stats
  totalPoints: {
    type: Number,
    default: 0
  },
  totalKills: {
    type: Number,
    default: 0
  },
  matchesPlayed: {
    type: Number,
    default: 0
  },
  
  // Best performance
  bestPlacement: Number,
  highestKills: Number,
  
  // Rankings
  currentRank: Number,
  previousRank: Number,
  
  // Match-wise breakdown
  matchHistory: [{
    matchId: mongoose.Schema.Types.ObjectId,
    matchNumber: Number,
    placement: Number,
    kills: Number,
    points: Number,
    playedAt: Date
  }],
  
  lastUpdated: Date
}, {
  timestamps: true
});

// Index for faster queries
bgmiLeaderboardSchema.index({ tournamentId: 1, totalPoints: -1 });
bgmiLeaderboardSchema.index({ tournamentId: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model('BGMILeaderboard', bgmiLeaderboardSchema);

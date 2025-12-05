const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  challenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  opponent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  game: {
    type: String,
    enum: ['bgmi', 'cs2'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'completed', 'cancelled', 'expired'],
    default: 'pending',
    index: true
  },
  
  // Match Details
  matchDetails: {
    roomId: {
      type: String,
      default: ''
    },
    password: {
      type: String,
      default: ''
    },
    map: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: ''
    },
    scheduledTime: {
      type: Date
    }
  },
  
  // Results (after match)
  result: {
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    challengerScore: {
      type: Number,
      default: 0
    },
    opponentScore: {
      type: Number,
      default: 0
    },
    proof: {
      type: String,
      default: ''
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    submittedAt: {
      type: Date
    }
  },
  
  // Timestamps
  acceptedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Expires in 24 hours
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true
});

// Indexes for faster queries
challengeSchema.index({ challenger: 1, status: 1 });
challengeSchema.index({ opponent: 1, status: 1 });
challengeSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Challenge', challengeSchema);

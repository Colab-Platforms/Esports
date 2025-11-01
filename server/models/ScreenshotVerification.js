const mongoose = require('mongoose');

const screenshotVerificationSchema = new mongoose.Schema({
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  screenshotUrl: {
    type: String,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  gameType: {
    type: String,
    enum: ['bgmi', 'valorant', 'cs2', 'freefire'],
    required: true
  },
  claimedStats: {
    kills: {
      type: Number,
      required: true,
      min: 0
    },
    deaths: {
      type: Number,
      required: true,
      min: 0
    },
    assists: {
      type: Number,
      default: 0,
      min: 0
    },
    finalPosition: {
      type: Number,
      min: 1
    },
    damage: Number,
    survivalTime: Number,
    headshots: Number
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'needs_review', 'suspicious'],
    default: 'pending'
  },
  automaticChecks: {
    imageQuality: {
      score: {
        type: Number,
        min: 0,
        max: 100
      },
      issues: [String]
    },
    metadataAnalysis: {
      timestamp: Date,
      deviceInfo: String,
      gpsLocation: String,
      editingDetected: Boolean,
      suspiciousElements: [String]
    },
    gameUIValidation: {
      uiElementsDetected: [String],
      gameVersionMatch: Boolean,
      resolutionConsistent: Boolean
    }
  },
  manualReview: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    reviewNotes: String,
    verificationScore: {
      type: Number,
      min: 0,
      max: 100
    },
    discrepancies: [{
      field: String,
      claimed: mongoose.Schema.Types.Mixed,
      actual: mongoose.Schema.Types.Mixed,
      severity: {
        type: String,
        enum: ['minor', 'major', 'critical']
      }
    }]
  },
  flags: [{
    type: {
      type: String,
      enum: [
        'stats_too_high',
        'impossible_performance',
        'image_edited',
        'wrong_game_mode',
        'timestamp_mismatch',
        'duplicate_screenshot',
        'ui_inconsistency'
      ]
    },
    description: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    detectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  finalDecision: {
    approved: Boolean,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String,
    adjustedStats: {
      kills: Number,
      deaths: Number,
      assists: Number,
      finalPosition: Number
    }
  },
  appealStatus: {
    hasAppeal: {
      type: Boolean,
      default: false
    },
    appealReason: String,
    appealedAt: Date,
    appealDecision: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    appealReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appealReviewedAt: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
screenshotVerificationSchema.index({ matchId: 1, userId: 1 });
screenshotVerificationSchema.index({ verificationStatus: 1 });
screenshotVerificationSchema.index({ submittedAt: -1 });
screenshotVerificationSchema.index({ tournamentId: 1 });
screenshotVerificationSchema.index({ gameType: 1 });
screenshotVerificationSchema.index({ 'manualReview.reviewedBy': 1 });

module.exports = mongoose.model('ScreenshotVerification', screenshotVerificationSchema);
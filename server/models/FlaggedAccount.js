const mongoose = require('mongoose');

const flaggedAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  flagReason: {
    type: String,
    enum: [
      'suspicious_performance',
      'duplicate_account',
      'cheating_suspected',
      'multiple_ip_addresses',
      'unusual_activity_pattern',
      'screenshot_manipulation',
      'server_log_anomaly',
      'community_report',
      'automated_detection'
    ],
    required: true
  },
  flaggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  flaggedAt: {
    type: Date,
    default: Date.now
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  description: {
    type: String,
    required: true
  },
  evidence: {
    screenshots: [String],
    serverLogs: [String],
    performanceMetrics: {
      averageKDA: Number,
      winRate: Number,
      suspiciousMatches: [{
        matchId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Match'
        },
        reason: String,
        metrics: mongoose.Schema.Types.Mixed
      }]
    },
    ipAddresses: [{
      ip: String,
      firstSeen: Date,
      lastSeen: Date,
      frequency: Number
    }],
    deviceFingerprints: [String]
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'verified', 'dismissed', 'resolved'],
    default: 'pending'
  },
  reviewHistory: [{
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['escalated', 'dismissed', 'warning_issued', 'temporary_ban', 'permanent_ban', 'verification_required']
    },
    notes: String
  }],
  currentRestrictions: {
    isBanned: {
      type: Boolean,
      default: false
    },
    banType: {
      type: String,
      enum: ['temporary', 'permanent'],
      default: 'temporary'
    },
    banExpiresAt: Date,
    restrictedFeatures: [{
      feature: String,
      restrictedUntil: Date
    }],
    requiresVerification: {
      type: Boolean,
      default: false
    }
  },
  relatedAccounts: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    relationship: {
      type: String,
      enum: ['same_ip', 'same_device', 'similar_pattern', 'linked_payment']
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100
    }
  }],
  isResolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolutionNotes: String
}, {
  timestamps: true
});

// Indexes for efficient querying
flaggedAccountSchema.index({ userId: 1 });
flaggedAccountSchema.index({ status: 1, severity: 1 });
flaggedAccountSchema.index({ flaggedAt: -1 });
flaggedAccountSchema.index({ flagReason: 1 });
flaggedAccountSchema.index({ isResolved: 1 });
flaggedAccountSchema.index({ 'currentRestrictions.isBanned': 1 });

module.exports = mongoose.model('FlaggedAccount', flaggedAccountSchema);
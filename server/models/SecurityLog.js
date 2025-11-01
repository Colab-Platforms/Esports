const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  eventType: {
    type: String,
    enum: [
      'duplicate_ip',
      'suspicious_activity',
      'multiple_accounts',
      'unusual_performance',
      'server_log_anomaly',
      'screenshot_verification_failed',
      'account_flagged',
      'account_banned',
      'login_attempt',
      'failed_verification'
    ],
    required: true
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
  metadata: {
    ipAddress: String,
    userAgent: String,
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament'
    },
    deviceFingerprint: String,
    suspiciousMetrics: {
      killsPerMinute: Number,
      accuracyPercentage: Number,
      headShotRatio: Number,
      movementPattern: String
    },
    duplicateAccounts: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      similarity: Number
    }]
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String,
  actionTaken: {
    type: String,
    enum: ['none', 'warning', 'temporary_ban', 'permanent_ban', 'account_verification_required'],
    default: 'none'
  },
  isResolved: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
securityLogSchema.index({ userId: 1, eventType: 1 });
securityLogSchema.index({ severity: 1, status: 1 });
securityLogSchema.index({ createdAt: -1 });
securityLogSchema.index({ 'metadata.ipAddress': 1 });
securityLogSchema.index({ isResolved: 1, status: 1 });

module.exports = mongoose.model('SecurityLog', securityLogSchema);
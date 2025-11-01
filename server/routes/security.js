const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const SecurityService = require('../services/securityService');
const ScreenshotVerificationService = require('../services/screenshotVerificationService');
const SecurityLog = require('../models/SecurityLog');
const FlaggedAccount = require('../models/FlaggedAccount');
const ScreenshotVerification = require('../models/ScreenshotVerification');

// Get security dashboard summary (Admin only)
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const summary = await SecurityService.getSecuritySummary();
    const verificationStats = await ScreenshotVerificationService.getVerificationStats();

    res.json({
      success: true,
      data: {
        security: summary,
        verification: verificationStats
      },
      message: 'Security dashboard data retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting security dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_ERROR',
        message: 'Failed to retrieve security dashboard data',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Get security logs with filtering (Admin only)
router.get('/logs', auth, adminAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      eventType,
      severity,
      status,
      userId,
      startDate,
      endDate
    } = req.query;

    const query = {};
    
    if (eventType) query.eventType = eventType;
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (userId) query.userId = userId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [logs, total] = await Promise.all([
      SecurityLog.find(query)
        .populate('userId', 'username email')
        .populate('reviewedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SecurityLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      message: 'Security logs retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting security logs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGS_ERROR',
        message: 'Failed to retrieve security logs',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Get flagged accounts (Admin only)
router.get('/flagged-accounts', auth, adminAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      severity,
      flagReason,
      isResolved
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (flagReason) query.flagReason = flagReason;
    if (isResolved !== undefined) query.isResolved = isResolved === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [flaggedAccounts, total] = await Promise.all([
      FlaggedAccount.find(query)
        .populate('userId', 'username email gameIds')
        .populate('flaggedBy', 'username')
        .populate('resolvedBy', 'username')
        .sort({ flaggedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FlaggedAccount.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        flaggedAccounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      message: 'Flagged accounts retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting flagged accounts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FLAGGED_ACCOUNTS_ERROR',
        message: 'Failed to retrieve flagged accounts',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Review flagged account (Admin only)
router.post('/flagged-accounts/:id/review', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;

    const flaggedAccount = await FlaggedAccount.findById(id);
    if (!flaggedAccount) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'FLAGGED_ACCOUNT_NOT_FOUND',
          message: 'Flagged account not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Add review to history
    flaggedAccount.reviewHistory.push({
      reviewedBy: req.user.userId,
      action,
      notes
    });

    // Update status based on action
    switch (action) {
      case 'dismissed':
        flaggedAccount.status = 'dismissed';
        flaggedAccount.isResolved = true;
        flaggedAccount.resolvedAt = new Date();
        flaggedAccount.resolvedBy = req.user.userId;
        flaggedAccount.resolutionNotes = notes;
        break;
      
      case 'warning_issued':
        flaggedAccount.status = 'resolved';
        flaggedAccount.isResolved = true;
        flaggedAccount.resolvedAt = new Date();
        flaggedAccount.resolvedBy = req.user.userId;
        flaggedAccount.resolutionNotes = notes;
        break;
      
      case 'temporary_ban':
        flaggedAccount.status = 'resolved';
        flaggedAccount.currentRestrictions.isBanned = true;
        flaggedAccount.currentRestrictions.banType = 'temporary';
        flaggedAccount.currentRestrictions.banExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        flaggedAccount.isResolved = true;
        flaggedAccount.resolvedAt = new Date();
        flaggedAccount.resolvedBy = req.user.userId;
        flaggedAccount.resolutionNotes = notes;
        
        // Ban the user
        await SecurityService.banUser(flaggedAccount.userId, {
          reason: notes || 'Temporary ban due to flagged activity',
          banType: 'temporary',
          expiresAt: flaggedAccount.currentRestrictions.banExpiresAt,
          bannedBy: req.user.userId
        });
        break;
      
      case 'permanent_ban':
        flaggedAccount.status = 'resolved';
        flaggedAccount.currentRestrictions.isBanned = true;
        flaggedAccount.currentRestrictions.banType = 'permanent';
        flaggedAccount.isResolved = true;
        flaggedAccount.resolvedAt = new Date();
        flaggedAccount.resolvedBy = req.user.userId;
        flaggedAccount.resolutionNotes = notes;
        
        // Ban the user permanently
        await SecurityService.banUser(flaggedAccount.userId, {
          reason: notes || 'Permanent ban due to serious violations',
          banType: 'permanent',
          bannedBy: req.user.userId
        });
        break;
      
      case 'escalated':
        flaggedAccount.status = 'under_review';
        flaggedAccount.severity = 'critical';
        break;
      
      default:
        flaggedAccount.status = 'under_review';
    }

    await flaggedAccount.save();

    res.json({
      success: true,
      data: { flaggedAccount },
      message: `Flagged account ${action} successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error reviewing flagged account:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVIEW_ERROR',
        message: 'Failed to review flagged account',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Get pending screenshot verifications (Admin only)
router.get('/screenshot-verifications', auth, adminAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      gameType,
      severity
    } = req.query;

    const filters = { limit: parseInt(limit) };
    if (gameType) filters.gameType = gameType;
    if (severity) filters.severity = severity;

    let verifications;
    if (status === 'pending') {
      verifications = await ScreenshotVerificationService.getPendingVerifications(filters);
    } else {
      const query = {};
      if (status) query.verificationStatus = status;
      if (gameType) query.gameType = gameType;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      verifications = await ScreenshotVerification.find(query)
        .populate('userId', 'username email')
        .populate('tournamentId', 'name gameType')
        .populate('manualReview.reviewedBy', 'username')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    }

    res.json({
      success: true,
      data: { verifications },
      message: 'Screenshot verifications retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting screenshot verifications:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_ERROR',
        message: 'Failed to retrieve screenshot verifications',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Manual review of screenshot (Admin only)
router.post('/screenshot-verifications/:id/review', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { score, notes, discrepancies, rejectionReason } = req.body;

    const reviewData = {
      reviewedBy: req.user.userId,
      score: parseInt(score),
      notes,
      discrepancies: discrepancies || [],
      rejectionReason
    };

    const verification = await ScreenshotVerificationService.manualReview(id, reviewData);

    res.json({
      success: true,
      data: { verification },
      message: 'Screenshot review completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error reviewing screenshot:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REVIEW_ERROR',
        message: 'Failed to review screenshot',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Flag account manually (Admin only)
router.post('/flag-account', auth, adminAuth, async (req, res) => {
  try {
    const { userId, reason, severity, description, evidence } = req.body;

    const flagData = {
      reason,
      severity,
      description,
      evidence: evidence || {},
      flaggedBy: req.user.userId
    };

    const flaggedAccount = await SecurityService.flagAccount(userId, flagData);

    res.json({
      success: true,
      data: { flaggedAccount },
      message: 'Account flagged successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error flagging account:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FLAG_ERROR',
        message: 'Failed to flag account',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Get security statistics (Admin only)
router.get('/statistics', auth, adminAuth, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let startDate;
    switch (period) {
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const [
      securityEventsByType,
      securityEventsBySeverity,
      flaggedAccountsByReason,
      verificationStats,
      recentActivity
    ] = await Promise.all([
      SecurityLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      SecurityLog.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      FlaggedAccount.aggregate([
        { $match: { flaggedAt: { $gte: startDate } } },
        { $group: { _id: '$flagReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      ScreenshotVerificationService.getVerificationStats(),
      SecurityLog.find({ createdAt: { $gte: startDate } })
        .populate('userId', 'username')
        .sort({ createdAt: -1 })
        .limit(20)
    ]);

    res.json({
      success: true,
      data: {
        period,
        securityEventsByType,
        securityEventsBySeverity,
        flaggedAccountsByReason,
        verificationStats,
        recentActivity
      },
      message: 'Security statistics retrieved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting security statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATISTICS_ERROR',
        message: 'Failed to retrieve security statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
});

module.exports = router;
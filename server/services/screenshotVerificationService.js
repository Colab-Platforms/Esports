const ScreenshotVerification = require('../models/ScreenshotVerification');
const SecurityService = require('./securityService');
const path = require('path');
const fs = require('fs').promises;

class ScreenshotVerificationService {
  // Submit screenshot for verification
  static async submitScreenshot(submissionData) {
    try {
      const verification = new ScreenshotVerification({
        matchId: submissionData.matchId,
        userId: submissionData.userId,
        tournamentId: submissionData.tournamentId,
        screenshotUrl: submissionData.screenshotUrl,
        gameType: submissionData.gameType,
        claimedStats: submissionData.claimedStats
      });

      // Run automatic checks
      const automaticChecks = await this.runAutomaticChecks(submissionData);
      verification.automaticChecks = automaticChecks;

      // Determine initial verification status
      if (automaticChecks.suspiciousElements && automaticChecks.suspiciousElements.length > 0) {
        verification.verificationStatus = 'suspicious';
        verification.flags = automaticChecks.suspiciousElements.map(element => ({
          type: element.type,
          description: element.description,
          severity: element.severity
        }));
      } else if (automaticChecks.imageQuality.score < 50) {
        verification.verificationStatus = 'needs_review';
        verification.flags.push({
          type: 'image_quality',
          description: 'Image quality too low for automatic verification',
          severity: 'medium'
        });
      } else {
        verification.verificationStatus = 'pending';
      }

      await verification.save();

      // Log security event if suspicious
      if (verification.verificationStatus === 'suspicious') {
        await SecurityService.logSecurityEvent({
          userId: submissionData.userId,
          eventType: 'screenshot_verification_failed',
          severity: 'medium',
          description: 'Suspicious screenshot submitted for verification',
          metadata: {
            matchId: submissionData.matchId,
            verificationId: verification._id,
            suspiciousElements: automaticChecks.suspiciousElements
          }
        });
      }

      console.log(`📸 Screenshot submitted for verification: ${verification._id}`);
      return verification;
    } catch (error) {
      console.error('❌ Error submitting screenshot:', error);
      throw error;
    }
  }

  // Run automatic checks on screenshot
  static async runAutomaticChecks(submissionData) {
    try {
      const checks = {
        imageQuality: {
          score: 75, // Mock score - in real implementation, use image analysis
          issues: []
        },
        metadataAnalysis: {
          timestamp: new Date(),
          deviceInfo: 'Unknown',
          gpsLocation: null,
          editingDetected: false,
          suspiciousElements: []
        },
        gameUIValidation: {
          uiElementsDetected: [],
          gameVersionMatch: true,
          resolutionConsistent: true
        }
      };

      // Mock automatic checks - in real implementation, use image processing libraries
      const suspiciousElements = [];

      // Check for impossible stats
      if (submissionData.claimedStats.kills > 30) {
        suspiciousElements.push({
          type: 'stats_too_high',
          description: 'Kill count exceeds reasonable limits',
          severity: 'high'
        });
      }

      if (submissionData.claimedStats.kills > 0 && submissionData.claimedStats.deaths === 0) {
        suspiciousElements.push({
          type: 'impossible_performance',
          description: 'Zero deaths with kills claimed',
          severity: 'medium'
        });
      }

      // Check for duplicate screenshots (mock implementation)
      const isDuplicate = await this.checkDuplicateScreenshot(submissionData.screenshotUrl);
      if (isDuplicate) {
        suspiciousElements.push({
          type: 'duplicate_screenshot',
          description: 'Screenshot appears to be duplicate or reused',
          severity: 'high'
        });
      }

      // Game-specific validations
      if (submissionData.gameType === 'bgmi') {
        if (submissionData.claimedStats.finalPosition && submissionData.claimedStats.finalPosition < 1) {
          suspiciousElements.push({
            type: 'invalid_position',
            description: 'Invalid final position claimed',
            severity: 'medium'
          });
        }
      }

      checks.metadataAnalysis.suspiciousElements = suspiciousElements;

      // Adjust image quality score based on suspicious elements
      if (suspiciousElements.length > 0) {
        checks.imageQuality.score -= (suspiciousElements.length * 15);
        checks.imageQuality.issues = suspiciousElements.map(e => e.description);
      }

      return checks;
    } catch (error) {
      console.error('❌ Error running automatic checks:', error);
      return {
        imageQuality: { score: 0, issues: ['Error during analysis'] },
        metadataAnalysis: { suspiciousElements: [] },
        gameUIValidation: { uiElementsDetected: [], gameVersionMatch: false }
      };
    }
  }

  // Check for duplicate screenshots (mock implementation)
  static async checkDuplicateScreenshot(screenshotUrl) {
    try {
      // In real implementation, use image hashing/comparison
      const existingScreenshots = await ScreenshotVerification.find({
        screenshotUrl: screenshotUrl
      });

      return existingScreenshots.length > 0;
    } catch (error) {
      console.error('❌ Error checking duplicate screenshot:', error);
      return false;
    }
  }

  // Manual review of screenshot
  static async manualReview(verificationId, reviewData) {
    try {
      const verification = await ScreenshotVerification.findById(verificationId);
      if (!verification) {
        throw new Error('Screenshot verification not found');
      }

      verification.manualReview = {
        reviewedBy: reviewData.reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: reviewData.notes,
        verificationScore: reviewData.score,
        discrepancies: reviewData.discrepancies || []
      };

      // Update verification status based on review
      if (reviewData.score >= 80) {
        verification.verificationStatus = 'verified';
        verification.finalDecision = {
          approved: true,
          approvedBy: reviewData.reviewedBy,
          approvedAt: new Date()
        };
      } else if (reviewData.score < 50) {
        verification.verificationStatus = 'rejected';
        verification.finalDecision = {
          approved: false,
          approvedBy: reviewData.reviewedBy,
          approvedAt: new Date(),
          rejectionReason: reviewData.rejectionReason || 'Failed manual review'
        };
      } else {
        verification.verificationStatus = 'needs_review';
      }

      await verification.save();

      // Log security event if rejected
      if (verification.verificationStatus === 'rejected') {
        await SecurityService.logSecurityEvent({
          userId: verification.userId,
          eventType: 'screenshot_verification_failed',
          severity: 'medium',
          description: 'Screenshot verification rejected after manual review',
          metadata: {
            matchId: verification.matchId,
            verificationId: verification._id,
            reviewScore: reviewData.score,
            rejectionReason: reviewData.rejectionReason
          }
        });
      }

      console.log(`👁️ Screenshot manually reviewed: ${verificationId} - ${verification.verificationStatus}`);
      return verification;
    } catch (error) {
      console.error('❌ Error in manual review:', error);
      throw error;
    }
  }

  // Get pending verifications for admin review
  static async getPendingVerifications(filters = {}) {
    try {
      const query = {
        verificationStatus: { $in: ['pending', 'needs_review', 'suspicious'] }
      };

      if (filters.gameType) {
        query.gameType = filters.gameType;
      }

      if (filters.severity) {
        query['flags.severity'] = filters.severity;
      }

      const verifications = await ScreenshotVerification.find(query)
        .populate('userId', 'username email')
        .populate('matchId', 'tournamentId')
        .populate('tournamentId', 'name gameType')
        .sort({ submittedAt: -1 })
        .limit(filters.limit || 50);

      return verifications;
    } catch (error) {
      console.error('❌ Error getting pending verifications:', error);
      throw error;
    }
  }

  // Get verification statistics
  static async getVerificationStats() {
    try {
      const [
        totalSubmissions,
        pendingReview,
        verified,
        rejected,
        suspicious,
        recentSubmissions
      ] = await Promise.all([
        ScreenshotVerification.countDocuments(),
        ScreenshotVerification.countDocuments({ 
          verificationStatus: { $in: ['pending', 'needs_review'] } 
        }),
        ScreenshotVerification.countDocuments({ verificationStatus: 'verified' }),
        ScreenshotVerification.countDocuments({ verificationStatus: 'rejected' }),
        ScreenshotVerification.countDocuments({ verificationStatus: 'suspicious' }),
        ScreenshotVerification.find()
          .sort({ submittedAt: -1 })
          .limit(10)
          .populate('userId', 'username')
          .populate('tournamentId', 'name')
      ]);

      return {
        totalSubmissions,
        pendingReview,
        verified,
        rejected,
        suspicious,
        verificationRate: totalSubmissions > 0 ? (verified / totalSubmissions * 100).toFixed(1) : 0,
        recentSubmissions
      };
    } catch (error) {
      console.error('❌ Error getting verification stats:', error);
      throw error;
    }
  }

  // Appeal screenshot verification decision
  static async appealVerification(verificationId, appealData) {
    try {
      const verification = await ScreenshotVerification.findById(verificationId);
      if (!verification) {
        throw new Error('Screenshot verification not found');
      }

      if (verification.verificationStatus !== 'rejected') {
        throw new Error('Can only appeal rejected verifications');
      }

      verification.appealStatus = {
        hasAppeal: true,
        appealReason: appealData.reason,
        appealedAt: new Date(),
        appealDecision: 'pending'
      };

      await verification.save();

      console.log(`📝 Appeal submitted for verification: ${verificationId}`);
      return verification;
    } catch (error) {
      console.error('❌ Error submitting appeal:', error);
      throw error;
    }
  }

  // Process appeal decision
  static async processAppeal(verificationId, appealDecision) {
    try {
      const verification = await ScreenshotVerification.findById(verificationId);
      if (!verification) {
        throw new Error('Screenshot verification not found');
      }

      verification.appealStatus.appealDecision = appealDecision.decision;
      verification.appealStatus.appealReviewedBy = appealDecision.reviewedBy;
      verification.appealStatus.appealReviewedAt = new Date();

      if (appealDecision.decision === 'approved') {
        verification.verificationStatus = 'verified';
        verification.finalDecision.approved = true;
        verification.finalDecision.approvedBy = appealDecision.reviewedBy;
        verification.finalDecision.approvedAt = new Date();
      }

      await verification.save();

      console.log(`⚖️ Appeal processed for verification: ${verificationId} - ${appealDecision.decision}`);
      return verification;
    } catch (error) {
      console.error('❌ Error processing appeal:', error);
      throw error;
    }
  }
}

module.exports = ScreenshotVerificationService;
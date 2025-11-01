const SecurityService = require('../services/securityService');

// Middleware to track user activity and detect suspicious patterns
const securityTracking = async (req, res, next) => {
  try {
    // Only track authenticated requests
    if (!req.user || !req.user.userId) {
      return next();
    }

    const userId = req.user.userId;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.get('User-Agent');

    // Log login attempts
    if (req.path.includes('/login') && req.method === 'POST') {
      await SecurityService.logSecurityEvent({
        userId,
        eventType: 'login_attempt',
        severity: 'low',
        description: 'User login attempt',
        metadata: {
          ipAddress,
          userAgent,
          success: res.statusCode === 200
        }
      });

      // Check for duplicate IPs on login
      if (res.statusCode === 200) {
        await SecurityService.detectDuplicateIPs(userId, ipAddress);
      }
    }

    // Track match result submissions
    if (req.path.includes('/matches') && req.path.includes('/submit-result') && req.method === 'POST') {
      const { kills, deaths, assists, finalPosition } = req.body;
      
      // Analyze performance metrics
      const activityData = {
        matchId: req.params.id,
        kills: kills || 0,
        deaths: deaths || 0,
        assists: assists || 0,
        finalPosition: finalPosition || 100,
        kdRatio: deaths > 0 ? kills / deaths : kills,
        killsPerMinute: kills / 30, // Assuming 30 minute average match
        accuracyPercentage: Math.min(100, (kills + assists) * 10), // Mock calculation
        headShotRatio: Math.random() * 0.5 // Mock data - in real implementation, get from game data
      };

      await SecurityService.analyzeSuspiciousActivity(userId, activityData);
    }

    // Track tournament joining patterns
    if (req.path.includes('/tournaments') && req.path.includes('/join') && req.method === 'POST') {
      // Check for rapid tournament joining (potential bot behavior)
      const recentJoins = await SecurityService.getRecentActivity(userId, 'tournament_join', 5); // Last 5 minutes
      
      if (recentJoins && recentJoins.length > 3) {
        await SecurityService.logSecurityEvent({
          userId,
          eventType: 'suspicious_activity',
          severity: 'medium',
          description: 'Rapid tournament joining detected',
          metadata: {
            ipAddress,
            userAgent,
            recentJoins: recentJoins.length,
            tournamentId: req.params.id
          }
        });
      }
    }

    // Track wallet transactions
    if (req.path.includes('/wallet') && (req.method === 'POST' || req.method === 'PUT')) {
      const { amount, type } = req.body;
      
      // Check for unusual transaction patterns
      if (amount && amount > 10000) {
        await SecurityService.logSecurityEvent({
          userId,
          eventType: 'suspicious_activity',
          severity: 'medium',
          description: 'Large transaction amount detected',
          metadata: {
            ipAddress,
            userAgent,
            amount,
            transactionType: type
          }
        });
      }
    }

    next();
  } catch (error) {
    console.error('❌ Security tracking error:', error);
    // Don't block the request if security tracking fails
    next();
  }
};

// Middleware to check if user is banned
const checkBannedUser = async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      return next();
    }

    const User = require('../models/User');
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User account not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!user.isActive) {
      const banMessage = user.banExpiresAt && user.banExpiresAt > new Date() 
        ? `Account temporarily banned until ${user.banExpiresAt.toISOString()}. Reason: ${user.banReason || 'Violation of terms'}`
        : `Account permanently banned. Reason: ${user.banReason || 'Violation of terms'}`;

      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_BANNED',
          message: banMessage,
          timestamp: new Date().toISOString(),
          banDetails: {
            reason: user.banReason,
            bannedAt: user.bannedAt,
            expiresAt: user.banExpiresAt,
            isPermanent: !user.banExpiresAt
          }
        }
      });
    }

    next();
  } catch (error) {
    console.error('❌ Ban check error:', error);
    next();
  }
};

module.exports = {
  securityTracking,
  checkBannedUser
};
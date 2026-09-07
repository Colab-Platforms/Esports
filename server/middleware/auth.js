const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Access denied. No token provided.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Verify token - algorithms pinned so a token signed (or forged) with a
    // different algorithm is rejected outright, rather than trusting
    // whatever jsonwebtoken defaults to.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId).select('isActive role banReason bannedAt banExpiresAt');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Access denied. Invalid or expired token.',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!user.isActive) {
      // isActive is set false by the ban flow (services/securityService.js) -
      // surface the actual reason/duration here instead of a generic
      // "invalid token", since this is the one place in the request
      // pipeline that reliably runs with req.user populated (see the
      // security-hardening notes on middleware/securityTracking.js's
      // checkBannedUser, which never actually runs due to its mount order).
      const isPermanent = !user.banExpiresAt;
      const banMessage = isPermanent
        ? `Account permanently banned. Reason: ${user.banReason || 'Violation of terms'}`
        : `Account temporarily banned until ${user.banExpiresAt.toISOString()}. Reason: ${user.banReason || 'Violation of terms'}`;

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
            isPermanent
          }
        }
      });
    }

    // Add user info to request
    req.user = {
      id: decoded.userId,
      userId: decoded.userId, // Keep both for compatibility
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Access denied. Invalid token.',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access denied. Token has expired.',
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Admin middleware
const adminAuth = async (req, res, next) => {
  try {
    // First run regular auth
    await new Promise((resolve, reject) => {
      auth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if user is admin
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Access denied. Admin privileges required.',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = auth;
module.exports.adminAuth = adminAuth;
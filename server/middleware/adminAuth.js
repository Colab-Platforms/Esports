// Admin authorization middleware
// Must be used after auth middleware

const adminAuth = (req, res, next) => {
  try {
    // Check if user exists and has admin role
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Check if user has admin, designer, or moderator role
    const allowedRoles = ['admin', 'designer', 'moderator'];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Authorization failed',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = adminAuth;

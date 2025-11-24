// Admin authorization middleware
// Checks if authenticated user has admin role

module.exports = (req, res, next) => {
  // Check if user exists (set by auth middleware)
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

  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
        timestamp: new Date().toISOString()
      }
    });
  }

  // User is admin, proceed
  next();
};

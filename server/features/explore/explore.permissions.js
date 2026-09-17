const User = require('../../models/User');

// Route-local role check layered on top of the shared auth middleware, scoped
// to the same role group used by comparable content-management features.
const exploreAdminAuth = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !['admin', 'moderator', 'designer'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin, moderator, or designer access required',
          timestamp: new Date().toISOString()
        }
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to verify permissions',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  exploreAdminAuth
};

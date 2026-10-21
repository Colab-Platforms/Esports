const auth = require('../../middleware/auth');
const requireStoreAdmin = (req, res, next) => {
  if (!['admin', 'moderator'].includes(req.user?.role)) return res.status(403).json({
    success: false, error: { code: 'FORBIDDEN', message: 'Store administration access required', timestamp: new Date().toISOString() }
  });
  next();
};

module.exports = {
  storeAuth: auth,
  storeAdminAuth: [auth, requireStoreAdmin]
};

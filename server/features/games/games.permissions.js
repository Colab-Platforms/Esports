const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/adminAuth');

const gameAdminAuth = [auth, adminAuth];

module.exports = {
  gameAdminAuth
};

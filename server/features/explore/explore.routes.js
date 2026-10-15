const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../../middleware/auth');
const { exploreAdminAuth } = require('./explore.permissions');
const exploreController = require('./explore.controller');

const router = express.Router();

// Route-specific limiter for public click tracking. This keeps click count
// inflation in check without changing the global limiter in server/index.js.
const clickLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again shortly.',
      timestamp: new Date().toISOString()
    }
  },
  skip: () => process.env.NODE_ENV === 'development'
});

router.get('/', exploreController.getPublicExploreContent);
router.patch('/:id/click', clickLimiter, exploreController.trackExploreClick);

router.get('/admin', auth, exploreAdminAuth, exploreController.getAdminExploreContent);
router.get('/admin/:id', auth, exploreAdminAuth, exploreController.getExploreContentById);
router.post('/', auth, exploreAdminAuth, exploreController.createExploreContent);
router.put('/:id', auth, exploreAdminAuth, exploreController.updateExploreContent);
router.patch('/:id/toggle-active', auth, exploreAdminAuth, exploreController.toggleExploreContentActive);
router.patch('/reorder', auth, exploreAdminAuth, exploreController.reorderExploreContent);
router.delete('/:id', auth, exploreAdminAuth, exploreController.deleteExploreContent);

module.exports = router;

const express = require('express');
const auth = require('../../middleware/auth');
const streakController = require('./streak.controller');

const router = express.Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

router.post('/check-in', auth, streakController.checkIn);
router.get('/leaderboard', auth, streakController.getLeaderboard);

module.exports = router;

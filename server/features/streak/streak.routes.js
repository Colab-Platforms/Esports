const express = require('express');
const auth = require('../../middleware/auth');
const streakController = require('./streak.controller');

const router = express.Router();

router.post('/check-in', auth, streakController.checkIn);
router.get('/leaderboard', auth, streakController.getLeaderboard);

module.exports = router;

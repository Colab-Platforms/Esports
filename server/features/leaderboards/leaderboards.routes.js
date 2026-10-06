const express = require('express');
const leaderboardsController = require('./leaderboards.controller');

const router = express.Router();

router.get('/:gameType', leaderboardsController.getTeamLeaderboard);

module.exports = router;

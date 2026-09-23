const express = require('express');
const statisticsController = require('./statistics.controller');

const router = express.Router();

router.get('/players/:username/statistics', statisticsController.getPlayerStatistics);
router.get('/teams/:teamId/statistics', statisticsController.getTeamStatistics);

module.exports = router;

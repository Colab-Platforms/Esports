const express = require('express');
const competitiveHistoryController = require('./competitive-history.controller');

const router = express.Router();

router.get('/:username/competitive-history', competitiveHistoryController.getPlayerCompetitiveHistory);

module.exports = router;

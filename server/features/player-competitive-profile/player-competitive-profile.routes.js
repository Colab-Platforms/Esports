const express = require('express');
const playerCompetitiveProfileController = require('./player-competitive-profile.controller');

const router = express.Router();

router.get('/:username/competitive-profile', playerCompetitiveProfileController.getPlayerCompetitiveProfile);

module.exports = router;

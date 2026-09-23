const express = require('express');
const teamCompetitiveProfileController = require('./team-competitive-profile.controller');

const router = express.Router();

router.get('/:teamId/competitive-profile', teamCompetitiveProfileController.getTeamCompetitiveProfile);

module.exports = router;

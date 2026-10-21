const express = require('express');
const auth = require('../../middleware/auth');
const competitionDashboardController = require('./competition-dashboard.controller');

const router = express.Router();

router.get('/', auth, competitionDashboardController.getCompetitionDashboard);

module.exports = router;

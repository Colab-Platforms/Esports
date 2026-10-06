const express = require('express');
const auth = require('../../middleware/auth');
const { requireResultManager } = require('../game-results/game-results.utils');
const controller = require('./tournament-final-results.controller');

const router = express.Router();

router.get('/tournaments/:tournamentId/final-results', controller.getPublicFinalResult);

router.get('/admin/tournaments/:tournamentId/final-results', auth, requireResultManager, controller.getAdminFinalResult);
router.get('/admin/tournaments/:tournamentId/final-results/preview', auth, requireResultManager, controller.previewFinalResult);
router.post('/admin/tournaments/:tournamentId/final-results/preview', auth, requireResultManager, controller.previewFinalResult);
router.post('/admin/tournaments/:tournamentId/final-results/publish', auth, requireResultManager, controller.publishFinalResult);
router.post('/admin/tournaments/:tournamentId/final-results/void', auth, requireResultManager, controller.voidFinalResult);

module.exports = router;

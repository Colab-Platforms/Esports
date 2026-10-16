const express = require('express');
const auth = require('../../middleware/auth');
const { requireResultManager } = require('../game-results/game-results.utils');
const controller = require('./tournament-final-results.controller');

const router = express.Router();

router.get('/tournaments/results-directory', controller.getResultsDirectory);
router.get('/tournaments/:tournamentId/final-results', controller.getPublicFinalResult);

router.get('/admin/tournaments/:tournamentId/final-results', auth, requireResultManager, controller.getAdminFinalResult);
// Read existing registrations without importing the development registration flow.
router.get('/admin/tournaments/:tournamentId/result-registrations', auth, requireResultManager, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(req.params.tournamentId)) return res.status(400).json({ success: false, error: { message: 'Invalid tournament ID' } });
    const registrations = await require('../../models/TournamentRegistration').find({
      tournamentId: req.params.tournamentId, status: 'verified'
    }).select('teamName teamId tournamentId status teamLeader.name teamMembers.name substitutePlayer.name')
      .sort({ _id: 1 }).limit(500).lean();
    res.json({ success: true, data: { registrations } });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Unable to load result registrations' } });
  }
});
router.get('/admin/tournaments/:tournamentId/final-results/preview', auth, requireResultManager, controller.previewFinalResult);
router.post('/admin/tournaments/:tournamentId/final-results/preview', auth, requireResultManager, controller.previewFinalResult);
router.post('/admin/tournaments/:tournamentId/final-results/publish', auth, requireResultManager, controller.publishFinalResult);
router.post('/admin/tournaments/:tournamentId/final-results/void', auth, requireResultManager, controller.voidFinalResult);

module.exports = router;

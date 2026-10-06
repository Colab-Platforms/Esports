const express = require('express');
const auth = require('../../middleware/auth');
const { requireResultManager } = require('../game-results/game-results.utils');
const controller = require('./result-ingestion.controller');

const router = express.Router();

router.post(
  '/freefire/scoreboard',
  auth,
  requireResultManager,
  controller.upload.single('scoreboard'),
  controller.createFreeFireScoreboardJob
);
router.get('/:jobId', auth, requireResultManager, controller.getJob);
router.patch('/:jobId/review', auth, requireResultManager, controller.patchReview);
router.post('/:jobId/reprocess', auth, requireResultManager, controller.reprocess);
router.post('/:jobId/confirm', auth, requireResultManager, controller.confirm);
router.post('/:jobId/cancel', auth, requireResultManager, controller.cancel);

module.exports = router;

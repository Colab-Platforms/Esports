const express = require('express');
const auth = require('../../middleware/auth');
const { requireResultManager } = require('../game-results/game-results.utils');
const controller = require('./freefire-results.controller');

const router = express.Router();
const optionalAuth = (req, res, next) => (req.header('Authorization') ? auth(req, res, next) : next());

router.get('/tournament/:tournamentId', optionalAuth, controller.getTournamentResults);
router.get('/:id', optionalAuth, controller.getResultById);
router.post('/', auth, requireResultManager, controller.createResult);
router.patch('/:id', auth, requireResultManager, controller.updateResult);
router.put('/:id', auth, requireResultManager, controller.updateResult);
router.post('/:id/verify', auth, requireResultManager, controller.verifyResult);
router.post('/:id/void', auth, requireResultManager, controller.voidResult);

module.exports = router;

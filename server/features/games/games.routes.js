const express = require('express');
const gamesController = require('./games.controller');
const { gameAdminAuth } = require('./games.permissions');

const router = express.Router();

// Public
router.get('/', gamesController.getAllGames);
router.get('/featured', gamesController.getFeaturedGames);
router.get('/debug/all-games', gamesController.getDebugGames);

// Admin operations
router.post('/', gameAdminAuth, gamesController.createGame);
router.put('/:id', gameAdminAuth, gamesController.updateGame);
router.delete('/:id', gameAdminAuth, gamesController.deleteGame);
router.patch('/:id/stats', gameAdminAuth, gamesController.updateGameStats);
router.post('/admin/activate-all', gameAdminAuth, gamesController.activateAllGames);

router.get('/:id', gamesController.getGameById);

module.exports = router;

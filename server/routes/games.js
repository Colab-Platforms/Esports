const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Get all games
router.get('/', async (req, res) => {
  // Disable caching for games data
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  try {
    const games = await Game.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ message: 'Error fetching games', error: error.message });
  }
});

// Get featured games for banner
router.get('/featured', async (req, res) => {
  // Disable caching for featured games
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  try {
    const featuredGames = await Game.find({ 
      isActive: true, 
      featured: true 
    }).sort({ order: 1, createdAt: 1 });
    res.json(featuredGames);
  } catch (error) {
    console.error('Error fetching featured games:', error);
    res.status(500).json({ message: 'Error fetching featured games', error: error.message });
  }
});

// Get single game by ID
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findOne({ id: req.params.id, isActive: true });
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ message: 'Error fetching game', error: error.message });
  }
});

// Create new game (admin only)
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const game = new Game(req.body);
    await game.save();
    res.status(201).json(game);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ message: 'Error creating game', error: error.message });
  }
});

// Update game (admin only)
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const game = await Game.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    res.json(game);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ message: 'Error updating game', error: error.message });
  }
});

// Delete game (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const game = await Game.findOneAndDelete({ id: req.params.id });
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    res.json({ message: 'Game deleted successfully', game });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ message: 'Error deleting game', error: error.message });
  }
});

module.exports = router;

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
    
    console.log('🎮 Games API - Found games:', games.length);
    games.forEach((game, idx) => {
      console.log(`Game ${idx + 1}:`, {
        id: game.id,
        name: game.name,
        tournaments: game.tournaments,
        activePlayers: game.activePlayers,
        totalPrize: game.totalPrize
      });
    });
    
    res.json({
      success: true,
      data: {
        games: games
      }
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching games', 
      error: error.message 
    });
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
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
  try {
    console.log('🎮 Updating game:', req.params.id);
    console.log('📝 Update data:', req.body);
    
    const game = await Game.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!game) {
      console.log('❌ Game not found with id:', req.params.id);
      return res.status(404).json({ message: 'Game not found' });
    }
    
    console.log('✅ Game updated:', game);
    res.json(game);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ message: 'Error updating game', error: error.message });
  }
});

// Delete game (admin only)  
router.delete('/:id', async (req, res) => {
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

// Update game stats (admin only)
router.patch('/:id/stats', async (req, res) => {
  try {
    const { tournaments, activePlayers, totalPrize } = req.body;
    
    const game = await Game.findOneAndUpdate(
      { id: req.params.id },
      {
        ...(tournaments !== undefined && { tournaments }),
        ...(activePlayers !== undefined && { activePlayers }),
        ...(totalPrize !== undefined && { totalPrize })
      },
      { new: true, runValidators: true }
    );
    
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Game stats updated',
      game 
    });
  } catch (error) {
    console.error('Error updating game stats:', error);
    res.status(500).json({ message: 'Error updating game stats', error: error.message });
  }
});

// Activate all games (admin only - for production fix)
router.post('/admin/activate-all', async (req, res) => {
  try {
    const result = await Game.updateMany(
      {},
      { isActive: true }
    );
    
    console.log('✅ All games activated:', result.modifiedCount);
    
    res.json({
      success: true,
      message: 'All games activated',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error activating games:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error activating games', 
      error: error.message 
    });
  }
});

module.exports = router;

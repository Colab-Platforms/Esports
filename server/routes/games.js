const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const redisService = require('../services/redisService');

// Get all games
router.get('/', async (req, res) => {
  // Enable 5-minute caching for games data (same as tournaments)
  res.set({
    'Cache-Control': 'public, max-age=300',
    'Pragma': 'cache',
    'Expires': new Date(Date.now() + 300000).toUTCString()
  });
  
  try {
    // Check Redis cache first
    const cacheKey = 'games:all:active';
    const cachedGames = await redisService.get(cacheKey);
    
    if (cachedGames) {
      console.log('✅ Games found in cache');
      return res.json({
        success: true,
        data: {
          games: cachedGames
        },
        cached: true
      });
    }

    const games = await Game.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
    
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
    
    // Cache the response (5 minutes TTL)
    await redisService.set(cacheKey, games, 300);
    
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
  // Enable 5-minute caching for featured games
  res.set({
    'Cache-Control': 'public, max-age=300',
    'Pragma': 'cache',
    'Expires': new Date(Date.now() + 300000).toUTCString()
  });
  
  try {
    // Check Redis cache first
    const cacheKey = 'games:featured';
    const cachedFeaturedGames = await redisService.get(cacheKey);
    
    if (cachedFeaturedGames) {
      console.log('✅ Featured games found in cache');
      return res.json(cachedFeaturedGames);
    }

    const featuredGames = await Game.find({ 
      isActive: true, 
      featured: true 
    }).sort({ order: 1, createdAt: 1 }).lean();
    
    // Cache the response (5 minutes TTL)
    await redisService.set(cacheKey, featuredGames, 300);
    
    res.json(featuredGames);
  } catch (error) {
    console.error('Error fetching featured games:', error);
    res.status(500).json({ message: 'Error fetching featured games', error: error.message });
  }
});

// Get single game by ID
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findOne({ id: req.params.id, isActive: true }).lean();
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
    const savedGame = await game.save();
    const plainGame = savedGame.toObject();
    
    // Ensure _id is a string for client-side usage
    if (plainGame._id) {
      plainGame._id = plainGame._id.toString();
    }
    
    res.status(201).json({
      success: true,
      message: 'Game created successfully',
      game: plainGame
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating game', 
      error: error.message 
    });
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
    ).lean();
    
    if (!game) {
      console.log('❌ Game not found with id:', req.params.id);
      return res.status(404).json({ message: 'Game not found' });
    }
    
    console.log('✅ Game updated:', game);
    res.json({
      success: true,
      message: 'Game updated successfully',
      game: game
    });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating game', 
      error: error.message 
    });
  }
});

// Delete game (admin only)  
router.delete('/:id', async (req, res) => {
  try {
    const game = await Game.findOneAndDelete({ id: req.params.id }).lean();
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    res.json({ 
      success: true,
      message: 'Game deleted successfully', 
      game: game 
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting game', 
      error: error.message 
    });
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
    ).lean();
    
    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }
    
    res.json({ 
      success: true,
      message: 'Game stats updated',
      game: game
    });
  } catch (error) {
    console.error('Error updating game stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating game stats', 
      error: error.message 
    });
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

// Debug endpoint - check all games in database
router.get('/debug/all-games', async (req, res) => {
  try {
    const allGames = await Game.find({}).lean();
    const activeGames = await Game.find({ isActive: true }).lean();
    
    console.log('🔍 DEBUG - All games in database:');
    console.log(JSON.stringify(allGames, null, 2));
    console.log('🔍 DEBUG - Active games only:');
    console.log(JSON.stringify(activeGames, null, 2));
    
    res.json({
      success: true,
      allGames: allGames,
      activeGames: activeGames,
      totalCount: allGames.length,
      activeCount: activeGames.length
    });
  } catch (error) {
    console.error('Error fetching debug games:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching games', 
      error: error.message 
    });
  }
});

module.exports = router;

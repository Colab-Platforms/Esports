const gamesService = require('./games.service');
const { GAMES_CACHE_HEADERS_MAX_AGE_MS } = require('./games.constants');

const setGameCacheHeaders = (res) => {
  res.set({
    'Cache-Control': 'public, max-age=300',
    'Pragma': 'cache',
    'Expires': new Date(Date.now() + GAMES_CACHE_HEADERS_MAX_AGE_MS).toUTCString()
  });
};

const getAllGames = async (req, res) => {
  setGameCacheHeaders(res);

  try {
    const { games, cached } = await gamesService.getActiveGames();
    const response = {
      success: true,
      data: { games }
    };

    if (cached) {
      response.cached = true;
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching games',
      error: error.message
    });
  }
};

const getFeaturedGames = async (req, res) => {
  setGameCacheHeaders(res);

  try {
    const { featuredGames } = await gamesService.getFeaturedGames();
    res.json(featuredGames);
  } catch (error) {
    console.error('Error fetching featured games:', error);
    res.status(500).json({ message: 'Error fetching featured games', error: error.message });
  }
};

const getGameById = async (req, res) => {
  try {
    const game = await gamesService.getGameById(req.params.id);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json(game);
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ message: 'Error fetching game', error: error.message });
  }
};

const createGame = async (req, res) => {
  try {
    const game = await gamesService.createGame(req.body);

    res.status(201).json({
      success: true,
      message: 'Game created successfully',
      game
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating game',
      error: error.message
    });
  }
};

const updateGame = async (req, res) => {
  try {
    const game = await gamesService.updateGame(req.params.id, req.body);

    if (!game) {
      console.log('❌ Game not found with id:', req.params.id);
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json({
      success: true,
      message: 'Game updated successfully',
      game
    });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating game',
      error: error.message
    });
  }
};

const deleteGame = async (req, res) => {
  try {
    const game = await gamesService.deleteGame(req.params.id);

    if (!game) {
      return res.status(404).json({ message: 'Game not found' });
    }

    res.json({
      success: true,
      message: 'Game deleted successfully',
      game
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting game',
      error: error.message
    });
  }
};

const updateGameStats = async (req, res) => {
  try {
    const game = await gamesService.updateGameStats(req.params.id, req.body);

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
    res.status(500).json({
      success: false,
      message: 'Error updating game stats',
      error: error.message
    });
  }
};

const activateAllGames = async (req, res) => {
  try {
    const result = await gamesService.activateAllGames();

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
};

const getDebugGames = async (req, res) => {
  try {
    const data = await gamesService.getDebugGames();

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Error fetching debug games:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching games',
      error: error.message
    });
  }
};

module.exports = {
  activateAllGames,
  createGame,
  deleteGame,
  getAllGames,
  getDebugGames,
  getFeaturedGames,
  getGameById,
  updateGame,
  updateGameStats
};

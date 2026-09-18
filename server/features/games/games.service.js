const Game = require('./game.model');
const redisService = require('../../services/redisService');
const {
  ACTIVE_GAMES_CACHE_KEY,
  ACTIVE_GAMES_SORT,
  FEATURED_GAMES_CACHE_KEY,
  GAMES_CACHE_TTL_SECONDS
} = require('./games.constants');

const invalidateGamesCache = async () => {
  await redisService.delete(ACTIVE_GAMES_CACHE_KEY);
  await redisService.delete(FEATURED_GAMES_CACHE_KEY);
};

const getActiveGames = async () => {
  const cachedGames = await redisService.get(ACTIVE_GAMES_CACHE_KEY);

  if (cachedGames) {
    console.log('✅ Games found in cache');
    return { games: cachedGames, cached: true };
  }

  const games = await Game.find({ isActive: true }).sort(ACTIVE_GAMES_SORT).lean();

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

  await redisService.set(ACTIVE_GAMES_CACHE_KEY, games, GAMES_CACHE_TTL_SECONDS);

  return { games, cached: false };
};

const getFeaturedGames = async () => {
  const cachedFeaturedGames = await redisService.get(FEATURED_GAMES_CACHE_KEY);

  if (cachedFeaturedGames) {
    console.log('✅ Featured games found in cache');
    return { featuredGames: cachedFeaturedGames, cached: true };
  }

  const featuredGames = await Game.find({
    isActive: true,
    featured: true
  }).sort(ACTIVE_GAMES_SORT).lean();

  await redisService.set(FEATURED_GAMES_CACHE_KEY, featuredGames, GAMES_CACHE_TTL_SECONDS);

  return { featuredGames, cached: false };
};

const getGameById = async (id) => Game.findOne({ id, isActive: true }).lean();

const createGame = async (data) => {
  const game = new Game(data);
  const savedGame = await game.save();
  const plainGame = savedGame.toObject();

  if (plainGame._id) {
    plainGame._id = plainGame._id.toString();
  }

  return plainGame;
};

const updateGame = async (id, data) => {
  console.log('🎮 Updating game:', id);
  console.log('📝 Update data:', data);

  const game = await Game.findOneAndUpdate(
    { id },
    data,
    { new: true, runValidators: true }
  ).lean();

  if (game) {
    await invalidateGamesCache();
    console.log('✅ Game cache invalidated');
    console.log('✅ Game updated:', game);
  }

  return game;
};

const deleteGame = async (id) => {
  const game = await Game.findOneAndDelete({ id }).lean();

  if (game) {
    await invalidateGamesCache();
    console.log('✅ Game cache invalidated');
  }

  return game;
};

const updateGameStats = async (id, stats) => {
  const { tournaments, activePlayers, totalPrize } = stats;

  const game = await Game.findOneAndUpdate(
    { id },
    {
      ...(tournaments !== undefined && { tournaments }),
      ...(activePlayers !== undefined && { activePlayers }),
      ...(totalPrize !== undefined && { totalPrize })
    },
    { new: true, runValidators: true }
  ).lean();

  if (game) {
    await invalidateGamesCache();
    console.log('✅ Game cache invalidated');
  }

  return game;
};

const activateAllGames = async () => {
  const result = await Game.updateMany({}, { isActive: true });
  await invalidateGamesCache();

  console.log('✅ All games activated:', result.modifiedCount);

  return result;
};

const getDebugGames = async () => {
  const allGames = await Game.find({}).lean();
  const activeGames = await Game.find({ isActive: true }).lean();

  console.log('🔍 DEBUG - All games in database:');
  console.log(JSON.stringify(allGames, null, 2));
  console.log('🔍 DEBUG - Active games only:');
  console.log(JSON.stringify(activeGames, null, 2));

  return {
    allGames,
    activeGames,
    totalCount: allGames.length,
    activeCount: activeGames.length
  };
};

module.exports = {
  activateAllGames,
  createGame,
  deleteGame,
  getActiveGames,
  getDebugGames,
  getFeaturedGames,
  getGameById,
  updateGame,
  updateGameStats
};

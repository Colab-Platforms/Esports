const leaderboardsService = require('./leaderboards.service');

const getTeamLeaderboard = async (req, res) => {
  try {
    const leaderboard = await leaderboardsService.getTeamLeaderboard(req.params.gameType, req.query);
    res.json({
      success: true,
      data: leaderboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: {
        code: error.code || (status === 500 ? 'LEADERBOARD_FETCH_FAILED' : 'INVALID_REQUEST'),
        message: status === 500 ? 'Failed to fetch leaderboard' : error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  getTeamLeaderboard
};

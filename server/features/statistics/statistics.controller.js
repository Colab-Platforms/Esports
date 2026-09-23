const statisticsService = require('./statistics.service');

const errorCode = (error, entity) => {
  if (error.status === 404) return `${entity}_NOT_FOUND`;
  return 'SERVER_ERROR';
};

const getPlayerStatistics = async (req, res) => {
  try {
    const statistics = await statisticsService.getPlayerStatistics(req.params.username);
    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Player statistics error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: errorCode(error, 'PLAYER'),
        message: error.status === 404 ? 'Player not found' : 'Failed to load player statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
};

const getTeamStatistics = async (req, res) => {
  try {
    const statistics = await statisticsService.getTeamStatistics(req.params.teamId);
    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Team statistics error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: errorCode(error, 'TEAM'),
        message: error.status === 404 ? 'Team not found' : 'Failed to load team statistics',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  getPlayerStatistics,
  getTeamStatistics
};

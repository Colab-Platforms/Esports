const streakService = require('./streak.service');

const errorResponse = (res, status, code, message) => res.status(status).json({
  success: false,
  error: {
    code,
    message,
    timestamp: new Date().toISOString()
  }
});

const checkIn = async (req, res) => {
  try {
    const data = await streakService.checkIn(req.user.userId || req.user.id);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Activity streak check-in error:', error);
    errorResponse(
      res,
      error.status || 500,
      error.status === 404 ? 'USER_NOT_FOUND' : 'SERVER_ERROR',
      error.status === 404 ? error.message : 'Failed to check in activity streak'
    );
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const data = await streakService.getLeaderboard(req.user.userId || req.user.id, req.query);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Activity streak leaderboard error:', error);
    errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch activity streak leaderboard');
  }
};

module.exports = {
  checkIn,
  getLeaderboard
};

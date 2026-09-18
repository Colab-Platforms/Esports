const competitionDashboardService = require('./competition-dashboard.service');

const getCompetitionDashboard = async (req, res) => {
  try {
    const dashboard = await competitionDashboardService.getCompetitionDashboard(req.user.userId || req.user.id);

    res.json({
      success: true,
      data: dashboard,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Competition dashboard error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.status === 404 ? 'USER_NOT_FOUND' : 'COMPETITION_DASHBOARD_FAILED',
        message: error.status === 404 ? 'User not found' : 'Failed to load competition dashboard',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  getCompetitionDashboard
};

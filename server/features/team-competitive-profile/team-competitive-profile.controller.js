const teamCompetitiveProfileService = require('./team-competitive-profile.service');

const getTeamCompetitiveProfile = async (req, res) => {
  try {
    const profile = await teamCompetitiveProfileService.getTeamCompetitiveProfile(req.params.teamId);
    res.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Team competitive profile error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.status === 404 ? 'TEAM_NOT_FOUND' : 'SERVER_ERROR',
        message: error.status === 404 ? 'Team not found' : 'Failed to load team competitive profile',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  getTeamCompetitiveProfile
};

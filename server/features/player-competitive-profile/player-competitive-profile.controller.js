const playerCompetitiveProfileService = require('./player-competitive-profile.service');

const getPlayerCompetitiveProfile = async (req, res) => {
  try {
    const profile = await playerCompetitiveProfileService.getPlayerCompetitiveProfile(req.params.username);

    res.json({
      success: true,
      data: profile,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Player competitive profile error:', error);

    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.status === 404 ? 'PLAYER_NOT_FOUND' : 'SERVER_ERROR',
        message: error.status === 404 ? 'Player not found' : 'Failed to load player competitive profile',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  getPlayerCompetitiveProfile
};

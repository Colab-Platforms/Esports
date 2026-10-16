const competitiveHistoryService = require('./competitive-history.service');
const { filterPublicTeams } = require('../game-results/public-result-privacy');

const getPlayerCompetitiveHistory = async (req, res) => {
  try {
    const result = await competitiveHistoryService.getCompetitiveHistory(req.params.username, req.query);
    const teams = await filterPublicTeams(result.history.map(event => ({
      canonicalTeamId: event.team?.entityType === 'team' ? event.team.entityId : null
    })));
    result.history = result.history.map((event, index) => {
      if (event.team?.entityType !== 'team' || teams[index].canonicalTeamId) return event;
      return { ...event, team: { ...event.team, entityType: 'unlinked', entityId: null } };
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Player competitive history error:', error);

    res.status(error.status || 500).json({
      success: false,
      error: {
        code: error.status === 404 ? 'PLAYER_NOT_FOUND' : 'SERVER_ERROR',
        message: error.status === 404 ? 'Player not found' : 'Failed to load player competitive history',
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = {
  getPlayerCompetitiveHistory
};

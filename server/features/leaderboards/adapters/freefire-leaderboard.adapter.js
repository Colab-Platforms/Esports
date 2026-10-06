const FreeFireMatchResult = require('../../freefire-results/freefire-match-result.model');
const { RESULT_STATUSES } = require('../../game-results/game-results.utils');
const { round, toId } = require('./leaderboard-adapter.utils');

const getFreeFireLeaderboardRows = async ({ models = {} } = {}) => {
  const ResultModel = models.FreeFireMatchResult || FreeFireMatchResult;
  const rows = await ResultModel.aggregate([
    { $match: { status: RESULT_STATUSES.VERIFIED } },
    { $unwind: '$teamResults' },
    {
      $match: {
        'teamResults.canonicalTeamId': { $ne: null }
      }
    },
    {
      $group: {
        _id: '$teamResults.canonicalTeamId',
        matchesPlayed: { $sum: 1 },
        totalPoints: { $sum: { $ifNull: ['$teamResults.totalPoints', 0] } },
        placementPoints: { $sum: { $ifNull: ['$teamResults.placementPoints', 0] } },
        killPoints: { $sum: { $ifNull: ['$teamResults.killPoints', 0] } },
        wins: {
          $sum: {
            $cond: [{ $eq: ['$teamResults.placement', 1] }, 1, 0]
          }
        },
        totalKills: { $sum: { $ifNull: ['$teamResults.kills', 0] } },
        placementSum: { $sum: { $ifNull: ['$teamResults.placement', 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        teamId: '$_id',
        matchesPlayed: 1,
        totalPoints: 1,
        placementPoints: 1,
        killPoints: 1,
        wins: 1,
        totalKills: 1,
        averagePlacement: {
          $cond: [
            { $gt: ['$matchesPlayed', 0] },
            { $divide: ['$placementSum', '$matchesPlayed'] },
            0
          ]
        }
      }
    }
  ]);

  return rows.map((row) => ({
    teamId: toId(row.teamId),
    stats: {
      matchesPlayed: row.matchesPlayed || 0,
      totalPoints: row.totalPoints || 0,
      placementPoints: row.placementPoints || 0,
      killPoints: row.killPoints || 0,
      wins: row.wins || 0,
      totalKills: row.totalKills || 0,
      averagePlacement: round(row.averagePlacement || 0)
    }
  }));
};

module.exports = {
  getFreeFireLeaderboardRows
};

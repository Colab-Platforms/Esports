const BGMIMatch = require('../../../models/BGMIMatch');
const { round, toId } = require('./leaderboard-adapter.utils');

const getBgmiLeaderboardRows = async ({ models = {} } = {}) => {
  const MatchModel = models.BGMIMatch || BGMIMatch;
  const rows = await MatchModel.aggregate([
    { $match: { status: 'completed' } },
    { $unwind: '$teamResults' },
    {
      $match: {
        'teamResults.verified': true,
        'teamResults.teamId': { $ne: null }
      }
    },
    {
      $group: {
        _id: '$teamResults.teamId',
        matchesPlayed: { $sum: 1 },
        totalPoints: { $sum: { $ifNull: ['$teamResults.points', 0] } },
        wins: {
          $sum: {
            $cond: [{ $eq: ['$teamResults.placement', 1] }, 1, 0]
          }
        },
        top3Finishes: {
          $sum: {
            $cond: [{ $lte: ['$teamResults.placement', 3] }, 1, 0]
          }
        },
        top5Finishes: {
          $sum: {
            $cond: [{ $lte: ['$teamResults.placement', 5] }, 1, 0]
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
        wins: 1,
        top3Finishes: 1,
        top5Finishes: 1,
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
      wins: row.wins || 0,
      top3Finishes: row.top3Finishes || 0,
      top5Finishes: row.top5Finishes || 0,
      totalKills: row.totalKills || 0,
      averagePlacement: round(row.averagePlacement || 0)
    }
  }));
};

module.exports = {
  getBgmiLeaderboardRows
};

const ValorantMatchResult = require('../../valorant-results/valorant-match-result.model');
const { RESULT_STATUSES } = require('../../game-results/game-results.utils');
const { round, toId } = require('./leaderboard-adapter.utils');

const sidePipeline = ({ sidePath, opponentPath }) => ([
  { $match: { status: RESULT_STATUSES.VERIFIED, [`${sidePath}.canonicalTeamId`]: { $ne: null } } },
  {
    $project: {
      teamId: `$${sidePath}.canonicalTeamId`,
      registrationId: `$${sidePath}.registrationId`,
      scoreFor: { $ifNull: [`$${sidePath}.score`, 0] },
      scoreAgainst: { $ifNull: [`$${opponentPath}.score`, 0] },
      winnerRegistrationId: '$winnerRegistrationId'
    }
  },
  {
    $group: {
      _id: '$teamId',
      matchesPlayed: { $sum: 1 },
      wins: {
        $sum: {
          $cond: [{ $eq: ['$winnerRegistrationId', '$registrationId'] }, 1, 0]
        }
      },
      roundsFor: { $sum: '$scoreFor' },
      roundsAgainst: { $sum: '$scoreAgainst' }
    }
  }
]);

const mergeSideRows = (rows) => {
  const byTeam = new Map();
  for (const row of rows) {
    const teamId = toId(row._id);
    if (!teamId) continue;
    const current = byTeam.get(teamId) || {
      teamId,
      matchesPlayed: 0,
      wins: 0,
      roundsFor: 0,
      roundsAgainst: 0
    };

    current.matchesPlayed += row.matchesPlayed || 0;
    current.wins += row.wins || 0;
    current.roundsFor += row.roundsFor || 0;
    current.roundsAgainst += row.roundsAgainst || 0;
    byTeam.set(teamId, current);
  }
  return Array.from(byTeam.values());
};

const getValorantLeaderboardRows = async ({ models = {} } = {}) => {
  const ResultModel = models.ValorantMatchResult || ValorantMatchResult;
  const [teamARows, teamBRows] = await Promise.all([
    ResultModel.aggregate(sidePipeline({ sidePath: 'teamA', opponentPath: 'teamB' })),
    ResultModel.aggregate(sidePipeline({ sidePath: 'teamB', opponentPath: 'teamA' }))
  ]);

  return mergeSideRows([...teamARows, ...teamBRows]).map((row) => {
    const losses = row.matchesPlayed - row.wins;
    const winRate = row.matchesPlayed > 0 ? (row.wins / row.matchesPlayed) * 100 : 0;
    const roundDifferential = row.roundsFor - row.roundsAgainst;

    return {
      teamId: row.teamId,
      stats: {
        matchesPlayed: row.matchesPlayed,
        wins: row.wins,
        losses,
        winRate: round(winRate),
        roundsFor: row.roundsFor,
        roundsAgainst: row.roundsAgainst,
        roundDifferential
      }
    };
  });
};

module.exports = {
  getValorantLeaderboardRows,
  mergeSideRows
};

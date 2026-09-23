const BGMIMatch = require('../../../models/BGMIMatch');
const { supportedValue, unavailableValue } = require('../statistics.constants');
const { asNumber, average, sortNewestFirst, toId } = require('./statistics.utils');

const emptyTeamStats = () => ({
  matchesPlayed: 0,
  totalKills: 0,
  averageKills: null,
  averagePlacement: null,
  bestPlacement: null,
  wins: 0,
  top3Finishes: 0,
  top5Finishes: 0,
  totalPoints: 0,
  averagePoints: null,
  recentForm: []
});

const summarizeBgmiTeamResults = (rows = []) => {
  const stats = emptyTeamStats();
  if (rows.length === 0) return stats;

  let placementSum = 0;
  let killSum = 0;
  let pointSum = 0;
  let placementCount = 0;

  for (const row of rows) {
    const placement = asNumber(row.teamResult?.placement, null);
    const kills = asNumber(row.teamResult?.kills, 0);
    const points = asNumber(row.teamResult?.points, 0);

    stats.matchesPlayed += 1;
    stats.totalKills += kills;
    stats.totalPoints += points;
    killSum += kills;
    pointSum += points;

    if (Number.isFinite(placement)) {
      placementCount += 1;
      placementSum += placement;
      stats.bestPlacement = stats.bestPlacement === null ? placement : Math.min(stats.bestPlacement, placement);
      if (placement === 1) stats.wins += 1;
      if (placement <= 3) stats.top3Finishes += 1;
      if (placement <= 5) stats.top5Finishes += 1;
    }
  }

  stats.averageKills = average(killSum, stats.matchesPlayed);
  stats.averagePlacement = average(placementSum, placementCount);
  stats.averagePoints = average(pointSum, stats.matchesPlayed);
  stats.recentForm = sortNewestFirst(rows)
    .slice(0, 5)
    .map((row) => ({
      placement: row.teamResult?.placement ?? null,
      kills: row.teamResult?.kills ?? null,
      points: row.teamResult?.points ?? null,
      occurredAt: row.match.endTime || row.match.updatedAt || row.match.createdAt || null
    }));

  return stats;
};

const getVerifiedTeamRows = async ({ teamId, models = {} }) => {
  if (!teamId) return [];
  const MatchModel = models.BGMIMatch || BGMIMatch;
  const id = toId(teamId);

  const matches = await MatchModel.find({
    status: 'completed',
    teamResults: {
      $elemMatch: {
        teamId,
        verified: true
      }
    }
  })
    .select('tournamentId matchNumber map status endTime updatedAt createdAt teamResults')
    .sort({ endTime: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const rows = [];
  for (const match of matches) {
    for (const teamResult of match.teamResults || []) {
      if (toId(teamResult.teamId) === id && teamResult.verified === true) {
        rows.push({ match, teamResult });
      }
    }
  }
  return rows;
};

const getBgmiTeamStatistics = async ({ teamId, models = {} }) => {
  const rows = await getVerifiedTeamRows({ teamId, models });
  return {
    supported: true,
    performance: summarizeBgmiTeamResults(rows),
    unsupported: []
  };
};

const getBgmiPlayerStatistics = async () => ({
  supported: true,
  performance: {
    matchesPlayed: unavailableValue('BGMI result rows do not store historical player roster snapshots.'),
    totalKills: unavailableValue('BGMI kills are stored at team level only.'),
    averagePlacement: unavailableValue('BGMI player match participation cannot be proven from current result data.')
  },
  participation: {
    registeredTeams: supportedValue(0)
  },
  unsupported: [
    'individual_bgmi_kills',
    'individual_bgmi_points',
    'individual_bgmi_average_placement',
    'bgmi_player_match_count'
  ]
});

module.exports = {
  getBgmiPlayerStatistics,
  getBgmiTeamStatistics,
  summarizeBgmiTeamResults
};

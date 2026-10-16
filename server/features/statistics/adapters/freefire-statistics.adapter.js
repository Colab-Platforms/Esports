const FreeFireMatchResult = require('../../freefire-results/freefire-match-result.model');
const { RESULT_STATUSES } = require('../../game-results/game-results.utils');
const { unavailableValue } = require('../statistics.constants');
const { asNumber, average, rosterHasUser, sortNewestFirst, toId } = require('./statistics.utils');

const emptyBattleRoyaleStats = () => ({
  matchesPlayed: 0,
  totalKills: 0,
  averageKills: null,
  averagePlacement: null,
  bestPlacement: null,
  wins: 0,
  top3Finishes: 0,
  top5Finishes: 0,
  placementPoints: 0,
  killPoints: 0,
  totalPoints: 0,
  averagePoints: null,
  recentForm: []
});

const summarizeFreeFireTeamResults = (rows = []) => {
  const stats = emptyBattleRoyaleStats();
  if (rows.length === 0) return stats;

  let placementSum = 0;
  let placementCount = 0;
  let killSum = 0;
  let pointSum = 0;

  for (const row of rows) {
    const result = row.teamResult || {};
    const placement = asNumber(result.placement, null);
    const kills = asNumber(result.kills, 0);
    const placementPoints = asNumber(result.placementPoints, 0);
    const killPoints = asNumber(result.killPoints, 0);
    const totalPoints = asNumber(result.totalPoints, placementPoints + killPoints);

    stats.matchesPlayed += 1;
    stats.totalKills += kills;
    stats.placementPoints += placementPoints;
    stats.killPoints += killPoints;
    stats.totalPoints += totalPoints;
    killSum += kills;
    pointSum += totalPoints;

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
      points: row.teamResult?.totalPoints ?? null,
      occurredAt: row.match.playedAt || row.match.verifiedAt || row.match.updatedAt || row.match.createdAt || null
    }));

  return stats;
};

const collectTeamRows = (matches, matcher) => {
  const rows = [];
  for (const match of matches || []) {
    for (const teamResult of match.teamResults || []) {
      if (matcher(teamResult)) rows.push({ match, teamResult });
    }
  }
  return rows;
};

const getFreeFireTeamStatistics = async ({ teamId, registrationIds = [], models = {} }) => {
  const ResultModel = models.FreeFireMatchResult || FreeFireMatchResult;
  const teamIdString = toId(teamId);
  const registrationIdSet = new Set(registrationIds.map(toId).filter(Boolean));
  const or = [];

  if (teamId) or.push({ 'teamResults.canonicalTeamId': teamId });
  if (registrationIdSet.size > 0) or.push({ 'teamResults.registrationId': { $in: Array.from(registrationIdSet) } });

  if (or.length === 0) {
    return { supported: true, performance: emptyBattleRoyaleStats(), unsupported: [] };
  }

  const matches = await ResultModel.find({ status: RESULT_STATUSES.VERIFIED, $or: or })
    .select('tournamentId lobbyNumber matchNumber map status playedAt verifiedAt updatedAt createdAt teamResults')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const rows = collectTeamRows(matches, (teamResult) => (
    toId(teamResult.canonicalTeamId) === teamIdString ||
    registrationIdSet.has(toId(teamResult.registrationId))
  ));

  return {
    supported: true,
    performance: summarizeFreeFireTeamResults(rows),
    unsupported: []
  };
};

const getFreeFirePlayerStatistics = async ({ user, models = {} }) => {
  const ResultModel = models.FreeFireMatchResult || FreeFireMatchResult;
  const userId = toId(user?._id);
  if (!userId) {
    return {
      supported: true,
      performance: emptyPlayerStats(),
      unsupported: ['freefire_player_kills']
    };
  }

  const matches = await ResultModel.find({
    status: RESULT_STATUSES.VERIFIED,
    'teamResults.rosterSnapshot.userId': user._id
  })
    .select('tournamentId lobbyNumber matchNumber map status playedAt verifiedAt updatedAt createdAt teamResults')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const rows = collectTeamRows(matches, (teamResult) => rosterHasUser(teamResult.rosterSnapshot, user._id));
  return {
    supported: true,
    performance: summarizeFreeFirePlayerRows(rows),
    unsupported: [
      'freefire_player_kills',
      'freefire_player_average_kills'
    ]
  };
};

const emptyPlayerStats = () => ({
  matchesParticipated: 0,
  firstPlaceParticipations: 0,
  top3Participations: 0,
  top5Participations: 0,
  averageTeamPlacementWhileRostered: null,
  teamPointsWhileRostered: 0,
  playerKills: unavailableValue('Individual Free Fire kills are not stored.'),
  playerAverageKills: unavailableValue('Free Fire kills are stored at team level only.'),
  recentForm: []
});

const summarizeFreeFirePlayerRows = (rows = []) => {
  const stats = emptyPlayerStats();
  if (rows.length === 0) return stats;

  let placementSum = 0;
  let placementCount = 0;

  for (const row of rows) {
    const result = row.teamResult || {};
    const placement = asNumber(result.placement, null);

    stats.matchesParticipated += 1;
    stats.teamPointsWhileRostered += asNumber(result.totalPoints, 0);

    if (Number.isFinite(placement)) {
      placementCount += 1;
      placementSum += placement;
      if (placement === 1) stats.firstPlaceParticipations += 1;
      if (placement <= 3) stats.top3Participations += 1;
      if (placement <= 5) stats.top5Participations += 1;
    }
  }

  stats.averageTeamPlacementWhileRostered = average(placementSum, placementCount);
  stats.recentForm = sortNewestFirst(rows)
    .slice(0, 5)
    .map((row) => ({
      placement: row.teamResult?.placement ?? null,
      points: row.teamResult?.totalPoints ?? null,
      occurredAt: row.match.playedAt || row.match.verifiedAt || row.match.updatedAt || row.match.createdAt || null
    }));

  return stats;
};

module.exports = {
  emptyBattleRoyaleStats,
  getFreeFirePlayerStatistics,
  getFreeFireTeamStatistics,
  summarizeFreeFirePlayerRows,
  summarizeFreeFireTeamResults
};

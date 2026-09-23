const ValorantMatchResult = require('../../valorant-results/valorant-match-result.model');
const { RESULT_STATUSES } = require('../../game-results/game-results.utils');
const { unavailableValue } = require('../statistics.constants');
const { asNumber, average, rosterHasUser, round, sortNewestFirst, toId } = require('./statistics.utils');

const emptyValorantStats = () => ({
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  winRate: null,
  roundsFor: 0,
  roundsAgainst: 0,
  roundDifferential: 0,
  averageRoundsFor: null,
  averageRoundsAgainst: null,
  mapBreakdown: [],
  recentForm: []
});

const sideForTeam = (match, teamId, registrationIds = []) => {
  const teamIdString = toId(teamId);
  const registrationIdSet = new Set(registrationIds.map(toId).filter(Boolean));
  const sides = [match.teamA, match.teamB];
  return sides.find((side) => (
    toId(side?.canonicalTeamId) === teamIdString ||
    registrationIdSet.has(toId(side?.registrationId))
  ));
};

const opponentForSide = (match, side) => (
  toId(match.teamA?.registrationId) === toId(side?.registrationId) ? match.teamB : match.teamA
);

const summarizeValorantSides = (rows = []) => {
  const stats = emptyValorantStats();
  if (rows.length === 0) return stats;

  const mapTotals = new Map();

  for (const row of rows) {
    const scoreFor = asNumber(row.side?.score, 0);
    const scoreAgainst = asNumber(row.opponent?.score, 0);
    const won = toId(row.match.winnerRegistrationId) === toId(row.side?.registrationId);
    const map = row.match.map || '';

    stats.matchesPlayed += 1;
    stats.roundsFor += scoreFor;
    stats.roundsAgainst += scoreAgainst;
    if (won) stats.wins += 1;
    else stats.losses += 1;

    if (map) {
      const current = mapTotals.get(map) || { map, matchesPlayed: 0, wins: 0, losses: 0 };
      current.matchesPlayed += 1;
      if (won) current.wins += 1;
      else current.losses += 1;
      mapTotals.set(map, current);
    }
  }

  stats.winRate = stats.matchesPlayed > 0 ? round((stats.wins / stats.matchesPlayed) * 100) : null;
  stats.roundDifferential = stats.roundsFor - stats.roundsAgainst;
  stats.averageRoundsFor = average(stats.roundsFor, stats.matchesPlayed);
  stats.averageRoundsAgainst = average(stats.roundsAgainst, stats.matchesPlayed);
  stats.mapBreakdown = Array.from(mapTotals.values()).map((entry) => ({
    ...entry,
    winRate: entry.matchesPlayed > 0 ? round((entry.wins / entry.matchesPlayed) * 100) : null
  }));
  stats.recentForm = sortNewestFirst(rows)
    .slice(0, 5)
    .map((row) => ({
      result: toId(row.match.winnerRegistrationId) === toId(row.side?.registrationId) ? 'W' : 'L',
      scoreFor: row.side?.score ?? null,
      scoreAgainst: row.opponent?.score ?? null,
      map: row.match.map || '',
      occurredAt: row.match.playedAt || row.match.verifiedAt || row.match.updatedAt || row.match.createdAt || null
    }));

  return stats;
};

const getValorantTeamStatistics = async ({ teamId, registrationIds = [], models = {} }) => {
  const ResultModel = models.ValorantMatchResult || ValorantMatchResult;
  const registrationIdSet = new Set(registrationIds.map(toId).filter(Boolean));
  const or = [];

  if (teamId) {
    or.push({ 'teamA.canonicalTeamId': teamId }, { 'teamB.canonicalTeamId': teamId });
  }
  if (registrationIdSet.size > 0) {
    const registrationIdsArray = Array.from(registrationIdSet);
    or.push(
      { 'teamA.registrationId': { $in: registrationIdsArray } },
      { 'teamB.registrationId': { $in: registrationIdsArray } }
    );
  }

  if (or.length === 0) return { supported: true, performance: emptyValorantStats(), unsupported: [] };

  const matches = await ResultModel.find({ status: RESULT_STATUSES.VERIFIED, $or: or })
    .select('tournamentId matchNumber status playedAt verifiedAt updatedAt createdAt map teamA teamB winnerRegistrationId')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const rows = matches
    .map((match) => {
      const side = sideForTeam(match, teamId, Array.from(registrationIdSet));
      if (!side) return null;
      return { match, side, opponent: opponentForSide(match, side) };
    })
    .filter(Boolean);

  return {
    supported: true,
    performance: summarizeValorantSides(rows),
    unsupported: []
  };
};

const getValorantPlayerStatistics = async ({ user, models = {} }) => {
  const ResultModel = models.ValorantMatchResult || ValorantMatchResult;
  if (!user?._id) {
    return {
      supported: true,
      performance: emptyValorantPlayerStats(),
      unsupported: unsupportedPlayerMetrics()
    };
  }

  const matches = await ResultModel.find({
    status: RESULT_STATUSES.VERIFIED,
    $or: [
      { 'teamA.rosterSnapshot.userId': user._id },
      { 'teamB.rosterSnapshot.userId': user._id }
    ]
  })
    .select('tournamentId matchNumber status playedAt verifiedAt updatedAt createdAt map teamA teamB winnerRegistrationId')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const rows = matches
    .map((match) => {
      if (rosterHasUser(match.teamA?.rosterSnapshot, user._id)) {
        return { match, side: match.teamA, opponent: match.teamB };
      }
      if (rosterHasUser(match.teamB?.rosterSnapshot, user._id)) {
        return { match, side: match.teamB, opponent: match.teamA };
      }
      return null;
    })
    .filter(Boolean);

  const teamStats = summarizeValorantSides(rows);
  return {
    supported: true,
    performance: {
      matchesParticipated: teamStats.matchesPlayed,
      winsParticipated: teamStats.wins,
      lossesParticipated: teamStats.losses,
      winRateParticipated: teamStats.winRate,
      roundsForWhileRostered: teamStats.roundsFor,
      roundsAgainstWhileRostered: teamStats.roundsAgainst,
      roundDifferentialWhileRostered: teamStats.roundDifferential,
      personalKills: unavailableValue('Valorant personal combat stats are not stored.'),
      recentForm: teamStats.recentForm
    },
    unsupported: unsupportedPlayerMetrics()
  };
};

const unsupportedPlayerMetrics = () => [
  'valorant_kd',
  'valorant_acs',
  'valorant_adr',
  'valorant_headshot_percentage',
  'valorant_agent_stats',
  'valorant_clutches',
  'valorant_economy'
];

const emptyValorantPlayerStats = () => ({
  matchesParticipated: 0,
  winsParticipated: 0,
  lossesParticipated: 0,
  winRateParticipated: null,
  roundsForWhileRostered: 0,
  roundsAgainstWhileRostered: 0,
  roundDifferentialWhileRostered: 0,
  personalKills: unavailableValue('Valorant personal combat stats are not stored.'),
  recentForm: []
});

module.exports = {
  getValorantPlayerStatistics,
  getValorantTeamStatistics,
  summarizeValorantSides
};

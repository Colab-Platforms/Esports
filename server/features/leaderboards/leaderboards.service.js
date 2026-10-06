const Team = require('../../models/Team');
const {
  ACTIVE_LEADERBOARD_GAMES,
  COVERAGE_NOTE,
  DEFAULT_LIMIT,
  LOW_SAMPLE_THRESHOLD,
  MAX_LIMIT,
  METRICS
} = require('./leaderboards.constants');
const { getBgmiLeaderboardRows } = require('./adapters/bgmi-leaderboard.adapter');
const { getFreeFireLeaderboardRows } = require('./adapters/freefire-leaderboard.adapter');
const { getValorantLeaderboardRows } = require('./adapters/valorant-leaderboard.adapter');
const { toId } = require('./adapters/leaderboard-adapter.utils');

const badRequest = (message, code = 'INVALID_REQUEST') => {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
};

const parsePagination = ({ page, limit } = {}) => {
  const parsedPage = Number.parseInt(page, 10);
  const parsedLimit = Number.parseInt(limit, 10);

  return {
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit: Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT
  };
};

const getRowsForGame = async ({ gameType, models }) => {
  if (gameType === 'bgmi') return getBgmiLeaderboardRows({ models });
  if (gameType === 'freefire') return getFreeFireLeaderboardRows({ models });
  if (gameType === 'valorant') return getValorantLeaderboardRows({ models });
  throw badRequest('Unsupported leaderboard game', 'UNSUPPORTED_GAME');
};

const loadTeamsById = async ({ teamIds, gameType, models }) => {
  if (teamIds.length === 0) return new Map();
  const TeamModel = models.Team || Team;
  const teams = await TeamModel.find({
    _id: { $in: teamIds },
    isActive: true,
    privacy: 'public',
    game: gameType
  })
    .select('name tag logo game')
    .lean();

  return new Map(teams.map((team) => [toId(team), team]));
};

const normalizeEntry = ({ row, team }) => ({
  teamId: row.teamId,
  team: {
    id: toId(team),
    name: team.name || '',
    tag: team.tag || '',
    logo: team.logo || ''
  },
  matches: row.stats.matchesPlayed || 0,
  stats: row.stats,
  lowSample: (row.stats.matchesPlayed || 0) < LOW_SAMPLE_THRESHOLD
});

const compareBattleRoyaleEntries = (a, b) => (
  (b.stats.totalPoints - a.stats.totalPoints) ||
  (b.stats.wins - a.stats.wins) ||
  (b.stats.totalKills - a.stats.totalKills) ||
  (a.stats.averagePlacement - b.stats.averagePlacement) ||
  a.team.name.localeCompare(b.team.name) ||
  a.team.id.localeCompare(b.team.id)
);

const compareValorantEntries = (a, b) => (
  (b.stats.wins - a.stats.wins) ||
  (b.stats.winRate - a.stats.winRate) ||
  (b.stats.roundDifferential - a.stats.roundDifferential) ||
  (b.stats.roundsFor - a.stats.roundsFor) ||
  a.team.name.localeCompare(b.team.name) ||
  a.team.id.localeCompare(b.team.id)
);

const sortEntries = (gameType, entries) => (
  [...entries].sort(gameType === 'valorant' ? compareValorantEntries : compareBattleRoyaleEntries)
);

const getTeamLeaderboard = async (gameType, options = {}) => {
  if (!ACTIVE_LEADERBOARD_GAMES.includes(gameType)) {
    throw badRequest('Unsupported leaderboard game', 'UNSUPPORTED_GAME');
  }

  const models = options.models || {};
  const { page, limit } = parsePagination(options);
  const rows = await getRowsForGame({ gameType, models });
  const teamIds = [...new Set(rows.map((row) => row.teamId).filter(Boolean))];
  const teamsById = await loadTeamsById({ teamIds, gameType, models });

  const sorted = sortEntries(
    gameType,
    rows
      .filter((row) => row.teamId && teamsById.has(row.teamId))
      .map((row) => normalizeEntry({ row, team: teamsById.get(row.teamId) }))
      .filter((entry) => entry.matches >= 1)
  ).map((entry, index) => ({
    rank: index + 1,
    team: entry.team,
    matches: entry.matches,
    stats: entry.stats,
    lowSample: entry.lowSample
  }));

  const start = (page - 1) * limit;
  const entries = sorted.slice(start, start + limit);

  return {
    gameType,
    metric: METRICS[gameType],
    coverage: {
      note: COVERAGE_NOTE
    },
    pagination: {
      page,
      limit,
      total: sorted.length,
      hasMore: start + entries.length < sorted.length
    },
    entries
  };
};

module.exports = {
  compareBattleRoyaleEntries,
  compareValorantEntries,
  getTeamLeaderboard,
  parsePagination
};

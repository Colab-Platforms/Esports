const User = require('../../models/User');
const { getTournamentHistory } = require('./adapters/tournament-history.adapter');
const { getBgmiHistory } = require('./adapters/bgmi-history.adapter');
const { getCs2History } = require('./adapters/cs2-history.adapter');
const {
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT
} = require('./competitive-history.constants');
const {
  dedupeById,
  parsePositiveInt,
  sortNewestFirst
} = require('./competitive-history.utils');

const normalizePagination = ({ page, limit } = {}) => ({
  page: parsePositiveInt(page, 1, Number.MAX_SAFE_INTEGER),
  limit: parsePositiveInt(limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT)
});

const getCompetitiveHistory = async (username, options = {}) => {
  const { page, limit } = normalizePagination(options);
  const sourceLimit = page * limit;
  const UserModel = options.models?.User || User;
  const adapters = options.adapters || {
    getTournamentHistory,
    getBgmiHistory,
    getCs2History
  };

  const user = await UserModel.findOne({
    username,
    isActive: true,
    profileVisibility: 'public'
  })
    .select('username gameIds steamProfile')
    .lean();

  if (!user) {
    const error = new Error('Player not found');
    error.status = 404;
    throw error;
  }

  const [tournamentHistory, bgmiHistory, cs2History] = await Promise.all([
    adapters.getTournamentHistory({ user, limit: sourceLimit }),
    adapters.getBgmiHistory({ user, limit: sourceLimit }),
    adapters.getCs2History({ user, limit: sourceLimit })
  ]);

  const orderedHistory = sortNewestFirst(
    dedupeById([...tournamentHistory, ...bgmiHistory, ...cs2History])
  );

  const start = (page - 1) * limit;
  const history = orderedHistory.slice(start, start + limit);

  return {
    history,
    pagination: {
      page,
      limit,
      total: orderedHistory.length,
      hasMore: start + limit < orderedHistory.length
    }
  };
};

module.exports = {
  getCompetitiveHistory,
  normalizePagination
};

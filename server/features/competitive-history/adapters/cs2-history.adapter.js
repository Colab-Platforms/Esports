const CS2Match = require('../../../models/CS2Match');
const { CONFIDENCE } = require('../competitive-history.constants');
const { toSteamAccountId } = require('../competitive-history.utils');

const resolveSteamAccountId = (user) => {
  const steamProfileId = user.steamProfile?.isConnected ? user.steamProfile?.steamId : '';
  const savedSteamId = user.gameIds?.steam || '';
  return toSteamAccountId(steamProfileId || savedSteamId);
};

const getCs2History = async ({ user, limit, models = {} }) => {
  const MatchModel = models.CS2Match || CS2Match;
  const accountId = resolveSteamAccountId(user);
  if (!accountId) return [];

  const rows = await MatchModel.aggregate([
    { $match: { accountid: accountId } },
    { $sort: { match_id: 1, round_number: -1, match_datetime: -1 } },
    {
      $group: {
        _id: '$match_id',
        kills: { $first: '$kills' },
        deaths: { $first: '$deaths' },
        assists: { $first: '$assists' },
        damage: { $first: '$dmg' },
        mvp: { $first: '$mvp' },
        map: { $first: '$map' },
        matchNumber: { $first: '$match_number' },
        occurredAt: { $first: '$match_datetime' },
        finalRound: { $first: '$round_number' }
      }
    },
    { $sort: { occurredAt: -1 } },
    { $limit: limit }
  ]);

  return rows.map((row) => ({
    id: `cs2-match-${row._id}`,
    source: {
      type: 'cs2_match',
      id: row._id
    },
    level: 'match',
    gameType: 'cs2',
    tournament: null,
    team: null,
    occurredAt: row.occurredAt,
    status: 'recorded',
    confidence: CONFIDENCE.SERVER_LOG,
    result: {
      type: 'stat_summary',
      data: {
        kills: row.kills || 0,
        deaths: row.deaths || 0,
        assists: row.assists || 0,
        damage: row.damage || 0,
        mvp: row.mvp || 0,
        map: row.map || '',
        matchId: row._id,
        matchNumber: row.matchNumber,
        rounds: row.finalRound
      }
    }
  }));
};

module.exports = {
  getCs2History,
  resolveSteamAccountId
};

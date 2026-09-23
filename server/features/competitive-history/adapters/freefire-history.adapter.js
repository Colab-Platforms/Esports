const FreeFireMatchResult = require('../../freefire-results/freefire-match-result.model');
const { CONFIDENCE } = require('../competitive-history.constants');
const { sortNewestFirst, toId } = require('../competitive-history.utils');

const registrationMatchesUser = (teamResult, user) => {
  const roster = teamResult.rosterSnapshot || [];
  const userId = toId(user._id);
  if (roster.some((member) => toId(member.userId) === userId)) return true;

  const freeFireId = user.gameIds?.freefire?.uid || user.gameIds?.freefire || '';
  if (!freeFireId) return false;
  return roster.some((member) => String(member.gameId || '').toLowerCase() === String(freeFireId).toLowerCase());
};

const normalizeFreeFireMatchResult = ({ match, teamResult }) => ({
  id: `freefire-result-${toId(match)}-${toId(teamResult.registrationId)}`,
  source: { type: 'freefire_match_result', id: toId(match) },
  level: 'match',
  gameType: 'freefire',
  tournament: { id: toId(match.tournamentId), name: match.tournamentId?.name || '' },
  team: {
    entityType: teamResult.canonicalTeamId ? 'team' : 'registration',
    entityId: toId(teamResult.canonicalTeamId || teamResult.registrationId),
    name: teamResult.teamNameSnapshot || ''
  },
  occurredAt: match.playedAt || match.verifiedAt || match.updatedAt || match.createdAt,
  status: 'verified',
  confidence: CONFIDENCE.VERIFIED_RESULT,
  result: {
    type: 'placement',
    data: {
      placement: teamResult.placement,
      kills: teamResult.kills,
      placementPoints: teamResult.placementPoints,
      killPoints: teamResult.killPoints,
      points: teamResult.totalPoints
    }
  }
});

const getFreeFireHistory = async ({ user, limit, models = {} }) => {
  const ResultModel = models.FreeFireMatchResult || FreeFireMatchResult;
  const rosterMatch = [{ 'teamResults.rosterSnapshot.userId': user._id }];
  if (user.gameIds?.freefire?.uid) rosterMatch.push({ 'teamResults.rosterSnapshot.gameId': user.gameIds.freefire.uid });

  const matches = await ResultModel.find({ status: 'verified', $or: rosterMatch })
    .populate('tournamentId', 'name gameType')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(limit)
    .lean();

  const history = [];
  for (const match of matches) {
    for (const teamResult of match.teamResults || []) {
      if (registrationMatchesUser(teamResult, user)) {
        history.push(normalizeFreeFireMatchResult({ match, teamResult }));
      }
    }
  }
  return sortNewestFirst(history).slice(0, limit);
};

module.exports = { getFreeFireHistory, normalizeFreeFireMatchResult };

const ValorantMatchResult = require('../../valorant-results/valorant-match-result.model');
const { CONFIDENCE } = require('../competitive-history.constants');
const { sortNewestFirst, toId } = require('../competitive-history.utils');

const sideMatchesUser = (side, user) => {
  const roster = side?.rosterSnapshot || [];
  const userId = toId(user._id);
  if (roster.some((member) => toId(member.userId) === userId)) return true;

  return false;
};

const normalizeValorantMatchResult = ({ match, side, opponent }) => {
  const won = toId(match.winnerRegistrationId) === toId(side.registrationId);
  return {
    id: `valorant-result-${toId(match)}-${toId(side.registrationId)}`,
    source: { type: 'valorant_match_result', id: toId(match) },
    level: 'match',
    gameType: 'valorant',
    tournament: { id: toId(match.tournamentId), name: match.tournamentId?.name || '' },
    team: {
      entityType: side.canonicalTeamId ? 'team' : 'registration',
      entityId: toId(side.canonicalTeamId || side.registrationId),
      name: side.teamNameSnapshot || ''
    },
    occurredAt: match.playedAt || match.verifiedAt || match.updatedAt || match.createdAt,
    status: won ? 'won' : 'lost',
    confidence: CONFIDENCE.VERIFIED_RESULT,
    result: {
      type: 'head_to_head',
      data: {
        scoreFor: side.score,
        scoreAgainst: opponent.score,
        opponent: opponent.teamNameSnapshot || '',
        map: match.map || '',
        winner: won ? side.teamNameSnapshot : opponent.teamNameSnapshot
      }
    }
  };
};

const getValorantHistory = async ({ user, limit, models = {} }) => {
  const ResultModel = models.ValorantMatchResult || ValorantMatchResult;
  const rosterMatch = [
    { 'teamA.rosterSnapshot.userId': user._id },
    { 'teamB.rosterSnapshot.userId': user._id }
  ];


  const matches = await ResultModel.find({ status: 'verified', $or: rosterMatch })
    .populate('tournamentId', 'name gameType')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(limit)
    .lean();

  const history = matches.map((match) => {
    if (sideMatchesUser(match.teamA, user)) return normalizeValorantMatchResult({ match, side: match.teamA, opponent: match.teamB });
    if (sideMatchesUser(match.teamB, user)) return normalizeValorantMatchResult({ match, side: match.teamB, opponent: match.teamA });
    return null;
  }).filter(Boolean);

  return sortNewestFirst(history).slice(0, limit);
};

module.exports = { getValorantHistory, normalizeValorantMatchResult };

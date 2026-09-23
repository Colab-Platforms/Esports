const BGMIMatch = require('../../models/BGMIMatch');
const TournamentRegistration = require('../../models/TournamentRegistration');
const FreeFireMatchResult = require('../freefire-results/freefire-match-result.model');
const ValorantMatchResult = require('../valorant-results/valorant-match-result.model');
const { RESULT_STATUSES } = require('../game-results/game-results.utils');
const { HISTORY_LIMIT } = require('./team-competitive-profile.constants');
const { sortNewestFirst, toId } = require('./team-competitive-profile.utils');

const getRegistrationIdsForTeam = async ({ teamId, models = {} }) => {
  const RegistrationModel = models.TournamentRegistration || TournamentRegistration;
  const registrations = await RegistrationModel.find({
    teamId,
    status: 'verified'
  })
    .select('_id')
    .lean();

  return registrations.map(toId).filter(Boolean);
};

const normalizeBgmiEvent = ({ match, teamResult }) => ({
  id: `team-bgmi-${toId(match)}-${toId(teamResult.teamId)}`,
  source: { type: 'bgmi_match', id: toId(match) },
  level: 'match',
  gameType: 'bgmi',
  tournament: match.tournamentId ? {
    id: toId(match.tournamentId),
    name: match.tournamentId.name || ''
  } : null,
  team: {
    entityType: 'team',
    entityId: toId(teamResult.teamId),
    name: teamResult.teamName || ''
  },
  occurredAt: match.endTime || match.startTime || match.scheduledTime || match.updatedAt || match.createdAt,
  status: 'verified',
  confidence: 'verified_result',
  result: {
    type: 'placement',
    data: {
      placement: teamResult.placement,
      kills: teamResult.kills,
      points: teamResult.points
    }
  }
});

const normalizeFreeFireEvent = ({ match, teamResult }) => ({
  id: `team-freefire-${toId(match)}-${toId(teamResult.registrationId)}`,
  source: { type: 'freefire_match_result', id: toId(match) },
  level: 'match',
  gameType: 'freefire',
  tournament: match.tournamentId ? {
    id: toId(match.tournamentId),
    name: match.tournamentId.name || ''
  } : null,
  team: {
    entityType: teamResult.canonicalTeamId ? 'team' : 'registration',
    entityId: toId(teamResult.canonicalTeamId || teamResult.registrationId),
    name: teamResult.teamNameSnapshot || ''
  },
  occurredAt: match.playedAt || match.verifiedAt || match.updatedAt || match.createdAt,
  status: 'verified',
  confidence: 'verified_result',
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

const normalizeValorantEvent = ({ match, side, opponent }) => {
  const won = toId(match.winnerRegistrationId) === toId(side.registrationId);
  return {
    id: `team-valorant-${toId(match)}-${toId(side.registrationId)}`,
    source: { type: 'valorant_match_result', id: toId(match) },
    level: 'match',
    gameType: 'valorant',
    tournament: match.tournamentId ? {
      id: toId(match.tournamentId),
      name: match.tournamentId.name || ''
    } : null,
    team: {
      entityType: side.canonicalTeamId ? 'team' : 'registration',
      entityId: toId(side.canonicalTeamId || side.registrationId),
      name: side.teamNameSnapshot || ''
    },
    occurredAt: match.playedAt || match.verifiedAt || match.updatedAt || match.createdAt,
    status: won ? 'won' : 'lost',
    confidence: 'verified_result',
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

const getBgmiTeamHistory = async ({ teamId, limit = HISTORY_LIMIT, models = {} }) => {
  const MatchModel = models.BGMIMatch || BGMIMatch;
  const teamIdString = toId(teamId);
  const matches = await MatchModel.find({
    status: 'completed',
    teamResults: {
      $elemMatch: {
        teamId,
        verified: true
      }
    }
  })
    .select('tournamentId matchNumber scheduledTime startTime endTime status createdAt updatedAt teamResults')
    .populate('tournamentId', 'name gameType')
    .sort({ endTime: -1, updatedAt: -1, createdAt: -1 })
    .limit(limit * 2)
    .lean();

  return sortNewestFirst(matches.flatMap((match) => (
    (match.teamResults || [])
      .filter((teamResult) => toId(teamResult.teamId) === teamIdString && teamResult.verified === true)
      .map((teamResult) => normalizeBgmiEvent({ match, teamResult }))
  ))).slice(0, limit);
};

const getFreeFireTeamHistory = async ({ teamId, registrationIds = [], limit = HISTORY_LIMIT, models = {} }) => {
  const ResultModel = models.FreeFireMatchResult || FreeFireMatchResult;
  const teamIdString = toId(teamId);
  const registrationIdSet = new Set(registrationIds.map(toId).filter(Boolean));
  const or = [{ 'teamResults.canonicalTeamId': teamId }];
  if (registrationIdSet.size > 0) {
    or.push({ 'teamResults.registrationId': { $in: Array.from(registrationIdSet) } });
  }

  const matches = await ResultModel.find({ status: RESULT_STATUSES.VERIFIED, $or: or })
    .select('tournamentId lobbyNumber matchNumber map status playedAt verifiedAt updatedAt createdAt teamResults')
    .populate('tournamentId', 'name gameType')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(limit * 2)
    .lean();

  return sortNewestFirst(matches.flatMap((match) => (
    (match.teamResults || [])
      .filter((teamResult) => (
        toId(teamResult.canonicalTeamId) === teamIdString ||
        registrationIdSet.has(toId(teamResult.registrationId))
      ))
      .map((teamResult) => normalizeFreeFireEvent({ match, teamResult }))
  ))).slice(0, limit);
};

const pickValorantSide = (match, teamId, registrationIds) => {
  const teamIdString = toId(teamId);
  const registrationIdSet = new Set(registrationIds.map(toId).filter(Boolean));
  if (
    toId(match.teamA?.canonicalTeamId) === teamIdString ||
    registrationIdSet.has(toId(match.teamA?.registrationId))
  ) {
    return { side: match.teamA, opponent: match.teamB };
  }
  if (
    toId(match.teamB?.canonicalTeamId) === teamIdString ||
    registrationIdSet.has(toId(match.teamB?.registrationId))
  ) {
    return { side: match.teamB, opponent: match.teamA };
  }
  return null;
};

const getValorantTeamHistory = async ({ teamId, registrationIds = [], limit = HISTORY_LIMIT, models = {} }) => {
  const ResultModel = models.ValorantMatchResult || ValorantMatchResult;
  const registrationIdSet = new Set(registrationIds.map(toId).filter(Boolean));
  const or = [
    { 'teamA.canonicalTeamId': teamId },
    { 'teamB.canonicalTeamId': teamId }
  ];
  if (registrationIdSet.size > 0) {
    const ids = Array.from(registrationIdSet);
    or.push({ 'teamA.registrationId': { $in: ids } }, { 'teamB.registrationId': { $in: ids } });
  }

  const matches = await ResultModel.find({ status: RESULT_STATUSES.VERIFIED, $or: or })
    .select('tournamentId matchNumber status playedAt verifiedAt updatedAt createdAt map teamA teamB winnerRegistrationId')
    .populate('tournamentId', 'name gameType')
    .sort({ playedAt: -1, verifiedAt: -1, updatedAt: -1 })
    .limit(limit * 2)
    .lean();

  return sortNewestFirst(matches
    .map((match) => {
      const perspective = pickValorantSide(match, teamId, Array.from(registrationIdSet));
      if (!perspective) return null;
      return normalizeValorantEvent({ match, ...perspective });
    })
    .filter(Boolean)).slice(0, limit);
};

const getTeamCompetitiveHistory = async ({ team, limit = HISTORY_LIMIT, models = {} }) => {
  const registrationIds = await getRegistrationIdsForTeam({ teamId: team._id, models });

  if (team.game === 'bgmi') {
    return getBgmiTeamHistory({ teamId: team._id, limit, models });
  }
  if (team.game === 'freefire') {
    return getFreeFireTeamHistory({ teamId: team._id, registrationIds, limit, models });
  }
  if (team.game === 'valorant') {
    return getValorantTeamHistory({ teamId: team._id, registrationIds, limit, models });
  }
  return [];
};

module.exports = {
  getValorantTeamHistory,
  getTeamCompetitiveHistory,
  getRegistrationIdsForTeam,
  normalizeValorantEvent
};

const FreeFireMatchResult = require('./freefire-match-result.model');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const {
  RESULT_STATUSES,
  assertNonNegativeNumber,
  assertPositiveInteger,
  normalizeEvidenceInput,
  publicEvidence,
  rosterSnapshotForRegistration,
  toId
} = require('../game-results/game-results.utils');

const responseError = (message, status = 400, code = 'VALIDATION_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const normalizePublicFreeFireResult = (result) => ({
  id: toId(result),
  tournament: { id: toId(result.tournamentId), name: result.tournamentId?.name || '' },
  lobbyNumber: result.lobbyNumber,
  matchNumber: result.matchNumber,
  map: result.map || '',
  status: result.status,
  playedAt: result.playedAt,
  teamResults: (result.teamResults || []).map((teamResult) => ({
    registrationId: toId(teamResult.registrationId),
    canonicalTeamId: toId(teamResult.canonicalTeamId),
    teamName: teamResult.teamNameSnapshot,
    placement: teamResult.placement,
    kills: teamResult.kills,
    placementPoints: teamResult.placementPoints,
    killPoints: teamResult.killPoints,
    totalPoints: teamResult.totalPoints
  })),
  evidence: publicEvidence(result.evidence),
  verifiedAt: result.verifiedAt
});

const normalizeAdminFreeFireResult = (result) => ({
  ...normalizePublicFreeFireResult(result),
  createdBy: toId(result.createdBy),
  updatedBy: toId(result.updatedBy),
  verifiedBy: toId(result.verifiedBy),
  voidedBy: toId(result.voidedBy),
  voidedAt: result.voidedAt,
  adminNotesPrivate: result.adminNotesPrivate || '',
  teamResults: (result.teamResults || []).map((teamResult) => ({
    registrationId: toId(teamResult.registrationId),
    canonicalTeamId: toId(teamResult.canonicalTeamId),
    teamName: teamResult.teamNameSnapshot,
    rosterSnapshot: teamResult.rosterSnapshot || [],
    placement: teamResult.placement,
    kills: teamResult.kills,
    placementPoints: teamResult.placementPoints,
    killPoints: teamResult.killPoints,
    totalPoints: teamResult.totalPoints
  })),
  evidence: result.evidence || [],
  createdAt: result.createdAt,
  updatedAt: result.updatedAt
});

const loadTournament = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId).select('name gameType');
  if (!tournament) throw responseError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
  if (tournament.gameType !== 'freefire') {
    throw responseError('Free Fire results can only be created for Free Fire tournaments', 400, 'INVALID_GAME_TYPE');
  }
  return tournament;
};

const buildTeamResults = async ({ tournamentId, teamResults, verify = false }) => {
  if (!Array.isArray(teamResults) || teamResults.length === 0) {
    throw responseError('At least one team result is required');
  }

  const seenRegistrations = new Set();
  const seenPlacements = new Set();
  const registrationIds = [];

  for (const entry of teamResults) {
    const registrationId = toId(entry.registrationId);
    if (!registrationId) throw responseError('registrationId is required for every team result');
    if (seenRegistrations.has(registrationId)) throw responseError('A registration cannot appear twice in one lobby');
    seenRegistrations.add(registrationId);
    registrationIds.push(registrationId);

    const placement = assertPositiveInteger(entry.placement, 'placement', { required: verify });
    if (placement !== undefined) {
      if (seenPlacements.has(placement)) throw responseError('Duplicate placement is not allowed');
      seenPlacements.add(placement);
    }
  }

  const registrations = await TournamentRegistration.find({ _id: { $in: registrationIds } })
    .select('tournamentId userId teamName teamId status teamLeader teamMembers substitutePlayer')
    .lean();
  const byId = new Map(registrations.map((registration) => [toId(registration), registration]));

  return teamResults.map((entry) => {
    const registration = byId.get(toId(entry.registrationId));
    if (!registration) throw responseError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
    if (toId(registration.tournamentId) !== toId(tournamentId)) {
      throw responseError('Registration belongs to a different tournament');
    }
    if (verify && registration.status !== 'verified') {
      throw responseError('Only verified registrations can be used in verified results');
    }
    if (entry.canonicalTeamId && registration.teamId && toId(entry.canonicalTeamId) !== toId(registration.teamId)) {
      throw responseError('canonicalTeamId does not match the selected registration');
    }

    const placement = assertPositiveInteger(entry.placement, 'placement', { required: verify });
    const kills = assertNonNegativeNumber(entry.kills, 'kills', { required: verify }) ?? 0;
    const placementPoints = assertNonNegativeNumber(entry.placementPoints, 'placementPoints', { required: verify }) ?? 0;
    const killPoints = assertNonNegativeNumber(entry.killPoints, 'killPoints', { required: verify }) ?? 0;
    const suppliedTotal = assertNonNegativeNumber(entry.totalPoints, 'totalPoints');
    const totalPoints = placementPoints + killPoints;
    if (suppliedTotal !== undefined && suppliedTotal !== totalPoints) {
      throw responseError('totalPoints must equal placementPoints + killPoints');
    }

    return {
      registrationId: registration._id,
      canonicalTeamId: registration.teamId || null,
      teamNameSnapshot: registration.teamName,
      rosterSnapshot: rosterSnapshotForRegistration(registration, 'freefire'),
      placement,
      kills,
      placementPoints,
      killPoints,
      totalPoints
    };
  });
};

const createFreeFireResult = async ({ payload, actorId }) => {
  await loadTournament(payload.tournamentId);
  const status = payload.status === RESULT_STATUSES.VERIFIED ? RESULT_STATUSES.VERIFIED : RESULT_STATUSES.DRAFT;
  const teamResults = await buildTeamResults({ tournamentId: payload.tournamentId, teamResults: payload.teamResults, verify: status === RESULT_STATUSES.VERIFIED });
  const result = await FreeFireMatchResult.create({
    tournamentId: payload.tournamentId,
    lobbyNumber: assertPositiveInteger(payload.lobbyNumber, 'lobbyNumber', { required: true }),
    matchNumber: assertPositiveInteger(payload.matchNumber, 'matchNumber', { required: true }),
    map: payload.map || '',
    status,
    playedAt: payload.playedAt || null,
    teamResults,
    evidence: normalizeEvidenceInput(payload.evidence),
    createdBy: actorId,
    updatedBy: actorId,
    verifiedBy: status === RESULT_STATUSES.VERIFIED ? actorId : null,
    verifiedAt: status === RESULT_STATUSES.VERIFIED ? new Date() : null,
    adminNotesPrivate: payload.adminNotesPrivate || ''
  });
  return FreeFireMatchResult.findById(result._id).populate('tournamentId', 'name gameType').lean();
};

const updateFreeFireResult = async ({ resultId, payload, actorId }) => {
  const result = await FreeFireMatchResult.findById(resultId);
  if (!result) throw responseError('Free Fire result not found', 404, 'RESULT_NOT_FOUND');
  if (result.status === RESULT_STATUSES.VOID) throw responseError('Void results cannot be edited');
  await loadTournament(result.tournamentId);

  if (payload.lobbyNumber !== undefined) result.lobbyNumber = assertPositiveInteger(payload.lobbyNumber, 'lobbyNumber', { required: true });
  if (payload.matchNumber !== undefined) result.matchNumber = assertPositiveInteger(payload.matchNumber, 'matchNumber', { required: true });
  if (payload.map !== undefined) result.map = payload.map || '';
  if (payload.playedAt !== undefined) result.playedAt = payload.playedAt || null;
  if (payload.teamResults) result.teamResults = await buildTeamResults({ tournamentId: result.tournamentId, teamResults: payload.teamResults, verify: false });
  if (payload.evidence !== undefined) result.evidence = normalizeEvidenceInput(payload.evidence);
  if (payload.adminNotesPrivate !== undefined) result.adminNotesPrivate = payload.adminNotesPrivate || '';
  if (result.status === RESULT_STATUSES.VERIFIED) {
    result.status = RESULT_STATUSES.DRAFT;
    result.verifiedBy = null;
    result.verifiedAt = null;
  }
  result.updatedBy = actorId;
  await result.save();
  return FreeFireMatchResult.findById(result._id).populate('tournamentId', 'name gameType').lean();
};

const verifyFreeFireResult = async ({ resultId, actorId }) => {
  const result = await FreeFireMatchResult.findById(resultId).lean();
  if (!result) throw responseError('Free Fire result not found', 404, 'RESULT_NOT_FOUND');
  const teamResults = await buildTeamResults({ tournamentId: result.tournamentId, teamResults: result.teamResults, verify: true });
  return FreeFireMatchResult.findByIdAndUpdate(resultId, {
    status: RESULT_STATUSES.VERIFIED,
    teamResults,
    updatedBy: actorId,
    verifiedBy: actorId,
    verifiedAt: new Date(),
    voidedBy: null,
    voidedAt: null
  }, { new: true, runValidators: true }).populate('tournamentId', 'name gameType').lean();
};

const voidFreeFireResult = async ({ resultId, actorId }) => {
  const result = await FreeFireMatchResult.findByIdAndUpdate(resultId, {
    status: RESULT_STATUSES.VOID,
    updatedBy: actorId,
    voidedBy: actorId,
    voidedAt: new Date()
  }, { new: true, runValidators: true }).populate('tournamentId', 'name gameType').lean();
  if (!result) throw responseError('Free Fire result not found', 404, 'RESULT_NOT_FOUND');
  return result;
};

const getFreeFireTournamentResults = async ({ tournamentId, admin = false }) => {
  const query = { tournamentId };
  if (!admin) query.status = RESULT_STATUSES.VERIFIED;
  const results = await FreeFireMatchResult.find(query).populate('tournamentId', 'name gameType').sort({ playedAt: -1, matchNumber: -1, lobbyNumber: -1 }).lean();
  return results.map(admin ? normalizeAdminFreeFireResult : normalizePublicFreeFireResult);
};

const getFreeFireResultById = async ({ resultId, admin = false }) => {
  const query = { _id: resultId };
  if (!admin) query.status = RESULT_STATUSES.VERIFIED;
  const result = await FreeFireMatchResult.findOne(query).populate('tournamentId', 'name gameType').lean();
  if (!result) throw responseError('Free Fire result not found', 404, 'RESULT_NOT_FOUND');
  return admin ? normalizeAdminFreeFireResult(result) : normalizePublicFreeFireResult(result);
};

module.exports = {
  buildTeamResults,
  createFreeFireResult,
  getFreeFireResultById,
  getFreeFireTournamentResults,
  normalizeAdminFreeFireResult,
  normalizePublicFreeFireResult,
  updateFreeFireResult,
  verifyFreeFireResult,
  voidFreeFireResult
};

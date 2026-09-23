const ValorantMatchResult = require('./valorant-match-result.model');
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

const normalizePublicValorantResult = (result) => ({
  id: toId(result),
  tournament: { id: toId(result.tournamentId), name: result.tournamentId?.name || '' },
  matchNumber: result.matchNumber,
  status: result.status,
  playedAt: result.playedAt,
  map: result.map || '',
  bestOf: result.bestOf || 1,
  serverRegion: result.serverRegion || '',
  teamA: {
    registrationId: toId(result.teamA?.registrationId),
    canonicalTeamId: toId(result.teamA?.canonicalTeamId),
    teamName: result.teamA?.teamNameSnapshot || '',
    score: result.teamA?.score
  },
  teamB: {
    registrationId: toId(result.teamB?.registrationId),
    canonicalTeamId: toId(result.teamB?.canonicalTeamId),
    teamName: result.teamB?.teamNameSnapshot || '',
    score: result.teamB?.score
  },
  winnerRegistrationId: toId(result.winnerRegistrationId),
  evidence: publicEvidence(result.evidence),
  verifiedAt: result.verifiedAt
});

const normalizeAdminValorantResult = (result) => {
  const publicResult = normalizePublicValorantResult(result);
  return {
    ...publicResult,
    teamA: { ...publicResult.teamA, rosterSnapshot: result.teamA?.rosterSnapshot || [] },
    teamB: { ...publicResult.teamB, rosterSnapshot: result.teamB?.rosterSnapshot || [] },
    evidence: result.evidence || [],
    createdBy: toId(result.createdBy),
    updatedBy: toId(result.updatedBy),
    verifiedBy: toId(result.verifiedBy),
    voidedBy: toId(result.voidedBy),
    voidedAt: result.voidedAt,
    adminNotesPrivate: result.adminNotesPrivate || '',
    createdAt: result.createdAt,
    updatedAt: result.updatedAt
  };
};

const loadTournament = async (tournamentId) => {
  const tournament = await Tournament.findById(tournamentId).select('name gameType');
  if (!tournament) throw responseError('Tournament not found', 404, 'TOURNAMENT_NOT_FOUND');
  if (tournament.gameType !== 'valorant') {
    throw responseError('Valorant results can only be created for Valorant tournaments', 400, 'INVALID_GAME_TYPE');
  }
  return tournament;
};

const deriveWinner = (teamA, teamB, suppliedWinnerId) => {
  const scoreA = assertNonNegativeNumber(teamA.score, 'teamA.score', { required: true });
  const scoreB = assertNonNegativeNumber(teamB.score, 'teamB.score', { required: true });
  if (scoreA === scoreB) throw responseError('Tied Valorant scores are not supported');
  const winnerRegistrationId = scoreA > scoreB ? toId(teamA.registrationId) : toId(teamB.registrationId);
  if (suppliedWinnerId && toId(suppliedWinnerId) !== winnerRegistrationId) {
    throw responseError('winnerRegistrationId does not match the submitted score');
  }
  return winnerRegistrationId;
};

const buildSide = async ({ tournamentId, side, verify = false }) => {
  const registrationId = toId(side?.registrationId);
  if (!registrationId) throw responseError('registrationId is required for both teams');
  const registration = await TournamentRegistration.findById(registrationId)
    .select('tournamentId userId teamName teamId status teamLeader teamMembers substitutePlayer')
    .lean();
  if (!registration) throw responseError('Registration not found', 404, 'REGISTRATION_NOT_FOUND');
  if (toId(registration.tournamentId) !== toId(tournamentId)) {
    throw responseError('Registration belongs to a different tournament');
  }
  if (verify && registration.status !== 'verified') {
    throw responseError('Only verified registrations can be used in verified results');
  }
  if (side.canonicalTeamId && registration.teamId && toId(side.canonicalTeamId) !== toId(registration.teamId)) {
    throw responseError('canonicalTeamId does not match the selected registration');
  }

  return {
    registrationId: registration._id,
    canonicalTeamId: registration.teamId || null,
    teamNameSnapshot: registration.teamName,
    rosterSnapshot: rosterSnapshotForRegistration(registration, 'valorant'),
    score: assertNonNegativeNumber(side.score, 'score', { required: verify })
  };
};

const buildValorantSides = async ({ tournamentId, teamA, teamB, winnerRegistrationId, verify = false }) => {
  if (toId(teamA?.registrationId) === toId(teamB?.registrationId)) {
    throw responseError('Team A and Team B must be different registrations');
  }
  const [sideA, sideB] = await Promise.all([
    buildSide({ tournamentId, side: teamA, verify }),
    buildSide({ tournamentId, side: teamB, verify })
  ]);
  let winner = null;
  if (verify || (sideA.score !== undefined && sideB.score !== undefined)) {
    winner = deriveWinner(sideA, sideB, winnerRegistrationId);
  } else if (winnerRegistrationId) {
    throw responseError('winnerRegistrationId cannot be set before both scores are present');
  }
  return { teamA: sideA, teamB: sideB, winnerRegistrationId: winner };
};

const createValorantResult = async ({ payload, actorId }) => {
  await loadTournament(payload.tournamentId);
  const status = payload.status === RESULT_STATUSES.VERIFIED ? RESULT_STATUSES.VERIFIED : RESULT_STATUSES.DRAFT;
  const sides = await buildValorantSides({ tournamentId: payload.tournamentId, teamA: payload.teamA, teamB: payload.teamB, winnerRegistrationId: payload.winnerRegistrationId, verify: status === RESULT_STATUSES.VERIFIED });
  const result = await ValorantMatchResult.create({
    tournamentId: payload.tournamentId,
    matchNumber: assertPositiveInteger(payload.matchNumber, 'matchNumber', { required: true }),
    status,
    playedAt: payload.playedAt || null,
    map: payload.map || '',
    bestOf: 1,
    ...sides,
    serverRegion: payload.serverRegion || '',
    evidence: normalizeEvidenceInput(payload.evidence),
    createdBy: actorId,
    updatedBy: actorId,
    verifiedBy: status === RESULT_STATUSES.VERIFIED ? actorId : null,
    verifiedAt: status === RESULT_STATUSES.VERIFIED ? new Date() : null,
    adminNotesPrivate: payload.adminNotesPrivate || ''
  });
  return ValorantMatchResult.findById(result._id).populate('tournamentId', 'name gameType').lean();
};

const updateValorantResult = async ({ resultId, payload, actorId }) => {
  const result = await ValorantMatchResult.findById(resultId);
  if (!result) throw responseError('Valorant result not found', 404, 'RESULT_NOT_FOUND');
  if (result.status === RESULT_STATUSES.VOID) throw responseError('Void results cannot be edited');
  await loadTournament(result.tournamentId);
  const sides = await buildValorantSides({
    tournamentId: result.tournamentId,
    teamA: payload.teamA || result.teamA,
    teamB: payload.teamB || result.teamB,
    winnerRegistrationId: payload.winnerRegistrationId,
    verify: false
  });

  if (payload.matchNumber !== undefined) result.matchNumber = assertPositiveInteger(payload.matchNumber, 'matchNumber', { required: true });
  if (payload.playedAt !== undefined) result.playedAt = payload.playedAt || null;
  if (payload.map !== undefined) result.map = payload.map || '';
  if (payload.serverRegion !== undefined) result.serverRegion = payload.serverRegion || '';
  result.teamA = sides.teamA;
  result.teamB = sides.teamB;
  result.winnerRegistrationId = sides.winnerRegistrationId;
  if (payload.evidence !== undefined) result.evidence = normalizeEvidenceInput(payload.evidence);
  if (payload.adminNotesPrivate !== undefined) result.adminNotesPrivate = payload.adminNotesPrivate || '';
  if (result.status === RESULT_STATUSES.VERIFIED) {
    result.status = RESULT_STATUSES.DRAFT;
    result.verifiedBy = null;
    result.verifiedAt = null;
  }
  result.updatedBy = actorId;
  await result.save();
  return ValorantMatchResult.findById(result._id).populate('tournamentId', 'name gameType').lean();
};

const verifyValorantResult = async ({ resultId, actorId }) => {
  const result = await ValorantMatchResult.findById(resultId).lean();
  if (!result) throw responseError('Valorant result not found', 404, 'RESULT_NOT_FOUND');
  const sides = await buildValorantSides({ tournamentId: result.tournamentId, teamA: result.teamA, teamB: result.teamB, winnerRegistrationId: result.winnerRegistrationId, verify: true });
  return ValorantMatchResult.findByIdAndUpdate(resultId, {
    status: RESULT_STATUSES.VERIFIED,
    ...sides,
    updatedBy: actorId,
    verifiedBy: actorId,
    verifiedAt: new Date(),
    voidedBy: null,
    voidedAt: null
  }, { new: true, runValidators: true }).populate('tournamentId', 'name gameType').lean();
};

const voidValorantResult = async ({ resultId, actorId }) => {
  const result = await ValorantMatchResult.findByIdAndUpdate(resultId, {
    status: RESULT_STATUSES.VOID,
    updatedBy: actorId,
    voidedBy: actorId,
    voidedAt: new Date()
  }, { new: true, runValidators: true }).populate('tournamentId', 'name gameType').lean();
  if (!result) throw responseError('Valorant result not found', 404, 'RESULT_NOT_FOUND');
  return result;
};

const getValorantTournamentResults = async ({ tournamentId, admin = false }) => {
  const query = { tournamentId };
  if (!admin) query.status = RESULT_STATUSES.VERIFIED;
  const results = await ValorantMatchResult.find(query).populate('tournamentId', 'name gameType').sort({ playedAt: -1, matchNumber: -1 }).lean();
  return results.map(admin ? normalizeAdminValorantResult : normalizePublicValorantResult);
};

const getValorantResultById = async ({ resultId, admin = false }) => {
  const query = { _id: resultId };
  if (!admin) query.status = RESULT_STATUSES.VERIFIED;
  const result = await ValorantMatchResult.findOne(query).populate('tournamentId', 'name gameType').lean();
  if (!result) throw responseError('Valorant result not found', 404, 'RESULT_NOT_FOUND');
  return admin ? normalizeAdminValorantResult(result) : normalizePublicValorantResult(result);
};

module.exports = {
  buildValorantSides,
  createValorantResult,
  getValorantResultById,
  getValorantTournamentResults,
  normalizeAdminValorantResult,
  normalizePublicValorantResult,
  updateValorantResult,
  verifyValorantResult,
  voidValorantResult
};

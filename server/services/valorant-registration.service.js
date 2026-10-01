const mongoose = require('mongoose');
const TournamentRegistrationClaim = require('../models/TournamentRegistrationClaim');

const ACTIVE_REGISTRATION_STATUSES = ['pending', 'images_uploaded', 'verified'];
const CLAIM_TYPES = {
  TEAM: 'team',
  USER: 'user',
  RIOT: 'riot'
};

const createRegistrationError = (code, message, status = 400, extra = {}) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const toIdString = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const withSession = (query, session) => (session && query && typeof query.session === 'function'
  ? query.session(session)
  : query);

const isDuplicateKeyError = (error) => error?.code === 11000;

const buildRegistrationClaims = ({ tournamentId, teamId, registrationId, roster }) => {
  const base = { tournamentId, registrationId };
  return [
    {
      ...base,
      type: CLAIM_TYPES.TEAM,
      value: teamId.toString()
    },
    ...roster.map((entry) => ({
      ...base,
      type: CLAIM_TYPES.USER,
      value: entry.userId.toString()
    })),
    ...roster.map((entry) => ({
      ...base,
      type: CLAIM_TYPES.RIOT,
      value: entry.normalizedRiotId
    }))
  ];
};

const mapClaimDuplicateError = (claims) => {
  const error = createRegistrationError(
    'REGISTRATION_CLAIM_CONFLICT',
    'This team or one of its players is already registered for this tournament'
  );
  error.claims = claims;
  return error;
};

const parseManualRiotId = (value) => {
  if (typeof value !== 'string') {
    throw createRegistrationError('MALFORMED_RIOT_ID', 'Riot ID must use Name#Tag format');
  }

  const trimmed = value.trim();
  const parts = trimmed.split('#');
  if (parts.length !== 2) {
    throw createRegistrationError('MALFORMED_RIOT_ID', 'Riot ID must use Name#Tag format');
  }

  const name = parts[0].trim();
  const tag = parts[1].trim();
  if (!name || !tag || name.length > 30 || tag.length > 10) {
    throw createRegistrationError('MALFORMED_RIOT_ID', 'Riot ID name must be 1-30 characters and tag must be 1-10 characters');
  }

  return {
    display: `${name}#${tag}`,
    name,
    tag,
    normalized: `${name.toLowerCase()}#${tag.toLowerCase()}`
  };
};

const getUserDisplayName = (user) => user?.username || user?.fullName || user?.email || 'Unknown';

const getRosterMembersFromTeam = (team) => {
  const members = Array.isArray(team?.members) ? team.members : [];
  if (members.length === 0) {
    throw createRegistrationError('INVALID_VALORANT_ROSTER', 'Valorant team roster is empty');
  }

  const captainId = toIdString(team.captain);
  const seen = new Set();
  const duplicateUserIds = [];
  const normalizedMembers = members.map((member) => {
    const userId = toIdString(member.userId);
    if (!userId) {
      throw createRegistrationError('INVALID_VALORANT_ROSTER', 'Every roster member must reference a platform user');
    }
    if (seen.has(userId)) duplicateUserIds.push(userId);
    seen.add(userId);

    return {
      userId,
      role: member.role || 'member',
      isSubstitute: Boolean(member.isSubstitute)
    };
  });

  if (duplicateUserIds.length > 0) {
    throw createRegistrationError('DUPLICATE_ROSTER_USER', 'A player appears more than once in this roster', 400, { duplicateUserIds });
  }

  const captainEntries = normalizedMembers.filter((member) => member.userId === captainId);
  if (captainEntries.length !== 1 || captainEntries[0].role !== 'captain' || captainEntries[0].isSubstitute) {
    throw createRegistrationError('INVALID_VALORANT_ROSTER', 'Team must contain exactly one captain starter');
  }

  const starters = normalizedMembers.filter((member) => !member.isSubstitute);
  const substitutes = normalizedMembers.filter((member) => member.isSubstitute);

  if (starters.length !== 5) {
    throw createRegistrationError('INVALID_VALORANT_ROSTER', 'Valorant registration requires exactly 5 starters');
  }

  if (substitutes.length === 0) {
    throw createRegistrationError('SUBSTITUTE_REQUIRED', 'Valorant registration requires exactly 1 substitute');
  }

  if (substitutes.length > 1) {
    throw createRegistrationError('INVALID_VALORANT_ROSTER', 'Valorant registration allows exactly 1 substitute');
  }

  if (normalizedMembers.length !== 6) {
    throw createRegistrationError('INVALID_VALORANT_ROSTER', 'Valorant registration requires exactly 6 total players');
  }

  return { captainId, starters, substitutes, allMembers: normalizedMembers };
};

const buildRosterSnapshot = ({ team, users }) => {
  const { captainId, starters, substitutes, allMembers } = getRosterMembersFromTeam(team);
  const userMap = new Map(users.map((user) => [toIdString(user._id), user]));

  if (userMap.size !== allMembers.length) {
    throw createRegistrationError('MISSING_USER', 'One or more roster users could not be found');
  }

  const makeEntry = (member, role) => {
    const user = userMap.get(member.userId);
    if (!user) {
      throw createRegistrationError('MISSING_USER', 'One or more roster users could not be found');
    }

    const rawRiotId = user.gameIds?.valorant || '';
    if (!rawRiotId || !rawRiotId.trim()) {
      throw createRegistrationError('MISSING_RIOT_ID', `${getUserDisplayName(user)} is missing a Valorant Riot ID`, 400, {
        userId: member.userId
      });
    }

    const riotId = parseManualRiotId(rawRiotId);
    return {
      userId: user._id,
      username: getUserDisplayName(user),
      riotId: riotId.display,
      normalizedRiotId: riotId.normalized,
      role,
      riotIdParts: { name: riotId.name, tag: riotId.tag },
      phone: user.phone || ''
    };
  };

  const starterEntries = starters.map((member) => makeEntry(member, 'starter'));
  const substituteEntries = substitutes.map((member) => makeEntry(member, 'substitute'));
  const roster = [...starterEntries, ...substituteEntries];

  const uniqueUsers = new Set(roster.map((entry) => entry.userId.toString()));
  if (uniqueUsers.size !== 6) {
    throw createRegistrationError('DUPLICATE_ROSTER_USER', 'A player appears more than once in this roster');
  }

  const normalizedRiotIds = roster.map((entry) => entry.normalizedRiotId);
  const uniqueRiotIds = new Set(normalizedRiotIds);
  if (uniqueRiotIds.size !== normalizedRiotIds.length) {
    throw createRegistrationError('DUPLICATE_RIOT_ID', 'All roster players must have unique Riot IDs for this tournament registration');
  }

  const captainEntry = starterEntries.find((entry) => entry.userId.toString() === captainId);
  if (!captainEntry) {
    throw createRegistrationError('INVALID_VALORANT_ROSTER', 'Captain must be one of the 5 starters');
  }

  return {
    captainEntry,
    starterEntries,
    substituteEntry: substituteEntries[0],
    roster
  };
};

const buildValorantRegistrationSnapshot = ({ team, rosterSnapshot, captainUser }) => {
  const nonCaptainStarters = rosterSnapshot.starterEntries.filter(
    (entry) => entry.userId.toString() !== rosterSnapshot.captainEntry.userId.toString()
  );

  const teamLeader = {
    name: rosterSnapshot.captainEntry.username,
    riotId: rosterSnapshot.captainEntry.riotIdParts,
    phone: captainUser.phone || rosterSnapshot.captainEntry.phone || ''
  };

  const teamMembers = nonCaptainStarters.map((entry) => ({
    name: entry.username,
    riotId: entry.riotIdParts
  }));

  const substitutePlayer = {
    name: rosterSnapshot.substituteEntry.username,
    riotId: rosterSnapshot.substituteEntry.riotIdParts
  };

  const roster = rosterSnapshot.roster.map((entry) => ({
    userId: entry.userId,
    username: entry.username,
    riotId: entry.riotId,
    normalizedRiotId: entry.normalizedRiotId,
    role: entry.role
  }));

  return {
    teamName: team.name,
    teamLeader,
    teamMembers,
    substitutePlayer,
    whatsappNumber: captainUser.phone || rosterSnapshot.captainEntry.phone || '',
    roster
  };
};

const buildConflictQuery = ({ tournamentId, teamId, userIds, normalizedRiotIds }) => ({
  tournamentId,
  status: { $in: ACTIVE_REGISTRATION_STATUSES },
  $or: [
    { teamId },
    { 'roster.userId': { $in: userIds } },
    { 'roster.normalizedRiotId': { $in: normalizedRiotIds } }
  ]
});

const classifyRegistrationConflicts = ({ existingRegistrations, teamId, userIds, normalizedRiotIds }) => {
  const userIdSet = new Set(userIds.map((id) => id.toString()));
  const riotIdSet = new Set(normalizedRiotIds);
  const teamIdString = teamId.toString();

  for (const registration of existingRegistrations) {
    if (registration.teamId && registration.teamId.toString() === teamIdString) {
      throw createRegistrationError('TEAM_ALREADY_REGISTERED', 'This team is already registered for this tournament');
    }

    const roster = Array.isArray(registration.roster) ? registration.roster : [];
    const userConflicts = roster
      .filter((entry) => entry.userId && userIdSet.has(entry.userId.toString()))
      .map((entry) => ({
        userId: entry.userId,
        playerName: entry.username,
        existingTeam: registration.teamName
      }));

    if (userConflicts.length > 0) {
      throw createRegistrationError(
        'PLAYER_ALREADY_REGISTERED',
        'One or more players are already registered in another team for this tournament',
        400,
        { conflictingPlayers: userConflicts }
      );
    }

    const riotConflicts = roster
      .filter((entry) => entry.normalizedRiotId && riotIdSet.has(entry.normalizedRiotId))
      .map((entry) => ({
        riotId: entry.riotId,
        playerName: entry.username,
        existingTeam: registration.teamName
      }));

    if (riotConflicts.length > 0) {
      throw createRegistrationError(
        'RIOT_ID_ALREADY_REGISTERED',
        'One or more Riot IDs are already registered in another team for this tournament',
        400,
        { conflictingPlayers: riotConflicts }
      );
    }
  }
};

const findByIdCompat = async (Model, id, session = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return withSession(Model.findById(id), session);
};

async function prepareValorantRegistration({
  tournamentId,
  requesterUserId,
  teamId,
  models,
  session = null
}) {
  const { Tournament, Team, User, TournamentRegistration } = models;

  if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
    throw createRegistrationError('INVALID_TOURNAMENT_ID', 'Invalid tournament ID');
  }

  if (!teamId || !mongoose.Types.ObjectId.isValid(teamId)) {
    throw createRegistrationError('MISSING_TEAM_ID', 'A valid teamId is required');
  }

  const tournament = await findByIdCompat(Tournament, tournamentId, session);
  if (!tournament) {
    throw createRegistrationError('TOURNAMENT_NOT_FOUND', 'Tournament not found', 404);
  }

  if (tournament.gameType !== 'valorant') {
    throw createRegistrationError('INVALID_GAME_TYPE', 'This endpoint is only for Valorant tournaments');
  }

  if (!tournament.isRegistrationOpen) {
    throw createRegistrationError('REGISTRATION_CLOSED', 'Registration is not open for this tournament');
  }

  const team = await withSession(Team.findById(teamId), session);
  if (!team || !team.isActive) {
    throw createRegistrationError('TEAM_NOT_FOUND', 'Team not found', 404);
  }

  if (team.game !== 'valorant') {
    throw createRegistrationError('INVALID_TEAM_GAME', 'Only Valorant teams can register for Valorant tournaments');
  }

  if (!team.isCaptain(requesterUserId)) {
    throw createRegistrationError('NOT_TEAM_CAPTAIN', 'Only the team captain can register this team', 403);
  }

  const { allMembers } = getRosterMembersFromTeam(team);
  const userIds = allMembers.map((member) => member.userId);
  const users = await withSession(
    User.find({ _id: { $in: userIds } }).select('username fullName email phone gameIds').lean(),
    session
  );

  const rosterSnapshot = buildRosterSnapshot({ team, users });
  const captainUser = users.find((user) => user._id.toString() === rosterSnapshot.captainEntry.userId.toString());
  const snapshot = buildValorantRegistrationSnapshot({ team, rosterSnapshot, captainUser });

  if (!snapshot.whatsappNumber || !/^[6-9]\d{9}$/.test(snapshot.whatsappNumber)) {
    throw createRegistrationError('CAPTAIN_PHONE_REQUIRED', 'Team captain must have a valid phone number before registration');
  }

  const normalizedRiotIds = snapshot.roster.map((entry) => entry.normalizedRiotId);
  const rosterUserIds = snapshot.roster.map((entry) => entry.userId);
  const existingRegistrations = await withSession(
    TournamentRegistration.find(
      buildConflictQuery({ tournamentId, teamId, userIds: rosterUserIds, normalizedRiotIds })
    ).lean(),
    session
  );

  classifyRegistrationConflicts({
    existingRegistrations,
    teamId,
    userIds: rosterUserIds,
    normalizedRiotIds
  });

  if (tournament.currentParticipants >= tournament.maxParticipants) {
    throw createRegistrationError('TOURNAMENT_FULL', 'Tournament is full');
  }

  return {
    tournament,
    team,
    snapshot,
    rosterUserIds
  };
}

async function reserveTournamentCapacity({ Tournament, tournamentId, session }) {
  const now = new Date();
  const result = await Tournament.updateOne(
    {
      _id: tournamentId,
      gameType: 'valorant',
      status: { $in: ['upcoming', 'registration_open'] },
      registrationDeadline: { $gt: now },
      $expr: { $lt: ['$currentParticipants', '$maxParticipants'] }
    },
    { $inc: { currentParticipants: 1 } },
    { session }
  );

  if (result.modifiedCount !== 1) {
    throw createRegistrationError('TOURNAMENT_FULL_OR_CLOSED', 'Tournament registration is closed or full');
  }
}

async function createClaims({ ClaimModel, claims, session }) {
  try {
    await ClaimModel.insertMany(claims, { session, ordered: true });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw mapClaimDuplicateError(claims);
    }
    throw error;
  }
}

async function registerValorantTeam({
  tournamentId,
  requesterUserId,
  teamId,
  models
}) {
  const {
    Tournament,
    Team,
    User,
    TournamentRegistration,
    ClaimModel = TournamentRegistrationClaim
  } = models;

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const prepared = await prepareValorantRegistration({
        tournamentId,
        requesterUserId,
        teamId,
        models: { Tournament, Team, User, TournamentRegistration },
        session
      });

      await reserveTournamentCapacity({ Tournament, tournamentId, session });

      const registration = new TournamentRegistration({
        _id: new mongoose.Types.ObjectId(),
        tournamentId,
        userId: requesterUserId,
        teamId,
        teamName: prepared.snapshot.teamName,
        teamLeader: prepared.snapshot.teamLeader,
        teamMembers: prepared.snapshot.teamMembers,
        substitutePlayer: prepared.snapshot.substitutePlayer,
        whatsappNumber: prepared.snapshot.whatsappNumber,
        roster: prepared.snapshot.roster,
        status: 'pending'
      });
      registration.$locals.skipParticipantSync = true;

      const claims = buildRegistrationClaims({
        tournamentId,
        teamId,
        registrationId: registration._id,
        roster: prepared.snapshot.roster
      });
      await createClaims({ ClaimModel, claims, session });
      await registration.save({ session });

      result = {
        tournament: prepared.tournament,
        team: prepared.team,
        snapshot: prepared.snapshot,
        rosterUserIds: prepared.rosterUserIds,
        registration,
        claims
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function rejectValorantRegistration({
  registrationId,
  adminUserId,
  reason,
  models
}) {
  const {
    Tournament,
    TournamentRegistration,
    ClaimModel = TournamentRegistrationClaim
  } = models;

  const session = await mongoose.startSession();
  try {
    let registration;
    await session.withTransaction(async () => {
      registration = await withSession(TournamentRegistration.findById(registrationId), session);
      if (!registration) {
        throw createRegistrationError('REGISTRATION_NOT_FOUND', 'Registration not found', 404);
      }

      const tournament = await withSession(Tournament.findById(registration.tournamentId), session);
      if (!tournament || tournament.gameType !== 'valorant') {
        throw createRegistrationError('REGISTRATION_NOT_FOUND', 'Registration not found', 404);
      }

      const wasActive = ACTIVE_REGISTRATION_STATUSES.includes(registration.status);
      registration.status = 'rejected';
      registration.verifiedBy = adminUserId;
      registration.verificationDate = new Date();
      registration.rejectionReason = reason;
      registration.$locals.skipParticipantSync = true;
      await registration.save({ session });

      await ClaimModel.deleteMany({ registrationId: registration._id }).session(session);
      if (wasActive) {
        await Tournament.updateOne(
          { _id: tournament._id, currentParticipants: { $gt: 0 } },
          { $inc: { currentParticipants: -1 } },
          { session }
        );
      }
    });
    return registration;
  } finally {
    await session.endSession();
  }
}

async function cancelValorantRegistration({
  registrationId,
  requesterUserId,
  models
}) {
  const {
    Tournament,
    TournamentRegistration,
    ClaimModel = TournamentRegistrationClaim
  } = models;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const registration = await withSession(TournamentRegistration.findById(registrationId), session);
      if (!registration) {
        throw createRegistrationError('REGISTRATION_NOT_FOUND', 'Registration not found', 404);
      }
      if (registration.userId.toString() !== requesterUserId.toString()) {
        throw createRegistrationError('ACCESS_DENIED', 'You can only cancel your own registrations', 403);
      }
      if (registration.status !== 'pending') {
        throw createRegistrationError('CANCELLATION_NOT_ALLOWED', 'Registration can only be cancelled when status is pending');
      }

      const tournament = await withSession(Tournament.findById(registration.tournamentId), session);
      if (!tournament || tournament.gameType !== 'valorant') {
        throw createRegistrationError('REGISTRATION_NOT_FOUND', 'Registration not found', 404);
      }

      await ClaimModel.deleteMany({ registrationId: registration._id }).session(session);
      await TournamentRegistration.deleteOne({ _id: registration._id }).session(session);
      await Tournament.updateOne(
        { _id: tournament._id, currentParticipants: { $gt: 0 } },
        { $inc: { currentParticipants: -1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}

module.exports = {
  ACTIVE_REGISTRATION_STATUSES,
  CLAIM_TYPES,
  buildRegistrationClaims,
  buildConflictQuery,
  buildRosterSnapshot,
  buildValorantRegistrationSnapshot,
  classifyRegistrationConflicts,
  createRegistrationError,
  escapeRegex,
  getRosterMembersFromTeam,
  parseManualRiotId,
  cancelValorantRegistration,
  prepareValorantRegistration,
  registerValorantTeam,
  rejectValorantRegistration,
  reserveTournamentCapacity
};

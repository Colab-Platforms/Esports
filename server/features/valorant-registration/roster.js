const createRegistrationError = (code, message, status = 400, extra = {}) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const toIdString = value => String(value?._id || value || '');
const parseManualRiotId = (value) => {
  if (typeof value !== 'string') {
    throw createRegistrationError('MALFORMED_RIOT_ID', 'Riot ID must use Name#Tag format');
  }

  if (/[\x00-\x1f\x7f]/.test(value)) throw createRegistrationError('MALFORMED_RIOT_ID', 'Riot ID cannot contain control characters');
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
  if (captainEntries.length !== 1 || captainEntries[0].role !== 'captain' || captainEntries[0].isSubstitute ||
      normalizedMembers.filter(member => member.role === 'captain').length !== 1) {
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


module.exports = { createRegistrationError, parseManualRiotId, getRosterMembersFromTeam, buildRosterSnapshot, buildValorantRegistrationSnapshot };

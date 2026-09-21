const User = require('../../models/User');
const Identity = require('../../models/Identity');
const Team = require('../../models/Team');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const {
  GAME_LABELS,
  HISTORY_LIMIT,
  PUBLIC_REGISTRATION_STATUSES,
  TEAM_LIMIT
} = require('./player-competitive-profile.constants');

const toId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

const formatRiotId = (identity) => {
  const gameName = identity?.profile?.gameName;
  const tagLine = identity?.profile?.tagLine;
  if (hasText(gameName) && hasText(tagLine)) return `${gameName.trim()}#${tagLine.trim()}`;
  return identity?.displayName || identity?.username || '';
};

const buildSavedGameAccounts = (user) => {
  const accounts = [];
  const bgmiIgn = user.gameIds?.bgmi?.ign || user.bgmiIgnName || '';
  const bgmiUid = user.gameIds?.bgmi?.uid || user.bgmiUid || '';
  const freeFireIgn = user.gameIds?.freefire?.ign || user.freeFireIgnName || '';
  const freeFireUid = user.gameIds?.freefire?.uid || user.freeFireUid || '';
  const valorantId = user.gameIds?.valorant || '';

  if (hasText(bgmiIgn) || hasText(bgmiUid)) {
    accounts.push({
      provider: 'bgmi',
      label: 'BGMI ID',
      displayName: bgmiIgn,
      identifier: bgmiUid,
      status: 'Saved ID',
      connectionStatus: 'profile_game_id',
      verificationStatus: 'unverified',
      game: 'bgmi'
    });
  }

  if (hasText(freeFireIgn) || hasText(freeFireUid)) {
    accounts.push({
      provider: 'freefire',
      label: 'Free Fire ID',
      displayName: freeFireIgn,
      identifier: freeFireUid,
      status: 'Saved ID',
      connectionStatus: 'profile_game_id',
      verificationStatus: 'unverified',
      game: 'freefire'
    });
  }

  if (hasText(valorantId)) {
    accounts.push({
      provider: 'valorant',
      label: 'Valorant ID',
      displayName: valorantId,
      identifier: '',
      status: 'Saved ID',
      connectionStatus: 'profile_game_id',
      verificationStatus: 'unverified',
      game: 'valorant'
    });
  }

  if (user.steamProfile?.isConnected || hasText(user.gameIds?.steam)) {
    accounts.push({
      provider: 'steam',
      label: 'Steam',
      displayName: user.steamProfile?.displayName || '',
      identifier: '',
      status: user.steamProfile?.isConnected ? 'Linked' : 'Saved ID',
      connectionStatus: user.steamProfile?.isConnected ? 'linked' : 'profile_game_id',
      verificationStatus: user.steamProfile?.isConnected ? 'linked' : 'unverified',
      game: 'cs2'
    });
  }

  return accounts;
};

const normalizeIdentityAccount = (identity) => {
  if (identity.provider === 'riot') {
    return {
      provider: 'riot',
      label: 'Riot',
      displayName: formatRiotId(identity),
      identifier: '',
      status: 'Verified',
      connectionStatus: 'linked',
      verificationStatus: 'verified_game_identity',
      game: 'valorant'
    };
  }

  if (identity.provider === 'steam') {
    return {
      provider: 'steam',
      label: 'Steam',
      displayName: identity.displayName || identity.username || '',
      identifier: '',
      status: 'Linked',
      connectionStatus: 'linked',
      verificationStatus: 'linked',
      game: 'cs2'
    };
  }

  if (identity.provider === 'xbox') {
    return {
      provider: 'xbox',
      label: 'Xbox',
      displayName: identity.profile?.gamertag || identity.displayName || identity.username || '',
      identifier: '',
      status: 'Linked',
      connectionStatus: 'linked',
      verificationStatus: 'linked',
      game: null
    };
  }

  return null;
};

const buildAccounts = (user, identities) => {
  const savedAccounts = buildSavedGameAccounts(user);
  const identityAccounts = identities.map(normalizeIdentityAccount).filter(Boolean);
  const seen = new Set();

  return [...identityAccounts, ...savedAccounts].filter((account) => {
    const key = account.provider;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const addGameSignal = (games, key, source) => {
  if (!key || !GAME_LABELS[key]) return;
  if (!games.has(key)) {
    games.set(key, {
      key,
      label: GAME_LABELS[key],
      sources: []
    });
  }
  if (source && !games.get(key).sources.includes(source)) {
    games.get(key).sources.push(source);
  }
};

const buildGames = ({ user, accounts, teams, registrations, participantTournaments }) => {
  const games = new Map();

  accounts.forEach((account) => addGameSignal(games, account.game, 'account'));
  teams.forEach((team) => addGameSignal(games, team.game, 'team'));
  registrations.forEach((registration) => addGameSignal(games, registration.tournamentId?.gameType, 'tournament'));
  participantTournaments.forEach((tournament) => addGameSignal(games, tournament.gameType, 'tournament'));
  addGameSignal(games, user.favoriteGame, 'favorite');

  return Array.from(games.values());
};

const getMemberInfo = (team, userId) => {
  const userIdString = userId.toString();
  const member = (team.members || []).find((entry) => toId(entry.userId) === userIdString);
  const captainId = toId(team.captain);
  const role = captainId === userIdString || member?.role === 'captain' ? 'captain' : 'member';

  return {
    role,
    isSubstitute: Boolean(member?.isSubstitute),
    joinedAt: member?.joinedAt || team.createdAt
  };
};

const normalizeTeam = (team, userId) => {
  const memberInfo = getMemberInfo(team, userId);
  const memberCount = Array.isArray(team.members) ? team.members.length : 0;
  const captainIncludedInMembers = (team.members || []).some((entry) => toId(entry.userId) === toId(team.captain));

  return {
    id: toId(team),
    name: team.name,
    tag: team.tag || '',
    logo: team.logo || '',
    game: team.game,
    gameLabel: GAME_LABELS[team.game] || team.game,
    role: memberInfo.role,
    isSubstitute: memberInfo.isSubstitute,
    rosterSize: memberCount + (captainIncludedInMembers ? 0 : 1),
    maxMembers: team.maxMembers,
    joinedAt: memberInfo.joinedAt
  };
};

const normalizeRegistrationHistory = (registration) => {
  const tournament = registration.tournamentId;
  if (!tournament) return null;

  return {
    id: `registration-${toId(registration)}`,
    tournamentId: toId(tournament),
    tournamentName: tournament.name,
    game: tournament.gameType,
    gameLabel: GAME_LABELS[tournament.gameType] || tournament.gameType,
    status: tournament.status,
    teamName: registration.teamId?.privacy === 'public'
      ? (registration.teamId.name || registration.teamName)
      : registration.teamName,
    team: registration.teamId?.privacy === 'public' ? {
      id: toId(registration.teamId),
      name: registration.teamId.name,
      tag: registration.teamId.tag || '',
      logo: registration.teamId.logo || ''
    } : null,
    registeredAt: registration.registeredAt,
    startDate: tournament.startDate,
    endDate: tournament.endDate
  };
};

const normalizeParticipantHistory = (tournament) => ({
  id: `participant-${toId(tournament)}`,
  tournamentId: toId(tournament),
  tournamentName: tournament.name,
  game: tournament.gameType,
  gameLabel: GAME_LABELS[tournament.gameType] || tournament.gameType,
  status: tournament.status,
  teamName: '',
  team: null,
  registeredAt: null,
  startDate: tournament.startDate,
  endDate: tournament.endDate
});

const normalizeAchievement = (achievement, index) => ({
  id: `${achievement.name || 'achievement'}-${achievement.earnedAt || index}`,
  name: achievement.name || 'Achievement',
  description: achievement.description || '',
  icon: achievement.icon || '',
  earnedAt: achievement.earnedAt || null
});

const getPlayerCompetitiveProfile = async (username) => {
  const user = await User.findOne({
    username,
    isActive: true,
    profileVisibility: 'public'
  })
    .select('username fullName avatarUrl bio country state favoriteGame gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid steamProfile level achievements createdAt')
    .lean();

  if (!user) {
    const error = new Error('Player not found');
    error.status = 404;
    throw error;
  }

  const registrationFilter = {
    userId: user._id,
    status: { $in: PUBLIC_REGISTRATION_STATUSES }
  };

  const [
    identities,
    teams,
    registrations,
    totalRegistrations,
    registeredTournamentIds,
    participantTournamentIds,
    activeTeams
  ] = await Promise.all([
    Identity.find({ userId: user._id })
      .select('provider displayName username avatarUrl profile createdAt lastUsedAt')
      .lean(),
    Team.find({
      $or: [
        { captain: user._id },
        { 'members.userId': user._id }
      ],
      isActive: true,
      privacy: 'public'
    })
      .sort({ updatedAt: -1 })
      .limit(TEAM_LIMIT)
      .select('name tag logo game captain members maxMembers createdAt updatedAt')
      .lean(),
    TournamentRegistration.find(registrationFilter)
      .sort({ registeredAt: -1 })
      .limit(HISTORY_LIMIT)
      .select('tournamentId teamName teamId registeredAt')
      .populate('tournamentId', 'name gameType status startDate endDate')
      .populate('teamId', 'name tag logo privacy')
      .lean(),
    TournamentRegistration.countDocuments(registrationFilter),
    TournamentRegistration.distinct('tournamentId', registrationFilter),
    Tournament.distinct('_id', { 'participants.userId': user._id }),
    Team.countDocuments({
      $or: [
        { captain: user._id },
        { 'members.userId': user._id }
      ],
      isActive: true,
      privacy: 'public'
    })
  ]);

  const registeredTournamentIdSet = new Set(registeredTournamentIds.map(toId).filter(Boolean));
  const participantOnlyTournamentIds = participantTournamentIds
    .map(toId)
    .filter((id) => id && !registeredTournamentIdSet.has(id));
  const publicTournamentIds = [
    ...registeredTournamentIds,
    ...participantOnlyTournamentIds
  ];

  const [completedTournaments, participantTournaments] = await Promise.all([
    publicTournamentIds.length > 0
      ? Tournament.countDocuments({ _id: { $in: publicTournamentIds }, status: 'completed' })
      : 0,
    participantOnlyTournamentIds.length > 0
      ? Tournament.find({ _id: { $in: participantOnlyTournamentIds } })
          .sort({ startDate: -1, createdAt: -1 })
          .limit(HISTORY_LIMIT)
          .select('name gameType status startDate endDate')
          .lean()
      : []
  ]);

  const accounts = buildAccounts(user, identities);
  const normalizedTeams = teams.map((team) => normalizeTeam(team, user._id));
  const tournamentHistory = [
    ...registrations.map(normalizeRegistrationHistory).filter(Boolean),
    ...participantTournaments.map(normalizeParticipantHistory)
  ]
    .sort((a, b) => new Date(b.registeredAt || b.startDate || 0) - new Date(a.registeredAt || a.startDate || 0))
    .slice(0, HISTORY_LIMIT);
  const achievements = (user.achievements || []).map(normalizeAchievement);

  return {
    player: {
      username: user.username,
      displayName: user.fullName || user.username,
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      country: user.country || '',
      state: user.state || '',
      joinedAt: user.createdAt,
      level: user.level || 1
    },
    accounts,
    games: buildGames({ user, accounts, teams: normalizedTeams, registrations, participantTournaments }),
    overview: {
      tournamentsJoined: totalRegistrations + participantOnlyTournamentIds.length,
      completedTournaments,
      activeTeams,
      achievements: achievements.length
    },
    teams: normalizedTeams,
    tournamentHistory,
    achievements
  };
};

module.exports = {
  buildAccounts,
  buildGames,
  getPlayerCompetitiveProfile,
  normalizeAchievement,
  normalizeIdentityAccount,
  normalizeTeam
};

const mongoose = require('mongoose');
const User = require('../../models/User');
const Identity = require('../../models/Identity');
const Team = require('../../models/Team');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const Notification = require('../../models/Notification');
const Wallet = require('../../models/Wallet');

const ACTIVE_REGISTRATION_STATUSES = ['pending', 'images_uploaded', 'verified'];
const LIVE_TOURNAMENT_STATUSES = ['upcoming', 'registration_open', 'registration_closed', 'active'];
const DASHBOARD_NOTIFICATION_TYPES = ['team_invitation', 'tournament', 'match', 'achievement', 'challenge'];
const PUBLIC_TOURNAMENT_FIELDS = 'name gameType mode status prizePool entryFee maxParticipants currentParticipants registrationDeadline startDate endDate bannerImage';
const TEAM_FIELDS = 'name tag game logo captain members maxMembers createdAt';

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || String(value || '');
const compact = (items) => items.filter(Boolean);

const titleCaseGame = (game) => ({
  bgmi: 'BGMI',
  freefire: 'Free Fire',
  valorant: 'Valorant',
  cs2: 'CS2',
  steam: 'Steam'
}[game] || game);

const hasGameId = (value) => {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') {
    return Object.values(value).some((entry) => typeof entry === 'string' && entry.trim().length > 0);
  }
  return false;
};

const buildLegacyGameAccounts = (user) => compact([
  (hasGameId(user.gameIds?.bgmi) || user.bgmiUid || user.bgmiIgnName) && {
    provider: 'bgmi',
    label: 'BGMI',
    displayName: user.gameIds?.bgmi?.ign || user.bgmiIgnName || '',
    identifier: (typeof user.gameIds?.bgmi === 'string' ? user.gameIds.bgmi : user.gameIds?.bgmi?.uid) || user.bgmiUid || '',
    verified: false,
    connectionStatus: 'profile_game_id',
    verificationStatus: 'unverified',
    source: 'profile'
  },
  (hasGameId(user.gameIds?.freefire) || user.freeFireUid || user.freeFireIgnName) && {
    provider: 'freefire',
    label: 'Free Fire',
    displayName: user.gameIds?.freefire?.ign || user.freeFireIgnName || '',
    identifier: (typeof user.gameIds?.freefire === 'string' ? user.gameIds.freefire : user.gameIds?.freefire?.uid) || user.freeFireUid || '',
    verified: false,
    connectionStatus: 'profile_game_id',
    verificationStatus: 'unverified',
    source: 'profile'
  },
  hasGameId(user.gameIds?.valorant) && {
    provider: 'valorant',
    label: 'Valorant',
    displayName: user.gameIds.valorant,
    identifier: user.gameIds.valorant,
    verified: false,
    connectionStatus: 'profile_game_id',
    verificationStatus: 'unverified',
    source: 'profile'
  },
  (hasGameId(user.gameIds?.steam) || user.steamProfile?.steamId) && {
    provider: 'steam',
    label: 'Steam',
    displayName: user.steamProfile?.displayName || '',
    identifier: user.gameIds?.steam || user.steamProfile?.steamId || '',
    verified: false,
    connectionStatus: user.steamProfile?.steamId ? 'linked' : 'profile_game_id',
    verificationStatus: user.steamProfile?.steamId ? 'linked' : 'unverified',
    source: 'profile'
  }
]);

const normalizeIdentity = (identity) => ({
  id: toId(identity._id),
  provider: identity.provider,
  label: identity.provider.charAt(0).toUpperCase() + identity.provider.slice(1),
  displayName: identity.displayName || identity.username || identity.profile?.gamertag || '',
  username: identity.username || '',
  avatarUrl: identity.avatarUrl || '',
  verified: false,
  connectionStatus: 'linked',
  verificationStatus: 'linked',
  linkedAt: identity.createdAt,
  lastUsedAt: identity.lastUsedAt
});

const normalizeTeam = (team, userId) => {
  const members = Array.isArray(team.members) ? team.members : [];
  const captainId = toId(team.captain);

  return {
    id: toId(team._id),
    name: team.name,
    tag: team.tag || '',
    game: team.game,
    gameLabel: titleCaseGame(team.game),
    logo: team.logo || '',
    role: captainId === userId.toString() ? 'captain' : 'member',
    memberCount: members.length,
    maxMembers: team.maxMembers,
    createdAt: team.createdAt
  };
};

const normalizeTournament = (tournament, registration = null) => ({
  id: toId(tournament._id),
  name: tournament.name,
  gameType: tournament.gameType,
  gameLabel: titleCaseGame(tournament.gameType),
  mode: tournament.mode || '',
  status: tournament.status,
  prizePool: tournament.prizePool || 0,
  entryFee: tournament.entryFee || 0,
  currentParticipants: tournament.currentParticipants || 0,
  maxParticipants: tournament.maxParticipants || 0,
  registrationDeadline: tournament.registrationDeadline,
  startDate: tournament.startDate,
  endDate: tournament.endDate,
  bannerImage: tournament.bannerImage || '',
  registration: registration ? {
    id: toId(registration._id),
    status: registration.status,
    teamName: registration.teamName,
    group: registration.group || null,
    registeredAt: registration.registeredAt || registration.createdAt
  } : null
});

const normalizeRegistration = (registration) => {
  const tournament = registration.tournamentId;

  return {
    id: toId(registration._id),
    status: registration.status,
    teamName: registration.teamName,
    group: registration.group || null,
    registeredAt: registration.registeredAt || registration.createdAt,
    tournament: tournament ? normalizeTournament(tournament) : null
  };
};

const normalizeNotification = (notification) => ({
  id: toId(notification._id),
  type: notification.type,
  title: notification.title,
  message: notification.message,
  actionUrl: typeof notification.actionUrl === 'string' && /^\/(?![\/\\])/.test(notification.actionUrl) && !/[\x00-\x1f\x7f\\]/.test(notification.actionUrl) ? notification.actionUrl : '',
  isRead: !!notification.isRead,
  createdAt: notification.createdAt
});

const getPrimaryGames = (user, teams, registrations) => {
  const games = new Set();

  if (user?.favoriteGame) games.add(user.favoriteGame.toLowerCase());
  teams.forEach((team) => team.game && games.add(team.game));
  registrations.forEach((registration) => registration.tournamentId?.gameType && games.add(registration.tournamentId.gameType));

  Object.entries(user?.gameIds || {}).forEach(([game, value]) => {
    if (hasGameId(value)) games.add(game);
  });

  return Array.from(games)
    .filter((game) => ['bgmi', 'freefire', 'valorant', 'cs2', 'steam'].includes(game))
    .map((game) => ({ key: game, label: titleCaseGame(game) }))
    .slice(0, 5);
};

const getCompetitionDashboard = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) throw Object.assign(new Error('Invalid user'), { status: 400 });
  const objectUserId = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  const registrationFilter = { status: { $in: ACTIVE_REGISTRATION_STATUSES },
    $or: [{ userId: objectUserId }, { 'roster.userId': objectUserId }] };
  const teamFilter = { isActive: true, $or: [{ captain: objectUserId }, { 'members.userId': objectUserId }] };
  const publicFields = Object.fromEntries(PUBLIC_TOURNAMENT_FIELDS.split(' ').map(field => [field, 1]));
  const [user, identities, teams, registrations, participantTournaments, openTournaments, notifications, wallet, totalTeams, summary] = await Promise.all([
    User.findById(objectUserId)
      .select('username fullName avatarUrl favoriteGame gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid steamProfile socialAccounts.google level loginStreak createdAt')
      .lean(),
    Identity.find({ userId: objectUserId, canLogin: true, provider: { $in: ['google', 'facebook', 'steam', 'xbox'] } })
      .select('provider displayName username avatarUrl profile createdAt lastUsedAt').sort({ createdAt: -1 }).limit(4).lean(),
    Team.find(teamFilter).select(TEAM_FIELDS).sort({ createdAt: -1, _id: -1 }).limit(8).lean(),
    TournamentRegistration.aggregate([
      { $match: registrationFilter },
      { $sort: { registeredAt: -1, createdAt: -1, _id: -1 } },
      { $lookup: { from: Tournament.collection.name, localField: 'tournamentId', foreignField: '_id',
        pipeline: [{ $match: { status: { $in: LIVE_TOURNAMENT_STATUSES } } }, { $project: publicFields }], as: 'tournamentId' } },
      { $unwind: '$tournamentId' }, { $limit: 10 },
      { $project: { tournamentId: 1, teamName: 1, status: 1, group: 1, registeredAt: 1, createdAt: 1 } }
    ]),
    Tournament.find({ 'participants.userId': objectUserId, status: { $in: LIVE_TOURNAMENT_STATUSES } })
      .select(PUBLIC_TOURNAMENT_FIELDS).sort({ startDate: 1, createdAt: -1, _id: -1 }).limit(10).lean(),
    Tournament.aggregate([
      { $match: { status: { $in: ['registration_open', 'upcoming'] }, 'participants.userId': { $ne: objectUserId },
        $expr: { $lt: [{ $ifNull: ['$currentParticipants', 0] }, { $ifNull: ['$maxParticipants', 0] }] },
        $or: [{ registrationDeadline: { $exists: false } }, { registrationDeadline: null }, { registrationDeadline: { $gt: now } }] } },
      { $sort: { startDate: 1, registrationDeadline: 1, createdAt: -1, _id: -1 } },
      { $lookup: { from: TournamentRegistration.collection.name, let: { tournament: '$_id' },
        pipeline: [{ $match: { ...registrationFilter, $expr: { $eq: ['$tournamentId', '$$tournament'] } } },
          { $limit: 1 }, { $project: { _id: 1 } }], as: 'ownRegistrations' } },
      { $match: { 'ownRegistrations.0': { $exists: false } } }, { $limit: 8 }, { $project: publicFields }
    ]),
    Notification.find({ user: objectUserId, type: { $in: DASHBOARD_NOTIFICATION_TYPES } })
      .select('type title message actionUrl isRead createdAt').sort({ createdAt: -1, _id: -1 }).limit(6).lean(),
    Wallet.findOne({ userId: objectUserId }).select('balance totalEarned totalSpent').lean(),
    Team.countDocuments(teamFilter),
    TournamentRegistration.aggregate([
      { $match: registrationFilter }, { $group: { _id: '$tournamentId' } },
      { $lookup: { from: Tournament.collection.name, localField: '_id', foreignField: '_id',
        pipeline: [{ $project: { status: 1 } }], as: 'tournament' } },
      { $unwind: '$tournament' },
      { $project: { status: '$tournament.status', hasRegistration: { $literal: 1 } } },
      { $unionWith: { coll: Tournament.collection.name, pipeline: [
        { $match: { 'participants.userId': objectUserId } }, { $project: { status: 1, hasRegistration: { $literal: 0 } } }
      ] } },
      { $group: { _id: '$_id', status: { $first: '$status' }, hasRegistration: { $max: '$hasRegistration' } } },
      { $group: { _id: null, tournamentsJoined: { $sum: 1 },
        activeRegistrations: { $sum: { $cond: [{ $and: [{ $eq: ['$hasRegistration', 1] }, { $in: ['$status', LIVE_TOURNAMENT_STATUSES] }] }, 1, 0] } },
        completedCompetitions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }
    ])
  ]);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const competitionMap = new Map();
  registrations.forEach(registration => {
    const id = toId(registration.tournamentId);
    if (!competitionMap.has(id)) competitionMap.set(id, { ...normalizeTournament(registration.tournamentId, registration), participating: true });
  });
  participantTournaments.forEach(tournament => {
    const id = toId(tournament);
    if (!competitionMap.has(id)) competitionMap.set(id, { ...normalizeTournament(tournament), participating: true });
  });
  openTournaments.forEach(tournament => {
    const id = toId(tournament);
    if (!competitionMap.has(id)) competitionMap.set(id, { ...normalizeTournament(tournament), participating: false });
  });
  const startsAt = competition => {
    const value = new Date(competition.startDate || competition.registrationDeadline || '').getTime();
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  };
  const upcomingCompetitions = Array.from(competitionMap.values())
    .sort((a, b) => Number(b.participating) - Number(a.participating) || startsAt(a) - startsAt(b) || a.id.localeCompare(b.id))
    .slice(0, 6);
  const accounts = new Map(identities.map(identity => [identity.provider, normalizeIdentity(identity)]));
  const legacyGoogle = user.socialAccounts?.google;
  if (legacyGoogle?.id && !accounts.has('google')) accounts.set('google', {
    provider: 'google', label: 'Google', displayName: legacyGoogle.name || user.username,
    verified: false, connectionStatus: 'linked', verificationStatus: 'linked', source: 'legacy'
  });
  buildLegacyGameAccounts(user).forEach(account => { if (!accounts.has(account.provider)) accounts.set(account.provider, account); });
  const registrationMap = new Map();
  registrations.forEach(registration => {
    const id = toId(registration.tournamentId);
    if (!registrationMap.has(id)) registrationMap.set(id, normalizeRegistration(registration));
  });
  const activeRegistrations = Array.from(registrationMap.values()).slice(0, 6);
  return {
    player: { id: toId(user), username: user.username, displayName: user.fullName || user.username,
      avatarUrl: user.avatarUrl || '', level: user.level || 1, loginStreak: user.loginStreak || 0,
      primaryGames: getPrimaryGames(user, teams, registrations) },
    verifiedAccounts: Array.from(accounts.values()).slice(0, 10),
    overview: { tournamentsJoined: summary[0]?.tournamentsJoined || 0, activeRegistrations: summary[0]?.activeRegistrations || 0,
      teams: totalTeams, completedCompetitions: summary[0]?.completedCompetitions || 0 },
    teams: teams.map(team => normalizeTeam(team, String(userId))), upcomingCompetitions,
    registrations: activeRegistrations, recentActivity: notifications.map(normalizeNotification),
    wallet: { balance: wallet?.balance || 0, totalEarned: wallet?.totalEarned || 0, totalSpent: wallet?.totalSpent || 0 }
  };
};

module.exports = { getCompetitionDashboard };

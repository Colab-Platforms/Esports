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
  hasGameId(user.gameIds?.bgmi) && {
    provider: 'bgmi',
    label: 'BGMI',
    displayName: user.gameIds.bgmi.ign || user.bgmiIgnName || '',
    identifier: user.gameIds.bgmi.uid || user.bgmiUid || '',
    verified: false,
    connectionStatus: 'profile_game_id',
    verificationStatus: 'unverified',
    source: 'profile'
  },
  hasGameId(user.gameIds?.freefire) && {
    provider: 'freefire',
    label: 'Free Fire',
    displayName: user.gameIds.freefire.ign || user.freeFireIgnName || '',
    identifier: user.gameIds.freefire.uid || user.freeFireUid || '',
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
  hasGameId(user.gameIds?.steam) && {
    provider: 'steam',
    label: 'Steam',
    displayName: user.steamProfile?.displayName || '',
    identifier: user.gameIds.steam,
    verified: false,
    connectionStatus: user.steamProfile?.isConnected ? 'linked' : 'profile_game_id',
    verificationStatus: 'linked',
    source: 'profile'
  }
]);

const getVerificationStatus = (provider) => (
  provider === 'riot' ? 'verified_game_identity' : 'linked'
);

const normalizeIdentity = (identity) => ({
  id: toId(identity._id),
  provider: identity.provider,
  label: identity.provider.charAt(0).toUpperCase() + identity.provider.slice(1),
  displayName: identity.displayName || identity.username || identity.profile?.gamertag || '',
  username: identity.username || '',
  avatarUrl: identity.avatarUrl || '',
  verified: identity.provider === 'riot',
  connectionStatus: 'linked',
  verificationStatus: getVerificationStatus(identity.provider),
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
  actionUrl: notification.actionUrl || '',
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

const getRecentWalletTransactions = (wallet) => {
  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];

  return [...transactions]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 3)
    .map((transaction) => ({
      id: toId(transaction._id),
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      createdAt: transaction.createdAt
    }));
};

const getCompetitionDashboard = async (userId) => {
  const objectUserId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  const [
    user,
    identities,
    teams,
    registrations,
    participantTournaments,
    openTournaments,
    notifications,
    wallet,
    totalTeams,
    totalRegistrations,
    activeRegistrationCount,
    registeredTournamentIds,
    participantTournamentIds
  ] = await Promise.all([
    User.findById(objectUserId)
      .select('username fullName avatarUrl favoriteGame gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid steamProfile level loginStreak createdAt')
      .lean(),
    Identity.find({ userId: objectUserId })
      .select('provider displayName username avatarUrl profile createdAt lastUsedAt')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Team.find({ 'members.userId': objectUserId, isActive: true })
      .select(TEAM_FIELDS)
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    TournamentRegistration.find({ userId: objectUserId })
      .select('tournamentId teamName status group registeredAt createdAt')
      .populate('tournamentId', PUBLIC_TOURNAMENT_FIELDS)
      .sort({ registeredAt: -1, createdAt: -1 })
      .limit(10)
      .lean(),
    Tournament.find({ 'participants.userId': objectUserId })
      .select(PUBLIC_TOURNAMENT_FIELDS)
      .sort({ startDate: -1, createdAt: -1 })
      .limit(10)
      .lean(),
    Tournament.find({
      status: { $in: ['registration_open', 'upcoming', 'active'] },
      $or: [
        { registrationDeadline: { $exists: false } },
        { registrationDeadline: null },
        { registrationDeadline: { $gte: now } }
      ]
    })
      .select(PUBLIC_TOURNAMENT_FIELDS)
      .sort({ startDate: 1, registrationDeadline: 1, createdAt: -1 })
      .limit(8)
      .lean(),
    Notification.find({ user: objectUserId, type: { $in: DASHBOARD_NOTIFICATION_TYPES } })
      .select('type title message actionUrl isRead createdAt')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Wallet.findOne({ userId: objectUserId })
      .select('balance totalEarned totalSpent streak transactions')
      .slice('transactions', -3)
      .lean(),
    Team.countDocuments({ 'members.userId': objectUserId, isActive: true }),
    TournamentRegistration.countDocuments({ userId: objectUserId }),
    TournamentRegistration.countDocuments({
      userId: objectUserId,
      status: { $in: ACTIVE_REGISTRATION_STATUSES }
    }),
    TournamentRegistration.distinct('tournamentId', { userId: objectUserId }),
    Tournament.distinct('_id', { 'participants.userId': objectUserId })
  ]);

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const userIdString = userId.toString();
  const normalizedTeams = teams.map((team) => normalizeTeam(team, userIdString));
  const normalizedRegistrations = registrations.map(normalizeRegistration);
  const registeredTournamentIdStrings = new Set(registeredTournamentIds.map(toId).filter(Boolean));
  const participantTournamentIdStrings = participantTournamentIds.map(toId).filter(Boolean);

  const competitionMap = new Map();
  registrations.forEach((registration) => {
    if (registration.tournamentId) {
      competitionMap.set(toId(registration.tournamentId._id), normalizeTournament(registration.tournamentId, registration));
    }
  });
  participantTournaments.forEach((tournament) => {
    const id = toId(tournament._id);
    if (!competitionMap.has(id)) competitionMap.set(id, normalizeTournament(tournament));
  });
  openTournaments.forEach((tournament) => {
    const id = toId(tournament._id);
    if (!competitionMap.has(id) && !registeredTournamentIdStrings.has(id)) competitionMap.set(id, normalizeTournament(tournament));
  });

  const upcomingCompetitions = Array.from(competitionMap.values())
    .filter((competition) => LIVE_TOURNAMENT_STATUSES.includes(competition.status))
    .sort((a, b) => {
      const aParticipating = a.registration ? 0 : 1;
      const bParticipating = b.registration ? 0 : 1;
      if (aParticipating !== bParticipating) return aParticipating - bParticipating;
      return new Date(a.startDate || a.registrationDeadline || 0) - new Date(b.startDate || b.registrationDeadline || 0);
    })
    .slice(0, 6);

  const participantOnlyTournamentIds = participantTournamentIdStrings
    .filter((id) => !registeredTournamentIdStrings.has(id));

  const [completedRegisteredCompetitions, completedParticipantCompetitions] = await Promise.all([
    registeredTournamentIds.length > 0
      ? Tournament.countDocuments({ _id: { $in: registeredTournamentIds }, status: 'completed' })
      : 0,
    participantOnlyTournamentIds.length > 0
      ? Tournament.countDocuments({ _id: { $in: participantOnlyTournamentIds }, status: 'completed' })
      : 0
  ]);
  const completedCompetitions = completedRegisteredCompetitions + completedParticipantCompetitions;

  const verifiedAccounts = [
    ...identities.map(normalizeIdentity),
    ...buildLegacyGameAccounts(user)
  ].slice(0, 10);

  const activeRegistrations = normalizedRegistrations
    .filter((registration) => ACTIVE_REGISTRATION_STATUSES.includes(registration.status))
    .slice(0, 6);

  return {
    player: {
      id: toId(user._id),
      username: user.username,
      displayName: user.fullName || user.username,
      avatarUrl: user.avatarUrl || '',
      level: user.level || 1,
      loginStreak: user.loginStreak || 0,
      primaryGames: getPrimaryGames(user, teams, registrations)
    },
    verifiedAccounts,
    overview: {
      tournamentsJoined: totalRegistrations + participantOnlyTournamentIds.length,
      activeRegistrations: activeRegistrationCount,
      teams: totalTeams,
      completedCompetitions
    },
    teams: normalizedTeams,
    upcomingCompetitions,
    registrations: activeRegistrations,
    recentActivity: notifications.map(normalizeNotification),
    wallet: {
      balance: wallet?.balance || 0,
      totalEarned: wallet?.totalEarned || 0,
      totalSpent: wallet?.totalSpent || 0,
      streak: wallet?.streak || 0,
      recentTransactions: getRecentWalletTransactions(wallet)
    }
  };
};

module.exports = {
  getCompetitionDashboard
};

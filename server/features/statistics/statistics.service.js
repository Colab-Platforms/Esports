const mongoose = require('mongoose');
const User = require('../../models/User');
const Team = require('../../models/Team');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const {
  ACTIVE_GAMES,
  COMPLETED_TOURNAMENT_STATUS,
  COVERAGE_NOTE,
  PUBLIC_REGISTRATION_STATUSES,
  supportedValue
} = require('./statistics.constants');
const {
  getBgmiPlayerStatistics,
  getBgmiTeamStatistics
} = require('./adapters/bgmi-statistics.adapter');
const {
  getFreeFirePlayerStatistics,
  getFreeFireTeamStatistics
} = require('./adapters/freefire-statistics.adapter');
const {
  getValorantPlayerStatistics,
  getValorantTeamStatistics
} = require('./adapters/valorant-statistics.adapter');
const { toId } = require('./adapters/statistics.utils');

const notFound = (message) => {
  const error = new Error(message);
  error.status = 404;
  return error;
};

const gameHasStats = (gameStats) => {
  const performance = gameStats?.performance || {};
  return Object.values(performance).some((value) => {
    if (typeof value === 'number') return value > 0;
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
      return typeof value.value === 'number' && value.value > 0;
    }
    if (Array.isArray(value)) return value.length > 0;
    return false;
  });
};

const countVerifiedResultParticipations = (games) => (
  (games.bgmi?.performance?.matchesPlayed?.value || 0) +
  (games.freefire?.performance?.matchesParticipated || 0) +
  (games.valorant?.performance?.matchesParticipated || 0)
);

const normalizeRegistration = (registration) => ({
  id: toId(registration),
  teamName: registration.teamName || '',
  game: registration.tournamentId?.gameType || null,
  tournamentId: toId(registration.tournamentId),
  tournamentName: registration.tournamentId?.name || '',
  tournamentStatus: registration.tournamentId?.status || '',
  status: registration.status || '',
  registeredAt: registration.registeredAt || registration.createdAt || null
});

const getPlayerParticipationOverview = async ({ user, models }) => {
  const RegistrationModel = models.TournamentRegistration || TournamentRegistration;
  const TournamentModel = models.Tournament || Tournament;
  const TeamModel = models.Team || Team;

  const registrationFilter = {
    userId: user._id,
    status: { $in: PUBLIC_REGISTRATION_STATUSES }
  };

  const [
    registrations,
    registeredTournamentIds,
    participantTournamentIds,
    activeTeams
  ] = await Promise.all([
    RegistrationModel.find(registrationFilter)
      .select('tournamentId teamName teamId status registeredAt createdAt')
      .populate('tournamentId', 'name gameType status startDate endDate')
      .sort({ registeredAt: -1, createdAt: -1 })
      .limit(50)
      .lean(),
    RegistrationModel.distinct('tournamentId', registrationFilter),
    TournamentModel.distinct('_id', { 'participants.userId': user._id, gameType: { $in: ACTIVE_GAMES } }),
    TeamModel.countDocuments({
      $or: [
        { captain: user._id },
        { 'members.userId': user._id }
      ],
      isActive: true,
      privacy: 'public',
      game: { $in: ACTIVE_GAMES }
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

  const completedTournaments = publicTournamentIds.length > 0
    ? await TournamentModel.countDocuments({
        _id: { $in: publicTournamentIds },
        gameType: { $in: ACTIVE_GAMES },
        status: COMPLETED_TOURNAMENT_STATUS
      })
    : 0;

  const registrationsByGame = ACTIVE_GAMES.reduce((acc, game) => {
    acc[game] = registrations.filter((registration) => registration.tournamentId?.gameType === game);
    return acc;
  }, {});

  return {
    tournamentsJoined: registrations.length + participantOnlyTournamentIds.length,
    completedTournaments,
    activeTeams,
    registrationsByGame,
    participationHistory: registrations.map(normalizeRegistration)
  };
};

const getPlayerStatistics = async (username, options = {}) => {
  const models = options.models || {};
  const UserModel = models.User || User;

  const user = await UserModel.findOne({
    username,
    isActive: true,
    profileVisibility: 'public'
  })
    .select('username fullName avatarUrl gameIds bgmiIgnName bgmiUid freeFireIgnName freeFireUid createdAt')
    .lean();

  if (!user) throw notFound('Player not found');

  const participation = await getPlayerParticipationOverview({ user, models });
  const [bgmi, freefire, valorant] = await Promise.all([
    getBgmiPlayerStatistics({ user, models }),
    getFreeFirePlayerStatistics({ user, models }),
    getValorantPlayerStatistics({ user, models })
  ]);

  bgmi.participation = {
    ...bgmi.participation,
    registeredTeams: supportedValue(participation.registrationsByGame.bgmi.length),
    participationHistory: participation.registrationsByGame.bgmi.map(normalizeRegistration)
  };

  const games = { bgmi, freefire, valorant };
  const gamesWithStats = Object.values(games).filter(gameHasStats).length;

  return {
    player: {
      id: toId(user),
      username: user.username,
      displayName: user.fullName || user.username,
      avatarUrl: user.avatarUrl || ''
    },
    coverage: {
      note: COVERAGE_NOTE
    },
    overview: {
      tournamentsJoined: participation.tournamentsJoined,
      completedTournaments: participation.completedTournaments,
      activeTeams: participation.activeTeams,
      verifiedResultParticipations: countVerifiedResultParticipations(games),
      gamesWithStats
    },
    games,
    participationHistory: participation.participationHistory,
    unsupported: [
      'cross_game_win_rate',
      'cross_game_kills',
      'cross_game_rating'
    ]
  };
};

const getTeamRegistrationIds = async ({ teamId, models }) => {
  const RegistrationModel = models.TournamentRegistration || TournamentRegistration;
  const registrations = await RegistrationModel.find({
    teamId,
    status: 'verified'
  })
    .select('_id')
    .lean();
  return registrations.map(toId).filter(Boolean);
};

const getTeamStatistics = async (teamId, options = {}) => {
  const models = options.models || {};
  const TeamModel = models.Team || Team;

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw notFound('Team not found');
  }

  const team = await TeamModel.findOne({
    _id: teamId,
    isActive: true,
    privacy: 'public',
    game: { $in: ACTIVE_GAMES }
  })
    .select('name tag logo game captain members maxMembers createdAt updatedAt')
    .lean();

  if (!team) throw notFound('Team not found');

  const registrationIds = await getTeamRegistrationIds({ teamId, models });
  const game = team.game;
  let gameStats;

  if (game === 'bgmi') {
    gameStats = await getBgmiTeamStatistics({ teamId, registrationIds, models });
  } else if (game === 'freefire') {
    gameStats = await getFreeFireTeamStatistics({ teamId, registrationIds, models });
  } else if (game === 'valorant') {
    gameStats = await getValorantTeamStatistics({ teamId, registrationIds, models });
  }

  return {
    team: {
      id: toId(team),
      name: team.name,
      tag: team.tag || '',
      logo: team.logo || '',
      gameType: game,
      rosterSize: Array.isArray(team.members) ? team.members.length : 0,
      maxMembers: team.maxMembers
    },
    coverage: {
      note: COVERAGE_NOTE
    },
    overview: {
      verifiedResults: gameStats?.performance?.matchesPlayed || 0,
      registrationLinks: registrationIds.length
    },
    game,
    statistics: gameStats,
    unsupported: [
      'cross_game_rating',
      'elo_mmr'
    ]
  };
};

module.exports = {
  getPlayerStatistics,
  getTeamStatistics,
  gameHasStats
};

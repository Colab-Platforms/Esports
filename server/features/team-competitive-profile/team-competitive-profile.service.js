const mongoose = require('mongoose');
const Team = require('../../models/Team');
const TournamentRegistration = require('../../models/TournamentRegistration');
const statisticsService = require('../statistics/statistics.service');
const {
  ACTIVE_GAMES,
  GAME_LABELS,
  HISTORY_LIMIT,
  PUBLIC_REGISTRATION_STATUSES,
  TOURNAMENT_LIMIT
} = require('./team-competitive-profile.constants');
const { getTeamCompetitiveHistory } = require('./team-competitive-profile.history');
const { formatStatus, sortNewestFirst, toId } = require('./team-competitive-profile.utils');

const notFound = (message = 'Team not found') => {
  const error = new Error(message);
  error.status = 404;
  return error;
};

const publicUser = (user) => {
  if (!user) return null;
  return {
    id: toId(user),
    username: user.username || '',
    displayName: user.fullName || user.username || '',
    avatarUrl: user.avatarUrl || '',
    level: user.level || 1
  };
};

const normalizeRoster = (team) => {
  const captainId = toId(team.captain);
  return (team.members || [])
    .map((member) => {
      const user = member.userId;
      if (!user) return null;
      const userId = toId(user);
      const isCaptain = userId === captainId || member.role === 'captain';
      return {
        user: publicUser(user),
        role: isCaptain ? 'captain' : 'member',
        isCaptain,
        isSubstitute: Boolean(member.isSubstitute),
        joinedAt: member.joinedAt || team.createdAt
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isCaptain) return -1;
      if (b.isCaptain) return 1;
      if (a.isSubstitute && !b.isSubstitute) return 1;
      if (!a.isSubstitute && b.isSubstitute) return -1;
      return new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0);
    });
};

const normalizeTournament = (registration) => {
  const tournament = registration.tournamentId;
  if (!tournament) return null;
  return {
    id: toId(registration),
    tournamentId: toId(tournament),
    tournamentName: tournament.name || '',
    game: tournament.gameType,
    gameLabel: GAME_LABELS[tournament.gameType] || tournament.gameType,
    tournamentStatus: tournament.status || '',
    registrationStatus: registration.status || '',
    teamName: registration.teamName || '',
    registeredAt: registration.registeredAt || registration.createdAt || null,
    startDate: tournament.startDate || null,
    endDate: tournament.endDate || null,
    status: formatStatus(registration, tournament)
  };
};

const getTournamentHistory = async ({ teamId, models = {} }) => {
  const RegistrationModel = models.TournamentRegistration || TournamentRegistration;
  const registrations = await RegistrationModel.find({
    teamId,
    status: { $in: PUBLIC_REGISTRATION_STATUSES }
  })
    .select('tournamentId teamName status registeredAt createdAt')
    .populate('tournamentId', 'name gameType status startDate endDate')
    .sort({ registeredAt: -1, createdAt: -1 })
    .limit(TOURNAMENT_LIMIT)
    .lean();

  return registrations.map(normalizeTournament).filter(Boolean);
};

const recentFormFromStatistics = (statistics) => (
  statistics?.statistics?.performance?.recentForm || []
);

const getTeamCompetitiveProfile = async (teamId, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw notFound();
  }

  const models = options.models || {};
  const TeamModel = models.Team || Team;
  const team = await TeamModel.findOne({
    _id: teamId,
    isActive: true,
    privacy: 'public',
    game: { $in: ACTIVE_GAMES }
  })
    .select('name tag logo description game captain members maxMembers privacy createdAt updatedAt')
    .populate('captain', 'username fullName avatarUrl level')
    .populate('members.userId', 'username fullName avatarUrl level')
    .lean();

  if (!team) throw notFound();

  const [statistics, tournaments, competitiveHistory] = await Promise.all([
    statisticsService.getTeamStatistics(teamId, { models }),
    getTournamentHistory({ teamId, models }),
    getTeamCompetitiveHistory({ team, limit: HISTORY_LIMIT, models })
  ]);

  const roster = normalizeRoster(team);
  const captain = publicUser(team.captain) || roster.find((member) => member.isCaptain)?.user || null;

  return {
    team: {
      id: toId(team),
      name: team.name,
      tag: team.tag || '',
      logo: team.logo || '',
      description: team.description || '',
      game: team.game,
      gameLabel: GAME_LABELS[team.game] || team.game,
      privacy: team.privacy,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      rosterSize: roster.length,
      maxMembers: team.maxMembers
    },
    captain,
    roster,
    overview: {
      tournamentsPlayed: tournaments.length,
      verifiedResults: statistics.overview?.verifiedResults || 0,
      rosterCount: roster.length
    },
    statistics,
    recentForm: recentFormFromStatistics(statistics),
    tournaments: sortNewestFirst(tournaments.map((item) => ({
      ...item,
      occurredAt: item.registeredAt || item.startDate || item.endDate
    }))).map(({ occurredAt, ...item }) => item),
    competitiveHistory,
    coverage: statistics.coverage || {
      note: 'Stats are based on verified results available on Colab.'
    }
  };
};

module.exports = {
  getTeamCompetitiveProfile,
  normalizeRoster
};

const Tournament = require('../../../models/Tournament');
const TournamentRegistration = require('../../../models/TournamentRegistration');
const {
  CONFIDENCE,
  PUBLIC_REGISTRATION_STATUSES
} = require('../competitive-history.constants');
const { sortNewestFirst, toId } = require('../competitive-history.utils');

const registrationStatus = (registration, tournament) => {
  if (tournament?.status === 'completed' && registration.status === 'verified') {
    return 'completed_participation';
  }
  if (registration.status === 'verified') return 'verified';
  if (registration.status === 'images_uploaded') return 'verification_submitted';
  return 'registered';
};

const participantStatus = (tournament) => (
  tournament?.status === 'completed' ? 'completed_participation' : 'registered'
);

const normalizeTeamFromRegistration = (registration) => {
  if (registration.teamId && registration.teamId.privacy === 'public') {
    return {
      entityType: 'team',
      entityId: toId(registration.teamId),
      name: registration.teamId.name || registration.teamName || ''
    };
  }

  return {
    entityType: 'registration',
    entityId: toId(registration),
    name: registration.teamName || ''
  };
};

const getTournamentHistory = async ({ user, limit, models = {} }) => {
  const RegistrationModel = models.TournamentRegistration || TournamentRegistration;
  const TournamentModel = models.Tournament || Tournament;
  const queryLimit = Math.max(limit * 2, limit);

  const registrationFilter = {
    userId: user._id,
    status: { $in: PUBLIC_REGISTRATION_STATUSES }
  };

  const [registrations, participantTournaments] = await Promise.all([
    RegistrationModel.find(registrationFilter)
      .sort({ registeredAt: -1 })
      .limit(queryLimit)
      .select('tournamentId teamName teamId status registeredAt')
      .populate('tournamentId', 'name gameType status startDate endDate')
      .populate('teamId', 'name privacy')
      .lean(),
    TournamentModel.find({ 'participants.userId': user._id })
      .sort({ startDate: -1, createdAt: -1 })
      .limit(queryLimit)
      .select('name gameType status startDate endDate participants.userId participants.registeredAt participants.teamName')
      .lean()
  ]);

  const registeredTournamentIds = new Set(
    registrations.map((registration) => toId(registration.tournamentId)).filter(Boolean)
  );

  const registrationEvents = registrations
    .filter((registration) => registration.tournamentId)
    .map((registration) => {
      const tournament = registration.tournamentId;
      return {
        id: `tournament-registration-${toId(registration)}`,
        source: {
          type: 'tournament_registration',
          id: toId(registration)
        },
        level: 'tournament',
        gameType: tournament.gameType,
        tournament: {
          id: toId(tournament),
          name: tournament.name
        },
        team: normalizeTeamFromRegistration(registration),
        occurredAt: registration.registeredAt || tournament.startDate || tournament.endDate,
        status: registrationStatus(registration, tournament),
        confidence: CONFIDENCE.PARTICIPATION_ONLY,
        result: null
      };
    });

  const participantEvents = participantTournaments
    .filter((tournament) => !registeredTournamentIds.has(toId(tournament)))
    .map((tournament) => {
      const participant = (tournament.participants || []).find((entry) => toId(entry.userId) === toId(user._id));
      return {
        id: `tournament-participant-${toId(tournament)}-${toId(user._id)}`,
        source: {
          type: 'tournament_participant',
          id: toId(tournament)
        },
        level: 'tournament',
        gameType: tournament.gameType,
        tournament: {
          id: toId(tournament),
          name: tournament.name
        },
        team: participant?.teamName ? {
          entityType: 'snapshot',
          entityId: '',
          name: participant.teamName
        } : null,
        occurredAt: participant?.registeredAt || tournament.startDate || tournament.endDate,
        status: participantStatus(tournament),
        confidence: CONFIDENCE.PARTICIPATION_ONLY,
        result: null
      };
    });

  return sortNewestFirst([...registrationEvents, ...participantEvents]).slice(0, limit);
};

module.exports = {
  getTournamentHistory,
  normalizeTeamFromRegistration,
  registrationStatus
};

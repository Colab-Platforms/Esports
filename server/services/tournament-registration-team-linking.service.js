const mongoose = require('mongoose');

const responseError = (message, status = 400, code = 'VALIDATION_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const toId = (value) => {
  if (!value) return '';
  if (value._id) return value._id.toString();
  return value.toString();
};

const normalizeGameId = (value) => String(value || '').trim().toLowerCase();

const userGameId = (user, gameType) => {
  if (!user) return '';
  if (gameType === 'bgmi') {
    return user.gameIds?.bgmi?.uid || user.bgmiUid || '';
  }
  if (gameType === 'freefire') {
    return user.gameIds?.freefire?.uid || user.freeFireUid || '';
  }
  return '';
};

const payloadGameIds = ({ gameType, teamLeader, teamMembers = [], substitute }) => {
  const field = gameType === 'bgmi' ? 'bgmiId' : 'freeFireId';
  return [
    teamLeader?.[field],
    ...teamMembers.map((member) => member?.[field]),
    substitute?.[field]
  ].filter(Boolean).map(normalizeGameId);
};

const teamMemberUsers = (team) => {
  const users = [];
  if (team.captain && typeof team.captain === 'object') users.push(team.captain);
  (team.members || []).forEach((member) => {
    if (member?.userId && typeof member.userId === 'object') users.push(member.userId);
  });
  return users;
};

const isTeamMember = (team, userId) => {
  if (typeof team.isMember === 'function') return team.isMember(userId);
  const id = toId(userId);
  return toId(team.captain) === id || (team.members || []).some((member) => toId(member.userId) === id);
};

const validateLinkedTeamRegistration = async ({
  Team,
  teamId,
  tournament,
  requesterUserId,
  teamLeader,
  teamMembers,
  substitute
}) => {
  if (!teamId) return null;
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw responseError('A valid teamId is required', 400, 'INVALID_TEAM_ID');
  }

  const team = await Team.findById(teamId)
    .populate('captain', 'username gameIds bgmiUid freeFireUid isActive')
    .populate('members.userId', 'username gameIds bgmiUid freeFireUid isActive');

  if (!team) {
    throw responseError('Team not found', 404, 'TEAM_NOT_FOUND');
  }
  if (team.isActive === false) {
    throw responseError('Team is not active', 400, 'TEAM_NOT_ACTIVE');
  }
  if (team.game !== tournament.gameType) {
    throw responseError('Team game does not match tournament game', 400, 'INVALID_TEAM_GAME');
  }
  if (!isTeamMember(team, requesterUserId)) {
    throw responseError('You are not allowed to register this team', 403, 'NOT_TEAM_MEMBER');
  }

  const submittedIds = payloadGameIds({
    gameType: tournament.gameType,
    teamLeader,
    teamMembers,
    substitute
  });
  const teamIds = new Set(
    teamMemberUsers(team)
      .map((user) => normalizeGameId(userGameId(user, tournament.gameType)))
      .filter(Boolean)
  );

  if (submittedIds.length === 0 || submittedIds.some((id) => !teamIds.has(id))) {
    throw responseError('Submitted roster does not match the selected team', 400, 'TEAM_ROSTER_MISMATCH');
  }

  return team._id;
};

module.exports = {
  validateLinkedTeamRegistration,
  payloadGameIds,
  userGameId
};

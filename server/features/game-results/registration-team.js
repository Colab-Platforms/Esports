const Team = require('../../models/Team');
const { inSession } = require('./result-transactions');
const { toId } = require('./game-results.utils');

async function validateRegistrationTeam(registration, gameType) {
  if (!registration.teamId) return null;
  const team = await inSession(Team.findById(registration.teamId)).lean();
  const owner = toId(registration.userId);
  if (!team || !team.isActive || team.game !== gameType ||
      !(toId(team.captain) === owner || (team.members || []).some(member => toId(member.userId) === owner))) {
    throw Object.assign(new Error('Registration has an invalid or unauthorized team link; review before publishing'), {
      status: 409, code: 'INVALID_REGISTRATION_TEAM'
    });
  }
  return team._id;
}

module.exports = { validateRegistrationTeam };

const Team = require('../../models/Team');
const { inSession } = require('./result-transactions');
const { toId } = require('./game-results.utils');

const entrantConflict = message => Object.assign(new Error(message), {
  status: 409, code: 'AMBIGUOUS_RESULT_ENTRANT'
});

// Repeated matches may reference the same registration, but distinct attempts
// for one owner must never become separate entrants or be silently merged.
function recordRegistrationEntrant(registration, owners) {
  const owner = toId(registration.userId);
  const registrationId = toId(registration);
  if (!owner || !registrationId) throw entrantConflict('Registration owner is missing; review before publishing');
  if (owners.has(owner) && owners.get(owner) !== registrationId) {
    throw entrantConflict('Duplicate registration owner in competitive entrants');
  }
  owners.set(owner, registrationId);
}

async function validateRegistrationTeam(registration, gameType) {
  if (!toId(registration.userId)) throw entrantConflict('Registration owner is missing; review before publishing');
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

module.exports = { validateRegistrationTeam, recordRegistrationEntrant, entrantConflict };

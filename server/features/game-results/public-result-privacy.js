const Team = require('../../models/Team');
const { toId } = require('./game-results.utils');

// Public competition scores remain visible. Canonical team links are live
// visibility decisions, not irrevocable permissions copied into old snapshots.
async function filterPublicTeams(entries, field = 'canonicalTeamId') {
  const ids = [...new Set(entries.map(entry => toId(entry[field])).filter(Boolean))];
  const teams = ids.length ? await Team.find({
    _id: { $in: ids }, isActive: true, privacy: 'public'
  }).select('_id').lean() : [];
  const visible = new Set(teams.map(toId));
  return entries.map(entry => ({
    ...entry,
    [field]: visible.has(toId(entry[field])) ? entry[field] : null,
    // Registration proofs and saved game IDs are not public roster consent.
    ...(Object.hasOwn(entry, 'rosterSnapshot') ? { rosterSnapshot: [] } : {})
  }));
}

module.exports = { filterPublicTeams };

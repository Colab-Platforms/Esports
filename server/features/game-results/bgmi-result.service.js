const mongoose = require('mongoose');
const BGMIMatch = require('../../models/BGMIMatch');
const Team = require('../../models/Team');
const Registration = require('../../models/TournamentRegistration');
const Leaderboard = require('../../models/BGMILeaderboard');
const { runResultMutation, runTournamentMutation, currentSession, inSession } = require('./result-transactions');
const { markTournamentFinalResultStale } = require('../tournament-final-results/tournament-final-results.service');
const { assertPositiveInteger, assertNonNegativeNumber, toId } = require('./game-results.utils');
const { validateRegistrationTeam } = require('./registration-team');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

async function eligibleTeam(match, teamId, actor, { manager = false } = {}) {
  if (!mongoose.isValidObjectId(teamId)) throw fail('Invalid team ID');
  const team = await inSession(Team.findOne({ _id: teamId, game: 'bgmi', isActive: true }));
  if (!team) throw fail('Active BGMI team not found', 404);
  if (!manager && toId(team.captain) !== toId(actor.id) &&
      !team.members.some(member => toId(member.userId) === toId(actor.id))) throw fail('Not a member of this team', 403);
  const registrations = await inSession(Registration.find({
    tournamentId: match.tournamentId, teamId, status: 'verified'
  })).select('userId teamId').lean();
  if (!registrations.length) throw fail('Team has no verified tournament registration', 409);
  if (registrations.length !== 1) throw fail('Ambiguous verified team registrations; review before submitting results', 409);
  await validateRegistrationTeam(registrations[0], 'bgmi');
  return team;
}

// Rebuild the legacy projection rather than incrementing it on each verify.
// Re-verification is idempotent and edits remove previously verified scores.
async function rebuildLeaderboard(tournamentId, teamId) {
  const matches = await inSession(BGMIMatch.find({ tournamentId, status: { $ne: 'cancelled' } })).lean();
  const rows = matches.flatMap(match => (match.teamResults || [])
    .filter(row => toId(row.teamId) === toId(teamId) && row.verified)
    .map(row => ({ matchId: match._id, matchNumber: match.matchNumber, placement: row.placement,
      kills: row.kills, points: row.points, playedAt: row.verifiedAt, teamName: row.teamName })));
  if (!rows.length) {
    await Leaderboard.deleteOne({ tournamentId, teamId }, { session: currentSession() });
  } else {
    await Leaderboard.findOneAndUpdate({ tournamentId, teamId }, { $set: {
    teamName: rows[0].teamName, totalPoints: rows.reduce((n, row) => n + row.points, 0),
    totalKills: rows.reduce((n, row) => n + row.kills, 0), matchesPlayed: rows.length,
    bestPlacement: Math.min(...rows.map(row => row.placement)), highestKills: Math.max(...rows.map(row => row.kills)),
    matchHistory: rows, lastUpdated: new Date()
    } }, { upsert: true, runValidators: true, session: currentSession() });
  }
  const entries = await inSession(Leaderboard.find({ tournamentId }).sort({ totalPoints: -1, _id: 1 })).lean();
  for (let index = 0; index < entries.length; index += 1) {
    await Leaderboard.updateOne({ _id: entries[index]._id }, { $set: {
      previousRank: entries[index].currentRank || 0, currentRank: index + 1
    } }, { session: currentSession() });
  }
}

async function mutateResult({ matchId, teamId, actor, payload = {}, screenshot, verify = false }) {
  if (verify && actor.role !== 'admin') throw fail('Only admins can verify results', 403);
  return runResultMutation(BGMIMatch, matchId, async () => {
    const match = await inSession(BGMIMatch.findById(matchId));
    if (!match || match.status === 'cancelled') throw fail('Match unavailable', 409);
    const team = await eligibleTeam(match, teamId, actor, { manager: verify });
    let row = match.teamResults.find(entry => toId(entry.teamId) === toId(teamId));
    if (verify && !row) throw fail('Team result not found', 404);
    if (!row) {
      match.teamResults.push({ teamId, teamName: team.name });
      row = match.teamResults[match.teamResults.length - 1];
    }
    if (verify) {
      assertPositiveInteger(row.placement, 'placement', { required: true });
      const kills = assertNonNegativeNumber(row.kills, 'kills', { required: true });
      if (!Number.isInteger(kills)) throw fail('Kills must be an integer');
      row.points = match.calculatePoints(row.placement, kills);
      row.verified = true;
      row.verifiedBy = actor.id;
      row.verifiedAt = new Date();
    } else {
      if (screenshot) row.screenshots.push(screenshot);
      else {
        row.placement = assertPositiveInteger(payload.placement, 'placement', { required: true });
        row.kills = assertNonNegativeNumber(payload.kills, 'kills', { required: true });
        if (!Number.isInteger(row.kills)) throw fail('Kills must be an integer');
        row.points = match.calculatePoints(row.placement, row.kills);
      }
      row.teamName = team.name;
      row.submittedAt = new Date();
      row.verified = false;
      row.verifiedBy = undefined;
      row.verifiedAt = undefined;
    }
    await match.save({ session: currentSession() });
    await rebuildLeaderboard(match.tournamentId, teamId);
    await markTournamentFinalResultStale(match.tournamentId);
    return { points: row.points, tournamentId: match.tournamentId };
  });
}

async function createMatch(payload) {
  return runTournamentMutation(payload.tournamentId, async () => {
    // Results and verification are entered through the guarded result routes.
    const { tournamentId, matchNumber, map, roomId, roomPassword, scheduledTime, status } = payload;
    const match = await new BGMIMatch({ tournamentId, matchNumber: assertPositiveInteger(matchNumber, 'matchNumber', { required: true }),
      map, roomId, roomPassword, scheduledTime, status }).save({ session: currentSession() });
    await markTournamentFinalResultStale(tournamentId);
    return match;
  });
}

module.exports = { mutateResult, createMatch };

const { AsyncLocalStorage } = require('node:async_hooks');
const mongoose = require('mongoose');
const Tournament = require('../../models/Tournament');

const context = new AsyncLocalStorage();
const currentSession = () => context.getStore()?.session || null;
const inSession = query => currentSession() ? query.session(currentSession()) : query;
const failure = (message, status = 409) => Object.assign(new Error(message), { status });

// Every competitive result write takes this lock before reading its source.
// MongoDB retries conflicting transactions with a fresh snapshot. Both the
// source mutation and final-result invalidation commit or roll back together.
async function runTournamentMutation(tournamentId, action) {
  if (context.getStore()) {
    if (String(context.getStore().tournamentId) !== String(tournamentId)) throw failure('Cross-tournament result mutation');
    return action();
  }
  if (!mongoose.isValidObjectId(tournamentId)) throw failure('Invalid tournament ID', 400);
  let value;
  await mongoose.connection.transaction(async session => {
    const tournament = await Tournament.findOneAndUpdate(
      { _id: tournamentId }, { $inc: { resultRevision: 1 } }, { session, new: true }
    );
    if (!tournament) throw failure('Tournament not found', 404);
    value = await context.run({ session, tournamentId }, action);
  }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  return value;
}

async function runResultMutation(Model, resultId, action) {
  if (!mongoose.isValidObjectId(resultId)) throw failure('Invalid result ID', 400);
  const result = await Model.findById(resultId).select('tournamentId').lean();
  if (!result) throw failure('Result not found', 404);
  return runTournamentMutation(result.tournamentId, action);
}

module.exports = { currentSession, inSession, runTournamentMutation, runResultMutation };

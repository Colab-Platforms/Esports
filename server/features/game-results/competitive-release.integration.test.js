const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Tournament = require('../../models/Tournament');
const Registration = require('../../models/TournamentRegistration');
const User = require('../../models/User');
const Team = require('../../models/Team');
const Match = require('../../models/BGMIMatch');
const Leaderboard = require('../../models/BGMILeaderboard');
const FF = require('../freefire-results/freefire-match-result.model');
const Valorant = require('../valorant-results/valorant-match-result.model');
const Final = require('../tournament-final-results/tournament-final-result.model');
const ff = require('../freefire-results/freefire-results.service');
const valorant = require('../valorant-results/valorant-results.service');
const finals = require('../tournament-final-results/tournament-final-results.service');
const bgmi = require('./bgmi-result.service');
const { runTournamentMutation } = require('./result-transactions');
const { getPlayerCompetitiveProfile } = require('../player-competitive-profile/player-competitive-profile.service');
const { getTeamCompetitiveProfile } = require('../team-competitive-profile/team-competitive-profile.service');
const { getPlayerStatistics } = require('../statistics/statistics.service');

let replset, server, base;
const id = () => new mongoose.Types.ObjectId();
const actor = id();
const secret = 'isolated-competitive-release-tests-only';

test.before(async () => {
  // Never accept a URI from an existing environment, including development.
  replset = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replset.getUri('competitive_release_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false });
  // Create additive indexes only in this freshly allocated disposable database.
  for (const Model of [FF, Valorant, Final, Leaderboard, Match]) await Model.createIndexes();
  // Reproduce the legacy index only in this new loopback disposable database.
  await Registration.collection.createIndex({ tournamentId: 1, userId: 1 });
  process.env.JWT_SECRET = secret;
  process.env.REDIS_DISABLED = 'true';
  const app = express();
  app.use(express.json());
  app.use('/api/bgmi-registration', require('../../routes/bgmiRegistration'));
  app.use('/api/freefire-registration', require('../../routes/freeFireRegistration'));
  app.use('/api/bgmi-matches', require('../../routes/bgmiMatches'));
  app.use('/api/freefire-results', require('../freefire-results/freefire-results.routes'));
  app.use('/api/valorant-results', require('../valorant-results/valorant-results.routes'));
  app.use('/api', require('../tournament-final-results/tournament-final-results.routes'));
  app.use('/api/players', require('../player-competitive-profile/player-competitive-profile.routes'));
  app.use('/api/players', require('../competitive-history/competitive-history.routes'));
  app.use('/api/teams', require('../team-competitive-profile/team-competitive-profile.routes'));
  app.use('/api', require('../statistics/statistics.routes'));
  app.use('/api/leaderboards', require('../leaderboards/leaderboards.routes'));
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replset) await replset.stop();
});

test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'competitive_release_disposable');
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  await User.collection.insertOne({ _id: actor, username: 'release-admin', email: 'admin@example.com', role: 'admin', isActive: true, profileVisibility: 'public' });
});

// Raw inserts deliberately represent pre-existing production document shapes.
async function fixture(game = 'freefire', { linked = true } = {}) {
  const tournamentId = id(), userId = id(), teamId = id(), registrationId = id();
  await Tournament.collection.insertOne({ _id: tournamentId, name: 'Release Test Cup', gameType: game, status: 'completed', scoreboards: [], resultRevision: 0 });
  await User.collection.insertOne({ _id: userId, username: `player-${userId}`, email: `${userId}@example.com`, isActive: true,
    profileVisibility: 'public', gameIds: { bgmi: { uid: '12345678' }, freefire: { uid: '87654321' }, valorant: 'Player#TEST' }, steamProfile: { isConnected: false } });
  await Team.collection.insertOne({ _id: teamId, name: 'Release Team', game, captain: userId,
    members: [{ userId, role: 'captain' }], isActive: true, privacy: 'public', createdAt: new Date() });
  await Registration.collection.insertOne({ _id: registrationId, tournamentId, userId, teamName: 'Release Team',
    ...(linked ? { teamId } : {}), status: 'verified', registeredAt: new Date(),
    teamLeader: { name: 'Captain', bgmiId: '12345678', freeFireId: '87654321' }, teamMembers: [],
    ...(game === 'valorant' ? { roster: [{ userId, username: 'Captain', riotId: 'Player#TEST', role: 'captain' }] } : {}) });
  return { tournamentId, userId, teamId, registrationId };
}

const ffPayload = (f, overrides = {}) => ({ tournamentId: f.tournamentId, lobbyNumber: 1, matchNumber: 1,
  status: 'verified', teamResults: [{ registrationId: f.registrationId, placement: 1, kills: 4, placementPoints: 12, killPoints: 4 }], ...overrides });
const request = (route, userId, { method = 'GET', body } = {}) => fetch(base + route, {
  method, headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${jwt.sign({ userId }, secret)}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});

test('legacy non-unique registrations preserve rejected history and ad-hoc result snapshots', async () => {
  const f = await fixture('freefire', { linked: false });
  const rejectedId = id();
  await Registration.collection.insertOne({ _id: rejectedId, tournamentId: f.tournamentId, userId: f.userId, status: 'rejected', teamName: 'Earlier Attempt' });
  const before = await Registration.collection.find({ tournamentId: f.tournamentId }).sort({ _id: 1 }).toArray();
  await assert.rejects(ff.createFreeFireResult({ payload: ffPayload({ ...f, registrationId: rejectedId }), actorId: actor }), /Only verified registrations/);
  const result = await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  assert.equal(result.teamResults[0].canonicalTeamId, null);
  await Registration.collection.updateOne({ _id: f.registrationId }, { $set: { status: 'rejected' } });
  const final = await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  assert.equal(final.standings.length, 1);
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor, payload: {
    standings: [{ rank: 1, registrationId: rejectedId }]
  } }), /verified registrations/);
  const after = await Registration.collection.find({ tournamentId: f.tournamentId }).sort({ _id: 1 }).toArray();
  assert.deepEqual(after, before.map(record => record._id.equals(f.registrationId) ? { ...record, status: 'rejected' } : record));
});

test('Free Fire duplicate-owner entrants are rejected without writes even under concurrency', async () => {
  const f = await fixture('freefire', { linked: false });
  const duplicate = id();
  await Registration.collection.insertOne({ _id: duplicate, tournamentId: f.tournamentId, userId: f.userId, status: 'verified', teamName: 'Second Attempt' });
  const payload = ffPayload(f);
  payload.teamResults.push({ ...payload.teamResults[0], registrationId: duplicate, placement: 2 });
  const before = await Registration.collection.find({}).toArray();
  const outcomes = await Promise.allSettled(Array.from({ length: 3 }, () => ff.createFreeFireResult({ payload, actorId: actor })));
  assert.ok(outcomes.every(outcome => outcome.status === 'rejected' && outcome.reason.code === 'AMBIGUOUS_RESULT_ENTRANT'));
  assert.equal((await request('/api/freefire-results', actor, { method: 'POST', body: payload })).status, 409);
  assert.equal(await FF.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, 0);
  assert.deepEqual(await Registration.collection.find({}).toArray(), before);
});

test('Valorant cannot pit two attempts by the same owner against one another', async () => {
  const f = await fixture('valorant', { linked: false });
  const duplicate = id();
  await Registration.collection.insertOne({ _id: duplicate, tournamentId: f.tournamentId, userId: f.userId, status: 'verified', teamName: 'Second Attempt' });
  await assert.rejects(valorant.createValorantResult({ actorId: actor, payload: {
    tournamentId: f.tournamentId, matchNumber: 1, status: 'verified',
    teamA: { registrationId: f.registrationId, score: 13 }, teamB: { registrationId: duplicate, score: 4 }
  } }), /Duplicate registration owner/);
  assert.equal(await Valorant.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, 0);
});

test('final publication rejects duplicate owners across matches and rolls back without replacing a final', async () => {
  const f = await fixture('freefire', { linked: false });
  await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  const duplicate = id();
  await Registration.collection.insertOne({ _id: duplicate, tournamentId: f.tournamentId, userId: f.userId, status: 'verified', teamName: 'Second Attempt' });
  await ff.createFreeFireResult({ payload: ffPayload({ ...f, registrationId: duplicate }, { matchNumber: 2 }), actorId: actor });
  const before = await Final.collection.findOne({ tournamentId: f.tournamentId });
  const revision = (await Tournament.findById(f.tournamentId)).resultRevision;
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor }), /Duplicate registration owner/);
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor, payload: {
    standings: [{ rank: 1, registrationId: f.registrationId }, { rank: 2, registrationId: duplicate }]
  } }), /Duplicate registration owner/);
  assert.deepEqual(await Final.collection.findOne({ tournamentId: f.tournamentId }), before);
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, revision);
});

test('finals reject legacy canonical-team merging and missing or cross-tournament registration references', async () => {
  const f = await fixture();
  const created = await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  const duplicate = id();
  await Team.updateOne({ _id: f.teamId }, { $push: { members: { userId: actor, role: 'member' } } });
  await Registration.collection.insertOne({ _id: duplicate, tournamentId: f.tournamentId, userId: actor, teamId: f.teamId, status: 'verified' });
  const row = (await FF.collection.findOne({ _id: created._id })).teamResults[0];
  await FF.collection.insertOne({ tournamentId: f.tournamentId, matchNumber: 2, lobbyNumber: 1, status: 'verified', teamResults: [{ ...row, registrationId: duplicate }] });
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor }), /Duplicate canonical team/);
  await Registration.collection.updateOne({ _id: duplicate }, { $set: { tournamentId: id() } });
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor }), /missing or belongs to another tournament/);
  assert.equal(await Final.countDocuments(), 0);
});

test('BGMI verified registrations require a current owner/team relationship and unambiguous identity', async () => {
  const f = await fixture('bgmi');
  const match = await bgmi.createMatch({ tournamentId: f.tournamentId, matchNumber: 1 });
  await Registration.collection.updateOne({ _id: f.registrationId }, { $set: { userId: actor } });
  await assert.rejects(bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, payload: { placement: 1, kills: 2 } }), /invalid or unauthorized team link/);
  await Registration.collection.updateOne({ _id: f.registrationId }, { $set: { userId: f.userId } });
  await Registration.collection.insertOne({ _id: id(), tournamentId: f.tournamentId, userId: f.userId, teamId: f.teamId, status: 'verified' });
  await assert.rejects(bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, payload: { placement: 1, kills: 2 } }), /Ambiguous verified team registrations/);
  assert.equal((await Match.findById(match._id)).teamResults.length, 0);
});

test('repeated matches for the same ad-hoc entrant aggregate without changing registration history', async () => {
  const f = await fixture('freefire', { linked: false });
  const before = await Registration.collection.findOne({ _id: f.registrationId });
  await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  await ff.createFreeFireResult({ payload: ffPayload(f, { matchNumber: 2 }), actorId: actor });
  const final = await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  assert.equal(final.standings.length, 1);
  assert.equal(final.standings[0].matchesPlayed, 2);
  assert.deepEqual(await Registration.collection.findOne({ _id: f.registrationId }), before);
});

test('Valorant final validation rejects duplicate owners across otherwise valid matches', async () => {
  const f = await fixture('valorant', { linked: false });
  const other = id(), duplicate = id();
  await Registration.collection.insertMany([
    { _id: other, tournamentId: f.tournamentId, userId: actor, status: 'verified', teamName: 'Opponent' },
    { _id: duplicate, tournamentId: f.tournamentId, userId: f.userId, status: 'verified', teamName: 'Duplicate' }
  ]);
  for (const [index, registrationId] of [f.registrationId, duplicate].entries()) {
    await valorant.createValorantResult({ actorId: actor, payload: {
      tournamentId: f.tournamentId, matchNumber: index + 1, status: 'verified',
      teamA: { registrationId, score: 13 }, teamB: { registrationId: other, score: 4 }
    } });
  }
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor }), /Duplicate registration owner/);
  assert.equal(await Final.countDocuments(), 0);
});

test('missing owners and invalid canonical ownership fail closed without manufacturing team links', async () => {
  const f = await fixture();
  await Registration.collection.updateOne({ _id: f.registrationId }, { $unset: { userId: '' } });
  await assert.rejects(ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor }), /owner is missing/);
  await Registration.collection.updateOne({ _id: f.registrationId }, { $set: { userId: actor } });
  await assert.rejects(ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor }), /invalid or unauthorized team link/);
  await Registration.collection.updateOne({ _id: f.registrationId }, { $set: { userId: f.userId }, $unset: { teamId: '' } });
  const payload = ffPayload(f);
  payload.teamResults[0].canonicalTeamId = f.teamId;
  const result = await ff.createFreeFireResult({ payload, actorId: actor });
  assert.equal(result.teamResults[0].canonicalTeamId, null);
  assert.equal((await Registration.collection.findOne({ _id: f.registrationId })).teamId, undefined);
});

test('publication rejects duplicate rows in historical BGMI matches and Free Fire lobbies', async () => {
  const f = await fixture('bgmi');
  await Match.collection.insertOne({ tournamentId: f.tournamentId, status: 'completed', matchNumber: 1,
    teamResults: [1, 2].map(() => ({ teamId: f.teamId, teamName: 'Legacy', verified: true, points: 5, kills: 1, placement: 1 })) });
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor }), /Duplicate team in a historical BGMI match/);
  const ffFixture = await fixture();
  const created = await ff.createFreeFireResult({ payload: ffPayload(ffFixture), actorId: actor });
  const stored = await FF.collection.findOne({ _id: created._id });
  await FF.collection.updateOne({ _id: created._id }, { $push: { teamResults: stored.teamResults[0] } });
  await assert.rejects(finals.publishFinalResult({ tournamentId: ffFixture.tournamentId, actorId: actor }), /Duplicate registration in a historical Free Fire lobby/);
  assert.equal(await Final.countDocuments(), 0);
});

test('real legacy registration records do not inflate statistics or expose rejected/orphaned participation', async () => {
  const f = await fixture('freefire', { linked: false });
  await Registration.collection.insertMany([
    { _id: id(), tournamentId: f.tournamentId, userId: f.userId, status: 'pending', registeredAt: new Date() },
    { _id: id(), tournamentId: f.tournamentId, userId: f.userId, status: 'rejected', registeredAt: new Date() },
    { _id: id(), tournamentId: id(), userId: f.userId, status: 'verified', registeredAt: new Date() }
  ]);
  const before = await Registration.collection.find({ userId: f.userId }).toArray();
  const stats = await getPlayerStatistics(`player-${f.userId}`);
  assert.equal(stats.overview.tournamentsJoined, 1);
  assert.equal(stats.overview.completedTournaments, 1);
  assert.equal(stats.participationHistory.length, 1);
  assert.equal(stats.participationHistory[0].tournamentId, String(f.tournamentId));
  assert.notEqual(stats.participationHistory[0].status, 'rejected');
  assert.deepEqual(await Registration.collection.find({ userId: f.userId }).toArray(), before);
});

test('removed self-elevation routes cannot promote an ordinary account', async () => {
  const f = await fixture();
  for (const game of ['bgmi', 'freefire']) {
    const response = await request(`/api/${game}-registration/make-admin`, f.userId, { method: 'POST' });
    assert.equal(response.status, 404);
  }
  assert.notEqual((await User.findById(f.userId)).role, 'admin');
});

test('result management requires authentication and a current admin/moderator role', async () => {
  const f = await fixture();
  for (const route of ['/api/freefire-results', '/api/valorant-results', `/api/admin/tournaments/${f.tournamentId}/final-results/publish`]) {
    assert.equal((await request(route, null, { method: 'POST', body: {} })).status, 401);
    assert.equal((await request(route, f.userId, { method: 'POST', body: {} })).status, 403);
  }
  assert.equal((await request(`/api/admin/tournaments/${f.tournamentId}/result-registrations`, f.userId)).status, 403);
});

test('unique Free Fire match index rejects concurrent duplicate writes and rolls back the losing lock', async () => {
  const f = await fixture();
  const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor })));
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(await FF.countDocuments(), 1);
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, 1);
  assert.ok(outcomes.filter(outcome => outcome.status === 'rejected').every(outcome => outcome.reason.code === 11000));
});

test('a failed transaction rolls back the source, final invalidation and revision together', async () => {
  const f = await fixture();
  await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  const before = (await Tournament.findById(f.tournamentId)).resultRevision;
  await assert.rejects(runTournamentMutation(f.tournamentId, async () => {
    await ff.createFreeFireResult({ payload: ffPayload(f, { matchNumber: 2 }), actorId: actor });
    throw new Error('Injected failure after source and stale writes');
  }), /Injected failure/);
  assert.equal(await FF.countDocuments(), 1);
  assert.equal((await Final.findOne()).status, 'published');
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, before);
});

test('publication waits for a concurrent edit/verification transaction and publishes its new snapshot', async () => {
  const f = await fixture();
  const result = await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  let entered, release;
  const ready = new Promise(resolve => { entered = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  const edit = runTournamentMutation(f.tournamentId, async () => {
    await ff.updateFreeFireResult({ resultId: result._id, payload: { teamResults: [{ registrationId: f.registrationId, placement: 1, kills: 9, placementPoints: 12, killPoints: 9 }] }, actorId: actor });
    await ff.verifyFreeFireResult({ resultId: result._id, actorId: actor });
    entered();
    await hold;
  });
  await ready;
  const publish = finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  release();
  await edit;
  const published = await publish;
  assert.equal(published.standings[0].totalPoints, 21);
  assert.equal((await Final.findOne()).status, 'published');
});

test('editing and publication race cannot leave an old result marked current', async () => {
  const f = await fixture();
  const result = await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  const outcomes = await Promise.allSettled([
    finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor }),
    ff.updateFreeFireResult({ resultId: result._id, payload: { map: 'Updated' }, actorId: actor })
  ]);
  assert.equal(outcomes[1].status, 'fulfilled');
  assert.equal((await FF.findById(result._id)).status, 'draft');
  assert.equal((await Final.findOne()).status, 'needs_republish');
});

test('concurrent void and verify never resurrect a void Free Fire result', async () => {
  const f = await fixture();
  const result = await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  await Promise.allSettled([ff.voidFreeFireResult({ resultId: result._id, actorId: actor }), ff.verifyFreeFireResult({ resultId: result._id, actorId: actor })]);
  assert.equal((await FF.findById(result._id)).status, 'void');
  await assert.rejects(ff.verifyFreeFireResult({ resultId: result._id, actorId: actor }), /Void results/);
  await assert.rejects(ff.updateFreeFireResult({ resultId: result._id, payload: {}, actorId: actor }), /Void results/);
});

test('forged, wrong-game and inactive canonical team links fail without writes', async () => {
  const f = await fixture();
  for (const patch of [{ captain: actor, members: [] }, { game: 'bgmi' }, { isActive: false }]) {
    const original = await Team.findById(f.teamId).lean();
    await Team.collection.updateOne({ _id: f.teamId }, { $set: patch });
    await assert.rejects(ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor }), /team link/);
    await Team.collection.replaceOne({ _id: f.teamId }, original);
  }
  assert.equal(await FF.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, 0);
});

test('legacy ad-hoc registrations remain publishable without a canonical team', async () => {
  const f = await fixture('freefire', { linked: false });
  const result = await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  assert.equal(result.teamResults[0].canonicalTeamId, null);
  await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  const publicResult = await finals.getPublicFinalResult({ tournamentId: f.tournamentId });
  assert.equal(publicResult.standings[0].canonicalTeamId, null);
  assert.equal(publicResult.standings[0].totalPoints, 16);
});

test('public results omit roster identifiers and honor team privacy changes after publication', async () => {
  const f = await fixture();
  await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  await Team.updateOne({ _id: f.teamId }, { $set: { privacy: 'private' } });
  const publicResult = await finals.getPublicFinalResult({ tournamentId: f.tournamentId });
  assert.deepEqual(publicResult.standings[0].rosterSnapshot, []);
  assert.equal(publicResult.winner.canonicalTeamId, null);
  const directory = await finals.getResultsDirectory({ gameType: 'freefire' });
  assert.equal(directory.tournaments[0].topStandings[0].canonicalTeamId, null);
  assert.equal((await ff.getFreeFireTournamentResults({ tournamentId: f.tournamentId }))[0].teamResults[0].canonicalTeamId, null);
  await assert.rejects(getTeamCompetitiveProfile(String(f.teamId)), /Team not found/);
});

test('existing public users need no Identity collection and private profiles stay hidden', async () => {
  const f = await fixture();
  const user = await User.findById(f.userId);
  const profile = await getPlayerCompetitiveProfile(user.username);
  assert.equal(profile.player.username, user.username);
  assert.ok(!mongoose.modelNames().includes('Identity'));
  await User.updateOne({ _id: f.userId }, { $set: { profileVisibility: 'private' } });
  await assert.rejects(getPlayerCompetitiveProfile(user.username), /Player not found/);
  assert.equal((await request(`/api/players/${user.username}/competitive-history`)).status, 404);
  assert.equal((await request(`/api/players/${user.username}/statistics`)).status, 404);
});

test('BGMI submission rejects another team and edits clear verification and legacy totals', async () => {
  const f = await fixture('bgmi');
  const match = await bgmi.createMatch({ tournamentId: f.tournamentId, matchNumber: 1, status: 'completed' });
  const payload = { placement: 1, kills: 5 };
  const response = await request(`/api/bgmi-matches/${match._id}/submit-result`, actor, { method: 'POST', body: { teamId: f.teamId, ...payload } });
  assert.equal(response.status, 403);
  assert.equal((await Match.findById(match._id)).teamResults.length, 0);
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, payload });
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: actor, role: 'admin' }, verify: true });
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: actor, role: 'admin' }, verify: true });
  assert.equal((await Leaderboard.findOne()).matchesPlayed, 1);
  await finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor });
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, payload: { placement: 2, kills: 1 } });
  assert.equal((await Match.findById(match._id)).teamResults[0].verified, false);
  assert.equal(await Leaderboard.countDocuments(), 0);
  assert.equal((await Final.findOne()).status, 'needs_republish');
  await assert.rejects(bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, payload: { placement: 0, kills: -1 } }), /positive integer/);
});

test('Valorant preserves roster snapshots and has safe verify/void transitions and match uniqueness', async () => {
  const f = await fixture('valorant');
  const secondId = id();
  await Registration.collection.insertOne({ _id: secondId, tournamentId: f.tournamentId, userId: actor,
    teamName: 'Opponent', status: 'verified', roster: [{ userId: actor, username: 'Opponent', riotId: 'Other#TEST' }] });
  const payload = { tournamentId: f.tournamentId, matchNumber: 1, status: 'verified',
    teamA: { registrationId: f.registrationId, score: 13 }, teamB: { registrationId: secondId, score: 4 } };
  const created = await valorant.createValorantResult({ payload, actorId: actor });
  assert.equal(created.teamA.rosterSnapshot[0].gameId, 'Player#TEST');
  const duplicates = await Promise.allSettled([valorant.createValorantResult({ payload, actorId: actor }), valorant.createValorantResult({ payload, actorId: actor })]);
  assert.ok(duplicates.every(outcome => outcome.status === 'rejected' && outcome.reason.code === 11000));
  assert.equal(await Valorant.countDocuments(), 1);
  await Promise.allSettled([valorant.voidValorantResult({ resultId: created._id, actorId: actor }), valorant.verifyValorantResult({ resultId: created._id, actorId: actor })]);
  assert.equal((await Valorant.findById(created._id)).status, 'void');
  await assert.rejects(valorant.verifyValorantResult({ resultId: created._id, actorId: actor }), /Void results/);
});

test('final-result uniqueness survives simultaneous publication', async () => {
  const f = await fixture();
  await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  await Promise.all(Array.from({ length: 5 }, () => finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor })));
  assert.equal(await Final.countDocuments(), 1);
  assert.ok((await Final.collection.indexes()).some(index => index.unique && index.key.tournamentId === 1));
  const legacyIndex = (await Registration.collection.indexes()).find(index => index.key.tournamentId === 1 && index.key.userId === 1);
  assert.ok(legacyIndex && !legacyIndex.unique && !legacyIndex.partialFilterExpression);
});

test('legacy tournaments without a revision field acquire it additively', async () => {
  const f = await fixture();
  await Tournament.collection.updateOne({ _id: f.tournamentId }, { $unset: { resultRevision: '' } });
  const before = await Registration.collection.findOne({ _id: f.registrationId });
  await ff.createFreeFireResult({ payload: ffPayload(f), actorId: actor });
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, 1);
  assert.deepEqual(await Registration.collection.findOne({ _id: f.registrationId }), before);
});

test('public team roster omits members whose player profiles are private', async () => {
  const f = await fixture();
  await User.updateOne({ _id: f.userId }, { $set: { profileVisibility: 'private' } });
  const profile = await getTeamCompetitiveProfile(String(f.teamId));
  assert.deepEqual(profile.roster, []);
  assert.equal(profile.captain, null);
});

test('fractional kills and forged totals roll back without creating a result', async () => {
  const f = await fixture();
  for (const patch of [{ kills: 1.5 }, { totalPoints: 999 }]) {
    const payload = ffPayload(f);
    Object.assign(payload.teamResults[0], patch);
    await assert.rejects(ff.createFreeFireResult({ payload, actorId: actor }), /integer|must equal/);
  }
  assert.equal(await FF.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, 0);
});

test('BGMI screenshot edits invalidate verification with the same ownership boundary', async () => {
  const f = await fixture('bgmi');
  const match = await bgmi.createMatch({ tournamentId: f.tournamentId, matchNumber: 1, status: 'completed' });
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, payload: { placement: 1, kills: 2 } });
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: actor, role: 'admin' }, verify: true });
  const screenshot = { url: '/uploads/bgmi-screenshots/synthetic.png', uploadedBy: f.userId, uploadedAt: new Date() };
  await assert.rejects(bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: actor }, screenshot }), /Not a member/);
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, screenshot });
  const saved = await Match.findById(match._id);
  assert.equal(saved.teamResults[0].verified, false);
  assert.equal(saved.teamResults[0].screenshots.length, 1);
  assert.equal(await Leaderboard.countDocuments(), 0);
});

test('public BGMI match reads omit room credentials, proofs and private canonical links', async () => {
  const f = await fixture('bgmi');
  const match = await bgmi.createMatch({ tournamentId: f.tournamentId, matchNumber: 1, status: 'completed', roomPassword: 'private-room-password' });
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: f.userId }, payload: { placement: 1, kills: 2 } });
  const draftResponse = await (await request(`/api/bgmi-matches/${match._id}`)).json();
  assert.deepEqual(draftResponse.data.match.teamResults, []);
  await bgmi.mutateResult({ matchId: match._id, teamId: f.teamId, actor: { id: actor, role: 'admin' }, verify: true });
  await Team.updateOne({ _id: f.teamId }, { $set: { privacy: 'private' } });
  const response = await (await request(`/api/bgmi-matches/${match._id}`)).json();
  assert.equal(response.data.match.roomPassword, undefined);
  assert.equal(response.data.match.teamResults[0].teamId, null);
  assert.equal(response.data.match.teamResults[0].screenshots, undefined);
  assert.equal(response.data.match.teamResults[0].verifiedBy, undefined);
});

test('duplicate results return HTTP 409 through the actual manager route', async () => {
  const f = await fixture();
  const body = ffPayload(f);
  assert.equal((await request('/api/freefire-results', actor, { method: 'POST', body })).status, 201);
  assert.equal((await request('/api/freefire-results', actor, { method: 'POST', body })).status, 409);
});

test('manual standings reject duplicate canonical teams even with different registrations', async () => {
  const f = await fixture();
  const other = id();
  await Team.updateOne({ _id: f.teamId }, { $push: { members: { userId: actor, role: 'member' } } });
  await Registration.collection.insertOne({ _id: other, tournamentId: f.tournamentId, userId: actor, teamId: f.teamId, teamName: 'Duplicate Team', status: 'verified' });
  await assert.rejects(finals.publishFinalResult({ tournamentId: f.tournamentId, actorId: actor, payload: {
    standings: [{ rank: 1, registrationId: f.registrationId }, { rank: 2, registrationId: other }]
  } }), /Duplicate canonical team/);
  assert.equal(await Final.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournamentId)).resultRevision, 0);
});

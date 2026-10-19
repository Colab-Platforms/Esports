const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
require('../game-results/test-support/local-startup.cjs');
const User = require('../../models/User');
const Team = require('../../models/Team');
const Tournament = require('../../models/Tournament');
const Registration = require('../../models/TournamentRegistration');
const Claim = require('./registration-claim.model');
const Result = require('../valorant-results/valorant-match-result.model');
const Final = require('../tournament-final-results/tournament-final-result.model');
const service = require('./registration.service');
const results = require('../valorant-results/valorant-results.service');
const { getPlayerStatistics } = require('../statistics/statistics.service');
const { getValorantHistory } = require('../competitive-history/adapters/valorant-history.adapter');
const { getTournamentHistory } = require('../competitive-history/adapters/tournament-history.adapter');
const { getPlayerCompetitiveProfile } = require('../player-competitive-profile/player-competitive-profile.service');
const { parseManualRiotId } = require('./roster');
let replica, server, base, actors, serial = 0;
const secret = 'disposable-valorant-registration-tests-only';
const token = user => jwt.sign({ userId: user._id }, secret);
const request = (path, method = 'GET', body, user) => fetch(base + path, { method,
  headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
async function fixture() {
  const n = ++serial;
  const users = await User.create(Array.from({ length: 6 }, (_, i) => ({
    username: `fiction-${n}-${i}`, email: `fiction-${n}-${i}@example.com`, authProvider: 'google',
    fullName: `Fiction Player ${i}`, ...(i === 0 ? { phone: `9${String(n).padStart(8, '0')}0` } : {}),
    gameIds: { valorant: `Player ${n} ${i}#TEST` }
  })));
  const team = await Team.create({ name: `Fiction Team ${n}`, game: 'valorant', captain: users[0]._id,
    maxMembers: 6, members: users.map((u, i) => ({ userId: u._id, role: i === 0 ? 'captain' : 'member', isSubstitute: i === 5 })) });
  const tournament = await Tournament.create({ name: `Fiction Cup ${n}`, gameType: 'valorant', mode: 'team',
    prizePool: 0, maxParticipants: 2, status: 'registration_open', registrationDeadline: new Date(Date.now() + 3600000), createdBy: actors.admin._id });
  return { users, team, tournament, args: { tournamentId: tournament._id, teamId: team._id, userId: users[0]._id } };
}
test.before(async () => {
  process.env.JWT_SECRET = secret; process.env.REDIS_DISABLED = 'true';
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('valorant_registration_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false });
  for (const Model of [User, Team, Tournament, Registration, Claim, Result, Final]) await Model.createCollection();
  await Claim.createIndexes(); await Result.createIndexes(); await Final.createIndexes();
  await Registration.collection.createIndex({ tournamentId: 1, userId: 1 });
  for (const [fields, opts] of Registration.schema.indexes().filter(([, opts]) => opts.name?.includes('registration_owner'))) await Registration.collection.createIndex(fields, opts);
  await Registration.collection.createIndex({ 'roster.userId': 1, status: 1 }, { name: 'valorant_roster_user_status' });
  const app = express(); app.use(express.json());
  app.use('/api/valorant-registration', require('./registration.routes'));
  app.use('/api/auth', require('../../routes/auth'));
  app.use('/api/tournaments', require('../../routes/tournaments'));
  app.use('/api/bgmi-registration', require('../../routes/bgmiRegistration'));
  app.use('/api/freefire-registration', require('../../routes/freeFireRegistration'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'valorant_registration_disposable');
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  actors = {};
  for (const role of ['admin', 'moderator', 'designer', 'user']) actors[role] = await User.create({
    username: `actor-${role}`, fullName: `Fiction ${role}`, email: `${role}@example.com`, authProvider: 'google', role
  });
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (replica) await replica.stop();
});

test('Riot parser preserves display case and rejects unsafe or malformed identifiers', () => {
  assert.deepEqual(parseManualRiotId(' Player Name # TAG '), { name: 'Player Name', tag: 'TAG', display: 'Player Name#TAG', normalized: 'player name#tag' });
  for (const value of [null, {}, ['Name#Tag'], '', 'Name', '#Tag', 'Name#', 'Name#Tag#Other', 'Name\n#Tag', 'x'.repeat(31) + '#T']) {
    assert.throws(() => parseManualRiotId(value), { code: 'MALFORMED_RIOT_ID' });
  }
});

test('profile save, read, omit and clear preserve other IDs, ownership and privacy', async () => {
  const f = await fixture(); const own = f.users[0], other = f.users[1];
  await User.updateOne({ _id: own._id }, { $set: { 'gameIds.bgmi': { ign: 'Existing', uid: '123' }, 'gameIds.freefire': { ign: 'Existing FF', uid: '456' }, 'gameIds.steam': '76561198123456789', profileVisibility: 'private' } });
  const before = (await User.findById(own._id)).toObject();
  const url = '/api/auth/profile';
  assert.equal((await request(url, 'PUT', { gameIds: { valorant: 'Updated#TAG' } })).status, 401);
  assert.equal((await request(url, 'PUT', { userId: other._id, role: 'admin', gameIds: { valorant: ' Updated # TAG ' } }, own)).status, 200);
  let saved = await User.findById(own._id).lean();
  assert.equal(saved.gameIds.valorant, 'Updated#TAG');
  assert.deepEqual(saved.gameIds.bgmi, before.gameIds.bgmi); assert.deepEqual(saved.gameIds.freefire, before.gameIds.freefire);
  assert.equal(saved.gameIds.steam, before.gameIds.steam); assert.equal(saved.profileVisibility, 'private'); assert.equal(saved.role, 'user');
  assert.equal((await User.findById(other._id)).gameIds.valorant, other.gameIds.valorant);
  const read = await (await request(url, 'GET', undefined, own)).json(); assert.equal(read.data.user.gameIds.valorant, 'Updated#TAG');
  assert.equal((await request(url, 'PUT', { bio: 'Fictional bio' }, own)).status, 200);
  assert.equal((await User.findById(own._id)).gameIds.valorant, 'Updated#TAG');
  for (const value of [null, {}, ['Name#Tag'], 'invalid', 'Name\n#Tag']) assert.equal((await request(url, 'PUT', { gameIds: { valorant: value } }, own)).status, 400);
  assert.equal((await request(url, 'PUT', { gameIds: { valorant: '' } }, own)).status, 200);
  saved = await User.findById(own._id).lean(); assert.equal(saved.gameIds.valorant, ''); assert.equal(saved.profileVisibility, 'private');
});

test('registration builds the authoritative 5+1 roster and cannot trust client roster or IDs', async () => {
  const f = await fixture();
  const r = await request(`/api/valorant-registration/${f.tournament._id}/register`, 'POST', { teamId: f.team._id, roster: [], userId: actors.admin._id }, f.users[0]);
  assert.equal(r.status, 201); const body = await r.json(); const row = body.data.registration;
  assert.equal(row.roster.length, 6); assert.equal(row.teamMembers.length, 4); assert.equal(row.userId, String(f.users[0]._id));
  assert.equal(row.roster[0].riotId, f.users[0].gameIds.valorant); assert.equal(await Claim.countDocuments(), 13);
  const cup = await Tournament.findById(f.tournament._id); assert.equal(cup.currentParticipants, 1); assert.equal(cup.participants.length, 1);
  const publicRows = await (await request(`/api/valorant-registration/tournament/${cup._id}/teams`)).json();
  assert.deepEqual(Object.keys(publicRows.data.teams[0]).sort(), ['_id', 'registeredAt', 'status', 'teamName']);
});

test('registration authentication, captain ownership and staff role authorization', async () => {
  const f = await fixture(), path = `/api/valorant-registration/${f.tournament._id}/register`;
  assert.equal((await request(path, 'POST', { teamId: f.team._id })).status, 401);
  assert.equal((await request(path, 'POST', { teamId: f.team._id }, f.users[1])).status, 403);
  const row = await service.register(f.args);
  for (const role of ['user', 'designer']) {
    assert.equal((await request(`/api/valorant-registration/admin/tournament/${f.tournament._id}`, 'GET', undefined, actors[role])).status, 403);
    assert.equal((await request(`/api/valorant-registration/${row._id}/verify`, 'POST', {}, actors[role])).status, 403);
  }
  assert.equal((await request(`/api/valorant-registration/${row._id}/cancel`, 'POST', {}, f.users[1])).status, 403);
  assert.equal((await request(`/api/valorant-registration/${row._id}/verify`, 'POST', {}, actors.moderator)).status, 200);
  assert.equal((await request(`/api/valorant-registration/${row._id}/cancel`, 'POST', {}, f.users[0])).status, 409);
  assert.equal((await request(`/api/valorant-registration/${row._id}/reject`, 'POST', { reason: 'Late rejection' }, actors.admin)).status, 409);
});

test('missing IDs, duplicate Riot IDs, missing substitute and inactive users fail without writes', async () => {
  const f = await fixture();
  await User.updateOne({ _id: f.users[1]._id }, { $set: { 'gameIds.valorant': '' } });
  await assert.rejects(service.register(f.args), { code: 'MISSING_RIOT_ID' });
  await User.updateOne({ _id: f.users[1]._id }, { $set: { 'gameIds.valorant': f.users[0].gameIds.valorant.toLowerCase() } });
  await assert.rejects(service.register(f.args), { code: 'DUPLICATE_RIOT_ID' });
  await User.updateOne({ _id: f.users[1]._id }, { $set: { 'gameIds.valorant': 'Different#TAG', isActive: false } });
  await assert.rejects(service.register(f.args), { code: 'MISSING_USER' });
  await User.updateOne({ _id: f.users[1]._id }, { $set: { isActive: true } });
  await Team.updateOne({ _id: f.team._id }, { $pull: { members: { isSubstitute: true } } });
  await assert.rejects(service.register(f.args), { code: 'SUBSTITUTE_REQUIRED' });
  assert.equal(await Registration.countDocuments(), 0); assert.equal(await Claim.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0);
});

test('concurrent duplicate registrations commit once and keep claims/counters consistent', async () => {
  const f = await fixture();
  const attempts = await Promise.allSettled(Array.from({ length: 4 }, () => service.register(f.args)));
  assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
  assert.equal(await Registration.countDocuments(), 1); assert.equal(await Claim.countDocuments(), 13);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 1);
});

test('a second captain or duplicate roster member fails without changing capacity', async () => {
  const f = await fixture();
  await Team.updateOne({ _id: f.team._id }, { $set: { 'members.1.role': 'captain' } });
  await assert.rejects(service.register(f.args), { code: 'INVALID_VALORANT_ROSTER' });
  await Team.updateOne({ _id: f.team._id }, { $set: { 'members.1.role': 'member', 'members.1.userId': f.users[0]._id } });
  await assert.rejects(service.register(f.args), { code: 'DUPLICATE_ROSTER_USER' });
  assert.equal(await Registration.countDocuments(), 0); assert.equal(await Claim.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0);
});

test('different teams competing for the last slot cannot overbook', async () => {
  const a = await fixture(), b = await fixture(), c = await fixture();
  await service.register(a.args);
  const attempts = await Promise.allSettled([b, c].map(f => service.register({ ...f.args, tournamentId: a.tournament._id })));
  assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
  assert.equal(await Registration.countDocuments({ tournamentId: a.tournament._id }), 2);
  assert.equal((await Tournament.findById(a.tournament._id)).currentParticipants, 2);
  assert.equal(await Claim.countDocuments({ tournamentId: a.tournament._id }), 26);
});

test('overlapping platform users or case-insensitive Riot IDs cannot enter another roster', async () => {
  const a = await fixture(), b = await fixture(); await service.register(a.args);
  await Team.updateOne({ _id: b.team._id }, { $set: { 'members.1.userId': a.users[1]._id } });
  await assert.rejects(service.register({ ...b.args, tournamentId: a.tournament._id }), { code: 'REGISTRATION_CONFLICT' });
  await Team.updateOne({ _id: b.team._id }, { $set: { 'members.1.userId': b.users[1]._id } });
  await User.updateOne({ _id: b.users[1]._id }, { $set: { 'gameIds.valorant': a.users[1].gameIds.valorant.toLowerCase() } });
  await assert.rejects(service.register({ ...b.args, tournamentId: a.tournament._id }), { code: 'REGISTRATION_CONFLICT' });
});

test('claim conflict rolls back the capacity reservation, team revision and registration', async () => {
  const f = await fixture(); const version = f.team.__v;
  await Claim.create({ tournamentId: f.tournament._id, registrationId: new mongoose.Types.ObjectId(), type: 'team', value: String(f.team._id) });
  await assert.rejects(service.register(f.args), { code: 'REGISTRATION_CONFLICT' });
  assert.equal(await Registration.countDocuments(), 0); assert.equal(await Claim.countDocuments(), 1);
  const cup = await Tournament.findById(f.tournament._id); assert.equal(cup.currentParticipants, 0); assert.equal(cup.participants.length, 0);
  assert.equal(cup.resultRevision || 0, 0); assert.equal((await Team.findById(f.team._id)).__v, version);
});

test('missing claim index fails closed before any registration writes', async t => {
  const f = await fixture();
  t.mock.method(Claim.collection, 'listIndexes', () => ({ toArray: async () => [] }));
  await assert.rejects(service.register(f.args), { code: 'REGISTRATION_INDEX_REQUIRED' });
  assert.equal(await Registration.countDocuments(), 0); assert.equal(await Claim.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0);
});

test('Redis invalidation happens after a successful commit and never on a rejected registration', async t => {
  const f = await fixture(), redis = require('../../services/redisService');
  const transactions = require('../game-results/result-transactions');
  const deleted = t.mock.method(redis, 'delete', async key => {
    assert.equal(transactions.currentSession(), null);
    assert.equal(await Registration.countDocuments(), 1);
    assert.equal(key, `tournament:${f.tournament._id}`);
  });
  const patterns = t.mock.method(redis, 'deletePattern', async pattern => { assert.equal(pattern, 'tournaments:*'); });
  await service.register(f.args);
  await assert.rejects(service.register(f.args), { code: 'REGISTRATION_CONFLICT' });
  assert.equal(deleted.mock.callCount(), 1); assert.equal(patterns.mock.callCount(), 1);
  assert.equal(await mongoose.connection.collection('wallets').countDocuments(), 0);
  assert.equal(await mongoose.connection.collection('whatsappmessages').countDocuments(), 0);
});

test('rejection preserves history and re-registration succeeds with the non-unique legacy index', async () => {
  const f = await fixture(); const row = await service.register(f.args);
  await service.transition({ registrationId: row._id, actor: { userId: actors.admin._id, role: 'admin' }, action: 'reject', reason: 'Fictional review failure' });
  assert.equal(await Claim.countDocuments(), 0); assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0);
  const detail = await (await request(`/api/tournaments/${f.tournament._id}`, 'GET', undefined, f.users[0])).json();
  assert.equal(detail.data.isUserRegistered, false);
  const status = await (await request(`/api/tournaments/${f.tournament._id}/registration-status`, 'GET', undefined, f.users[0])).json();
  assert.equal(status.data.isRegistered, false);
  const next = await service.register(f.args); assert.notEqual(String(next._id), String(row._id));
  assert.equal((await Registration.findById(row._id)).status, 'rejected'); assert.equal(await Registration.countDocuments(), 2);
  assert.equal(await Claim.countDocuments(), 13);
});

test('concurrent cancellation and verification produce only one valid transition', async () => {
  const f = await fixture(), row = await service.register(f.args);
  const outcome = await Promise.allSettled([
    service.transition({ registrationId: row._id, actor: { userId: f.users[0]._id, role: 'user' }, action: 'cancel' }),
    service.transition({ registrationId: row._id, actor: { userId: actors.admin._id, role: 'admin' }, action: 'verify' })
  ]);
  assert.equal(outcome.filter(r => r.status === 'fulfilled').length, 1);
  const saved = await Registration.findById(row._id), active = saved.status === 'verified';
  assert.equal(await Claim.countDocuments(), active ? 13 : 0);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, active ? 1 : 0);
  assert.equal(await Registration.countDocuments(), 1);
});

test('a unique legacy owner index produces a clean conflict and full rollback without deleting rejected history', async () => {
  const f = await fixture(), row = await service.register(f.args);
  await service.transition({ registrationId: row._id, actor: { userId: f.users[0]._id }, action: 'cancel' });
  await Registration.collection.createIndex({ tournamentId: 1, userId: 1 }, { unique: true, name: 'disposable_unique_owner_test' });
  try {
    await assert.rejects(service.register(f.args), { code: 'REGISTRATION_CONFLICT' });
    assert.equal(await Registration.countDocuments(), 1); assert.equal((await Registration.findById(row._id)).status, 'rejected');
    assert.equal(await Claim.countDocuments(), 0); assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0);
  } finally {
    assert.equal(mongoose.connection.name, 'valorant_registration_disposable');
    await Registration.collection.dropIndex('disposable_unique_owner_test');
  }
});

test('verification rejects a team that no longer matches its registration owner/game', async () => {
  const f = await fixture(), row = await service.register(f.args);
  await Team.updateOne({ _id: f.team._id }, { $set: { game: 'bgmi' } });
  await assert.rejects(service.transition({ registrationId: row._id, actor: { userId: actors.admin._id, role: 'admin' }, action: 'verify' }), { code: 'INVALID_REGISTRATION_TEAM' });
  assert.equal((await Registration.findById(row._id)).status, 'pending');
  assert.equal(await Claim.countDocuments(), 13); assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 1);
});

test('paid, closed, mismatched counters and legacy participants are rejected without repair', async () => {
  const f = await fixture();
  await Tournament.collection.updateOne({ _id: f.tournament._id }, { $set: { entryFee: 100 } });
  await assert.rejects(service.register(f.args), { code: 'PAID_REGISTRATION_UNAVAILABLE' });
  await Tournament.collection.updateOne({ _id: f.tournament._id }, { $set: { entryFee: 0, status: 'registration_closed' } });
  await assert.rejects(service.register(f.args), { code: 'REGISTRATION_CLOSED' });
  await Tournament.updateOne({ _id: f.tournament._id }, { $set: { status: 'registration_open', currentParticipants: 1 } });
  await assert.rejects(service.register(f.args), { code: 'CAPACITY_STATE_MISMATCH' });
  await Tournament.updateOne({ _id: f.tournament._id }, { $push: { participants: { userId: f.users[0]._id, gameId: 'Historical#ID' } } });
  await assert.rejects(service.register(f.args), { code: 'LEGACY_VALORANT_REVIEW_REQUIRED' });
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 1); assert.equal(await Registration.countDocuments(), 0);
});

test('legacy game endpoints cannot mutate or clear Valorant registrations', async () => {
  const f = await fixture(), row = await service.register(f.args);
  for (const game of ['bgmi', 'freefire']) {
    for (const [path, method] of [[`/debug/registration/${row._id}`, 'DELETE'], [`/debug/tournament/${f.tournament._id}/clear`, 'DELETE'], [`/${row._id}`, 'DELETE']]) {
      assert.equal((await request(`/api/${game}-registration${path}`, method, undefined, actors.admin)).status, 409);
    }
  }
  assert.equal((await request(`/api/tournaments/${f.tournament._id}/join`, 'POST', { gameId: 'Fiction#TAG' }, f.users[0])).status, 409);
  assert.equal((await request(`/api/tournaments/${f.tournament._id}/leave`, 'DELETE', undefined, f.users[0])).status, 409);
  assert.equal(await Registration.countDocuments(), 1); assert.equal(await Claim.countDocuments(), 13);
});

test('verified rosters feed competitive results, statistics and history without matching on mutable Riot IDs', async () => {
  const a = await fixture(), b = await fixture();
  const first = await service.register(a.args), second = await service.register({ ...b.args, tournamentId: a.tournament._id });
  for (const row of [first, second]) await service.transition({ registrationId: row._id, actor: { userId: actors.admin._id, role: 'admin' }, action: 'verify' });
  const match = await results.createValorantResult({ actorId: actors.admin._id, payload: {
    tournamentId: a.tournament._id, matchNumber: 1, status: 'verified', teamA: { registrationId: first._id, score: 13 }, teamB: { registrationId: second._id, score: 4 }
  } });
  assert.equal(match.teamA.rosterSnapshot.length, 6);
  for (const player of a.users) assert.equal((await getValorantHistory({ user: player, limit: 20 })).length, 1);
  await User.updateOne({ _id: a.users[1]._id }, { $set: { 'gameIds.valorant': 'Renamed#TAG' } });
  assert.equal((await getValorantHistory({ user: a.users[1], limit: 20 })).length, 1);
  const stats = await getPlayerStatistics(a.users[1].username);
  assert.equal(stats.games.valorant.performance.matchesParticipated, 1);
  assert.equal(stats.overview.tournamentsJoined, 1);
  for (const player of a.users) {
    const participation = await getTournamentHistory({ user: player, limit: 20 });
    assert.ok(participation.some(event => String(event.tournament.id) === String(a.tournament._id)));
  }
  const profile = await getPlayerCompetitiveProfile(a.users[1].username);
  assert.equal(profile.overview.tournamentsJoined, 1);
  assert.equal((await Result.findById(match._id)).teamA.rosterSnapshot[1].gameId, a.users[1].gameIds.valorant);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Game = require('../../models/Game');
const User = require('../../models/User');
const Tournament = require('../../models/Tournament');
const Registration = require('../../models/TournamentRegistration');

let replica, server, base, users;
const secret = 'synthetic-games-security-secret';
const mutations = [
  ['POST', '/api/games', { id: 'new-game', name: 'New Game', description: 'Synthetic game' }],
  ['PUT', '/api/games/test-game', { name: 'Edited Game' }],
  ['DELETE', '/api/games/test-game'],
  ['PATCH', '/api/games/test-game/stats', { tournaments: 7 }],
  ['POST', '/api/games/admin/activate-all', {}]
];

test.before(async () => {
  process.env.JWT_SECRET = secret;
  process.env.REDIS_DISABLED = 'true';
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('games_security_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false });
  const app = express();
  app.use(express.json());
  app.use('/api/games', require('../../routes/games'));
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'games_security_disposable');
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  users = {};
  for (const role of ['user', 'admin', 'designer', 'moderator']) {
    users[role] = await User.create({ fullName: `Game ${role}`, username: `game-${role}`, email: `${role}@example.com`,
      authProvider: 'google', role, isActive: true });
  }
  await Game.create({ id: 'test-game', name: 'Test Game', description: 'Synthetic public game', featured: true });
  await Game.create({ id: 'inactive-game', name: 'Inactive Game', description: 'Synthetic inactive game', isActive: false });
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

const tokenFor = role => jwt.sign({ userId: users[role]._id }, secret);
const request = (method, url, body, token) => fetch(base + url, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {})
});

test('all game mutations reject anonymous, invalid-token and ordinary-user requests without writes', async () => {
  const before = await Game.find().sort({ id: 1 }).lean();
  for (const [method, url, body] of mutations) {
    for (const [token, expected] of [[null, 401], ['invalid', 401], [tokenFor('user'), 403],
      [jwt.sign({ userId: users.user._id, role: 'admin' }, secret), 403]]) {
      assert.equal((await request(method, url, body, token)).status, expected, `${method} ${url}`);
    }
  }
  assert.deepEqual(await Game.find().sort({ id: 1 }).lean(), before);
});

test('current database roles and account activity override stale privileged token claims', async () => {
  const token = tokenFor('admin');
  await User.updateOne({ _id: users.admin._id }, { role: 'user' });
  for (const [method, url, body] of mutations) assert.equal((await request(method, url, body, token)).status, 403);
  await User.updateOne({ _id: users.admin._id }, { role: 'admin', isActive: false });
  for (const [method, url, body] of mutations) assert.equal((await request(method, url, body, token)).status, 401);
});

test('public game reads retain their existing response shapes and active filtering', async () => {
  const list = await request('GET', '/api/games');
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).data.games.map(game => game.id), ['test-game']);
  const featured = await request('GET', '/api/games/featured');
  assert.equal(featured.status, 200);
  assert.equal((await featured.json())[0].id, 'test-game');
  assert.equal((await request('GET', '/api/games/test-game')).status, 200);
  assert.equal((await request('GET', '/api/games/inactive-game')).status, 404);
  const debug = await request('GET', '/api/games/debug/all-games');
  assert.equal(debug.status, 200);
  assert.equal((await debug.json()).totalCount, 2);
});

for (const role of ['admin', 'moderator', 'designer']) {
  test(`${role} retains create, edit, stats, activation and delete functionality`, async () => {
    const token = tokenFor(role);
    const created = await request('POST', '/api/games', { id: 'new-game', name: 'New Game', description: 'Synthetic game' }, token);
    assert.equal(created.status, 201);
    assert.equal((await created.json()).game.id, 'new-game');
    const edited = await request('PUT', '/api/games/new-game', { name: 'Edited Game', featured: true, order: 3 }, token);
    assert.equal(edited.status, 200);
    assert.equal((await edited.json()).game.name, 'Edited Game');
    const stats = await request('PATCH', '/api/games/new-game/stats', { tournaments: '7', activePlayers: '1K', totalPrize: '1000' }, token);
    assert.equal(stats.status, 200);
    assert.equal((await stats.json()).game.tournaments, 7);
    const activate = await request('POST', '/api/games/admin/activate-all', {}, token);
    assert.equal(activate.status, 200);
    assert.equal((await Game.findOne({ id: 'inactive-game' })).isActive, true);
    assert.equal((await request('DELETE', '/api/games/new-game', undefined, token)).status, 200);
    assert.equal(await Game.countDocuments({ id: 'new-game' }), 0);
  });
}

test('patched casting prevents prototype pollution across production and competitive schemas', () => {
  // Keep the exploit probe in a separate process even if a future downgrade regresses.
  const script = `
    const assert = require('node:assert/strict');
    for (const file of ['models/Game', 'models/User', 'models/Tournament', 'models/TournamentRegistration',
      'features/freefire-results/freefire-match-result.model', 'features/valorant-results/valorant-match-result.model',
      'features/tournament-final-results/tournament-final-result.model']) {
      const Model = require('./server/' + file);
      for (const property of ['$fullPath', '$parentSchemaDocArray']) assert.equal(Object.prototype.hasOwnProperty(property), false);
      for (const update of [JSON.parse('{"$set":{"__proto__.x":"attack"}}'), JSON.parse('{"__proto__.x":"attack"}')]) {
        const query = Model.updateOne({}, {});
        try { query._castUpdate(update); } catch (error) { /* rejection is also safe if it has no side effects */ }
        for (const property of ['$fullPath', '$parentSchemaDocArray']) assert.equal(Object.prototype.hasOwnProperty(property), false, file);
      }
    }
    console.log('All seven schemas remain unpolluted');
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '../../..'), env: {}, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All seven schemas remain unpolluted/);
});

test('authorized malicious update has no prototype or stored-document side effects', async () => {
  const before = await Game.findOne({ id: 'test-game' }).lean();
  const attack = JSON.parse('{"$set":{"__proto__.x":"attack"}}');
  const response = await request('PUT', '/api/games/test-game', attack, tokenFor('admin'));
  // Patched Mongoose strips the invalid path; the ordinary update route stays compatible.
  assert.equal(response.status, 200);
  for (const property of ['$fullPath', '$parentSchemaDocArray']) assert.equal(Object.prototype.hasOwnProperty(property), false);
  const after = await Game.findOne({ id: 'test-game' }).lean();
  // Existing Mongoose timestamps still record the authorized update attempt.
  assert.ok(after.updatedAt >= before.updatedAt);
  assert.deepEqual({ ...after, updatedAt: before.updatedAt }, before);
});

test('patched sanitizeFilter handles nested nor selectors without changing literal queries', () => {
  const value = { $nor: [{ username: { $ne: null } }] };
  mongoose.sanitizeFilter(value);
  assert.deepEqual(value, { $nor: [{ username: { $eq: { $ne: null } } }] });
  assert.deepEqual(mongoose.sanitizeFilter({ username: 'game-user' }), { username: 'game-user' });
});

test('patched schemas retain profile updates, validation, casting and registration round trips', async () => {
  const player = users.user;
  const profile = await User.findByIdAndUpdate(String(player._id), { $set: { bio: 'Updated profile', profileVisibility: 'private' } }, { new: true, runValidators: true });
  assert.equal(profile.bio, 'Updated profile');
  assert.equal(String(profile._id), String(player._id));
  await assert.rejects(User.findByIdAndUpdate(player._id, { profileVisibility: 'invalid' }, { runValidators: true }),
    error => error.name === 'ValidationError' && error.errors.profileVisibility.kind === 'enum');
  for (const gameType of ['bgmi', 'freefire']) {
    const tournament = await Tournament.create({ name: 'Synthetic Registration Cup', gameType, maxParticipants: 20, prizePool: 0, createdBy: users.admin._id });
    const registration = await Registration.create({ tournamentId: String(tournament._id), userId: String(player._id), teamName: 'Synthetic Team',
      teamLeader: { name: 'Leader', bgmiId: '10001', freeFireId: '20001', phone: '9876543210' }, whatsappNumber: '9876543210',
      teamMembers: [1, 2, 3].map(i => ({ name: 'Member ' + i, bgmiId: '1000' + (i + 1), freeFireId: '2000' + (i + 1) })) });
    assert.equal(String(registration.userId), String(player._id));
    assert.equal((await Registration.findOne({ tournamentId: String(tournament._id), userId: String(player._id) })).teamName, 'Synthetic Team');
    const updated = await Registration.findByIdAndUpdate(String(registration._id), { status: 'verified' }, { new: true, runValidators: true });
    assert.equal(updated.status, 'verified');
    await assert.rejects(Registration.findByIdAndUpdate(registration._id, { status: 'invalid' }, { runValidators: true }),
      error => error.name === 'ValidationError' && error.errors.status.kind === 'enum');
    if (gameType === 'bgmi') assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
  }
});

const test = require('node:test');
const assert = require('node:assert/strict');
require('../game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
let replica, server, base, serial = 0;
const secret = 'synthetic-scoreboard-gallery-secret';
const oid = () => new mongoose.Types.ObjectId();
async function cup(game, images = []) {
  const row = { _id: oid(), name: `Public Cup ${++serial}`, gameType: game, status: 'completed',
    createdBy: oid(), maxParticipants: 16, prizePool: 0,
    roomDetails: { password: 'private-room-marker' }, participants: [{ userId: oid(), gameId: 'private-phone-marker' }],
    scoreboards: images.map((date, index) => ({ _id: oid(), imageUrl: `https://images.example.test/${serial}-${index}.png`,
      description: `Scoreboard ${index}`, uploadedAt: new Date(date), uploadedBy: oid(), order: index })) };
  await Tournament.collection.insertOne(row); return row;
}
const gallery = query => fetch(base + '/api/tournaments/scoreboards-gallery?' + query);
test.before(async () => {
  process.env.JWT_SECRET = secret; process.env.REDIS_DISABLED = 'true';
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('scoreboard_gallery_disposable'); assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  await Tournament.createCollection(); await User.createCollection();
  const app = express(); app.use(express.json());
  app.use('/api', require('./scoreboard-gallery.routes'));
  app.use('/api/tournaments', require('../../routes/tournaments'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'scoreboard_gallery_disposable');
  await Tournament.deleteMany({}); await User.deleteMany({});
});
test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (replica) await replica.stop(); });

test('each game returns existing images without publication and omits private tournament fields', async () => {
  for (const game of ['bgmi', 'freefire', 'valorant']) await cup(game, ['2026-01-01']);
  for (const game of ['bgmi', 'freefire', 'valorant']) {
    const response = await gallery(`gameType=${game}`);
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    const body = await response.json();
    assert.equal(body.data.scoreboards.length, 1); assert.equal(body.data.scoreboards[0].tournament.gameType, game);
    assert.doesNotMatch(JSON.stringify(body), /private-room-marker|private-phone-marker|uploadedBy|participants/);
  }
});
test('pagination preserves all legacy images across tournaments in newest-first order', async () => {
  const older = await cup('bgmi', ['2026-01-01', '2026-01-02']);
  const newest = await cup('bgmi', ['2026-02-01']);
  await cup('freefire', ['2026-03-01']);
  const first = await (await gallery('gameType=bgmi&page=1&limit=2')).json();
  assert.equal(first.data.pagination.total, 3); assert.equal(first.data.pagination.hasMore, true);
  assert.equal(first.data.scoreboards[0].tournament.id, String(newest._id));
  const second = await (await gallery('gameType=bgmi&page=2&limit=2')).json();
  assert.equal(second.data.scoreboards.length, 1); assert.equal(second.data.pagination.hasMore, false);
  assert.equal(second.data.scoreboards[0]._id, String(older.scoreboards[0]._id));
});
test('empty galleries succeed and unsupported or unbounded queries are rejected', async () => {
  assert.deepEqual((await (await gallery('gameType=valorant')).json()).data.scoreboards, []);
  for (const query of ['gameType=cs2', 'gameType=bgmi&page=0', 'gameType=bgmi&page=1.5', 'gameType=bgmi&limit=999', 'gameType=bgmi&limit=bad']) {
    assert.equal((await gallery(query)).status, 400);
  }
});
test('the existing admin upload/delete workflow feeds the new gallery without publication', async () => {
  const admin = { _id: oid(), username: 'gallery-admin', role: 'admin', isActive: true };
  const ordinary = { _id: oid(), username: 'gallery-user', role: 'user', isActive: true };
  await User.collection.insertMany([admin, ordinary]);
  const tournament = await cup('bgmi');
  const headers = user => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ userId: user._id }, secret)}` });
  const payload = JSON.stringify({ imageUrl: 'https://images.example.test/admin-upload.png', description: 'Existing admin upload' });
  const endpoint = base + '/api/tournaments/' + tournament._id + '/scoreboards';
  assert.equal((await fetch(endpoint, { method: 'POST', headers: headers(ordinary), body: payload })).status, 403);
  assert.equal((await fetch(endpoint, { method: 'POST', headers: headers(admin), body: payload })).status, 200);
  const board = (await (await gallery('gameType=bgmi')).json()).data.scoreboards[0];
  assert.equal(board.description, 'Existing admin upload');
  assert.equal((await fetch(endpoint + '/' + board._id, { method: 'DELETE', headers: headers(admin) })).status, 200);
  assert.equal((await (await gallery('gameType=bgmi')).json()).data.scoreboards.length, 0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
require('../game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const service = require('./streak.service');
const { getDayKey, getPreviousDayKey } = require('./streak.utils');
let replica, server, base, serial = 0;
const secret = 'synthetic-activity-streak-secret';
const now = new Date('2026-01-01T18:29:59.000Z');
async function player(extra = {}) {
  const row = { _id: new mongoose.Types.ObjectId(), username: `streak-${++serial}`,
    email: `streak-${serial}@example.com`, fullName: 'private-full-name-marker',
    passwordHash: 'private-password-marker', isActive: true, profileVisibility: 'public', ...extra };
  await User.collection.insertOne(row);
  return row;
}
test.before(async () => {
  process.env.JWT_SECRET = secret;
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('activity_streak_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  await User.createCollection(); await Wallet.createCollection();
  const app = express(); app.use(express.json());
  app.use('/api/streak', require('./streak.routes'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'activity_streak_disposable');
  await User.deleteMany({}); await Wallet.deleteMany({});
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); if (replica) await replica.stop();
});

test('IST boundaries include month, year and leap-day transitions', () => {
  assert.equal(getDayKey(now), '2026-01-01');
  assert.equal(getDayKey(new Date('2026-01-01T18:30:00Z')), '2026-01-02');
  assert.equal(getPreviousDayKey('2026-01-01'), '2025-12-31');
  assert.equal(getPreviousDayKey('2024-03-01'), '2024-02-29');
  assert.equal(getPreviousDayKey('2025-03-01'), '2025-02-28');
});

test('concurrent first visits count once without changing reward streak, balance or other data', async () => {
  const own = await player({ loginStreak: 6, totalEarnings: 100, nextActivityStreak: 'preserve-existing-field' });
  const results = await Promise.all(Array.from({ length: 12 }, () => service.checkIn(own._id, now)));
  assert.equal(results.filter(row => row.updated).length, 1);
  assert.ok(results.every(row => row.activityStreak === 1 && row.totalActiveDays === 1));
  const stored = await User.collection.findOne({ _id: own._id });
  assert.equal(stored.loginStreak, 6); assert.equal(stored.totalEarnings, 100);
  assert.equal(stored.nextActivityStreak, 'preserve-existing-field');
  assert.equal(await Wallet.countDocuments(), 0);
});

test('consecutive days increment; gaps reset only the current streak; late requests cannot roll back dates', async () => {
  const own = await player();
  await service.checkIn(own._id, now);
  const next = await service.checkIn(own._id, new Date('2026-01-01T18:30:00Z'));
  assert.equal(next.activityStreak, 2); assert.equal(next.longestActivityStreak, 2);
  const late = await service.checkIn(own._id, now);
  assert.equal(late.updated, false); assert.equal(late.lastActivityDayKey, '2026-01-02');
  const afterGap = await service.checkIn(own._id, new Date('2026-01-04T00:00:00Z'));
  assert.equal(afterGap.activityStreak, 1); assert.equal(afterGap.longestActivityStreak, 2);
  assert.equal(afterGap.totalActiveDays, 3);
});

test('public leaderboard excludes private, inactive, expired and unconfigured visibility accounts', async () => {
  const own = await player({ activityStreak: 2, lastActivityDayKey: '2026-01-01' });
  await player({ activityStreak: 3, lastActivityDayKey: '2025-12-31' });
  for (const extra of [{ profileVisibility: 'private' }, { isActive: false },
    { lastActivityDayKey: '2025-12-30' }, { profileVisibility: undefined }]) {
    await player({ username: `hidden-${serial}`, activityStreak: 99, lastActivityDayKey: '2026-01-01', ...extra });
  }
  const board = await service.getLeaderboard(own._id, { limit: 1 }, now);
  assert.equal(board.leaderboard.length, 1); assert.equal(board.leaderboard[0].activityStreak, 3);
  assert.equal(board.currentUser.rank, 2);
  assert.doesNotMatch(JSON.stringify(board), /hidden-|private-full-name-marker|private-password-marker|@example.com/);
  await User.updateOne({ _id: own._id }, { $set: { profileVisibility: 'private' } });
  const privateBoard = await service.getLeaderboard(own._id, {}, now);
  assert.equal(privateBoard.currentUser.rank, null); assert.equal(privateBoard.currentUser.activityStreak, 2);
});

test('leaderboard ties normalize legacy missing counters, preserve stable ranks, and expire after a missed day', async () => {
  const first = await player({ activityStreak: 2, lastActivityDayKey: '2026-01-01' });
  const second = await player({ activityStreak: 2, longestActivityStreak: 0, totalActiveDays: 0, lastActivityDayKey: '2026-01-01' });
  assert.equal((await service.getLeaderboard(second._id, {}, now)).currentUser.rank, 2);
  const board = await service.getLeaderboard(first._id, {}, new Date('2026-01-03T00:00:00Z'));
  assert.equal(board.leaderboard.length, 0); assert.equal(board.currentUser.activityStreak, 0);
  for (const [input, expected] of [[undefined, 10], ['bad', 10], ['0', 10], ['-3', 10], ['9999', 50], ['5', 5]]) {
    assert.equal(service.parseLimit(input), expected);
  }
});

test('HTTP auth and server time prevent check-ins for another user or forged streaks', async () => {
  const own = await player(), other = await player();
  assert.equal((await fetch(base + '/api/streak/check-in', { method: 'POST' })).status, 401);
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: own._id }, secret)}`, 'Content-Type': 'application/json' };
  const response = await fetch(base + '/api/streak/check-in', { method: 'POST', headers,
    body: JSON.stringify({ userId: other._id, activityStreak: 999, now: '2099-01-01' }) });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/);
  const body = await response.json(); assert.equal(body.data.activityStreak, 1);
  assert.equal(body.data.lastActivityDayKey, getDayKey());
  assert.equal((await User.collection.findOne({ _id: other._id })).activityStreak, undefined);
  assert.equal((await fetch(base + '/api/streak/leaderboard', { headers })).status, 200);
  await User.updateOne({ _id: own._id }, { $set: { isActive: false } });
  assert.equal((await fetch(base + '/api/streak/check-in', { method: 'POST', headers })).status, 401);
  await assert.rejects(service.checkIn(own._id, now), { status: 404 });
});

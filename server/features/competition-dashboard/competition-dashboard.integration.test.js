const test = require('node:test');
const assert = require('node:assert/strict');
require('../game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../../models/User');
const Identity = require('../../models/Identity');
const Team = require('../../models/Team');
const Tournament = require('../../models/Tournament');
const Registration = require('../../models/TournamentRegistration');
const Notification = require('../../models/Notification');
const Wallet = require('../../models/Wallet');
const service = require('./competition-dashboard.service');
const oid = () => new mongoose.Types.ObjectId();
const secret = 'synthetic-dashboard-secret';
const models = [User, Identity, Team, Tournament, Registration, Notification, Wallet];
let replica, server, base, serial = 0;
const future = () => new Date(Date.now() + 3600000);
async function player(extra = {}) {
  const row = { _id: oid(), username: `player-${++serial}`, email: `player-${serial}@example.com`,
    fullName: 'Synthetic Player', passwordHash: 'private-password-marker', isActive: true, role: 'user', ...extra };
  await User.collection.insertOne(row);
  return row;
}
async function tournament(extra = {}) {
  const row = { _id: oid(), name: `Cup ${++serial}`, gameType: 'valorant', mode: 'team', status: 'registration_open',
    maxParticipants: 20, currentParticipants: 0, registrationDeadline: future(), startDate: future(), participants: [],
    roomDetails: { secret: 'private-room-marker' }, ...extra };
  await Tournament.collection.insertOne(row); return row;
}
async function registration(user, cup, extra = {}) {
  const row = { _id: oid(), tournamentId: cup._id, userId: user._id, teamName: 'Synthetic Team', status: 'pending',
    registeredAt: new Date(), createdAt: new Date(), roster: [], payment: { providerKey: 'private-payment-marker' }, ...extra };
  await Registration.collection.insertOne(row); return row;
}
const request = (user, query = '') => fetch(base + '/api/competition-dashboard' + query, {
  headers: user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, secret)}` } : {}
});

test.before(async () => {
  process.env.JWT_SECRET = secret;
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('competition_dashboard_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  for (const Model of models) await Model.createCollection();
  const app = express();
  app.use('/api/competition-dashboard', require('./competition-dashboard.routes'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'competition_dashboard_disposable');
  for (const Model of models) await Model.deleteMany({});
});
test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

test('anonymous requests are rejected and query parameters cannot select another user', async () => {
  const own = await player(), other = await player({ fullName: 'Private Other Player' });
  await Wallet.collection.insertMany([{ userId: own._id, balance: 12 }, { userId: other._id, balance: 99999 }]);
  await Notification.collection.insertOne({ user: other._id, type: 'match', title: 'private-other-notification', message: 'hidden', createdAt: new Date() });
  assert.equal((await request()).status, 401);
  const response = await request(own, `?userId=${other._id}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private.*no-store/);
  const body = await response.json();
  assert.equal(body.data.player.id, String(own._id));
  assert.equal(body.data.wallet.balance, 12);
  assert.doesNotMatch(JSON.stringify(body), /Private Other Player|99999|private-other-notification|private-password-marker/);
});

test('empty accounts return a complete zero-state without creating a wallet or identity', async () => {
  const own = await player();
  const before = await Promise.all(models.map(Model => Model.countDocuments()));
  const dashboard = await service.getCompetitionDashboard(own._id);
  assert.deepEqual(dashboard.overview, { tournamentsJoined: 0, activeRegistrations: 0, teams: 0, completedCompetitions: 0 });
  assert.deepEqual(dashboard.wallet, { balance: 0, totalEarned: 0, totalSpent: 0 });
  for (const key of ['teams', 'registrations', 'upcomingCompetitions', 'recentActivity', 'verifiedAccounts']) assert.deepEqual(dashboard[key], []);
  assert.deepEqual(await Promise.all(models.map(Model => Model.countDocuments())), before);
});

test('rejected retries, roster membership, participant overlap and orphaned rows produce accurate unique totals', async () => {
  const own = await player(), captain = await player();
  const live = await tournament({ participants: [{ userId: own._id }] });
  const completed = await tournament({ status: 'completed', participants: [{ userId: own._id }] });
  const participantOnly = await tournament({ status: 'completed', participants: [{ userId: own._id }] });
  const cancelledAttempt = await tournament({ status: 'completed' });
  for (let i = 0; i < 12; i++) await registration(own, live, { status: 'rejected', registeredAt: new Date(Date.now() + i * 1000) });
  const active = await registration(captain, live, { roster: [{ userId: own._id, role: 'substitute' }] });
  await registration(own, completed);
  await registration(own, { _id: oid() });
  await registration(own, cancelledAttempt, { status: 'rejected' });
  const dashboard = await service.getCompetitionDashboard(own._id);
  assert.deepEqual(dashboard.overview, { tournamentsJoined: 3, activeRegistrations: 1, teams: 0, completedCompetitions: 2 });
  assert.equal(dashboard.registrations.length, 1);
  assert.equal(dashboard.registrations[0].id, String(active._id));
  assert.equal(dashboard.upcomingCompetitions.filter(cup => cup.id === String(live._id)).length, 1);
  assert.ok(!dashboard.upcomingCompetitions.some(cup => [completed, participantOnly, cancelledAttempt].some(row => String(row._id) === cup.id)));
  assert.doesNotMatch(JSON.stringify(dashboard), /private-room-marker|private-payment-marker/);
});

test('active registration lists are not hidden behind newer completed registrations', async () => {
  const own = await player();
  const live = await tournament();
  const row = await registration(own, live, { registeredAt: new Date(0) });
  for (let i = 0; i < 12; i++) await registration(own, await tournament({ status: 'completed' }));
  const dashboard = await service.getCompetitionDashboard(own._id);
  assert.equal(dashboard.registrations[0].id, String(row._id));
  assert.equal(dashboard.overview.completedCompetitions, 12);
});

test('recommendations exclude full, closed, expired and already joined tournaments before limiting', async () => {
  const own = await player();
  const unavailable = [
    await tournament({ currentParticipants: 20 }), await tournament({ status: 'active' }),
    await tournament({ registrationDeadline: new Date(0) }), await tournament({ status: 'registration_closed' })
  ];
  for (let i = 0; i < 10; i++) await registration(own, await tournament({ status: 'completed' }));
  const eligible = await tournament({ name: 'Eligible Cup' });
  const dashboard = await service.getCompetitionDashboard(own._id);
  assert.ok(dashboard.upcomingCompetitions.some(cup => cup.id === String(eligible._id)));
  assert.ok(dashboard.upcomingCompetitions.every(cup => !unavailable.some(row => String(row._id) === cup.id)));
});

test('connected Steam is deduplicated and saved Valorant/Steam IDs never become verified identities', async () => {
  const own = await player({ gameIds: { steam: 'saved-id', valorant: 'SavedPlayer#TEST' } });
  await Identity.collection.insertOne({ userId: own._id, provider: 'steam', canLogin: true, displayName: 'Linked Steam',
    metadata: { accessToken: 'private-provider-token-marker' } });
  const dashboard = await service.getCompetitionDashboard(own._id);
  assert.equal(dashboard.verifiedAccounts.filter(account => account.provider === 'steam').length, 1);
  assert.equal(dashboard.verifiedAccounts.find(account => account.provider === 'valorant').verificationStatus, 'unverified');
  assert.ok(dashboard.verifiedAccounts.every(account => account.verified === false));
  assert.doesNotMatch(JSON.stringify(dashboard), /private-provider-token-marker/);
  await Identity.deleteMany({});
  const saved = await service.getCompetitionDashboard(own._id);
  assert.equal(saved.verifiedAccounts.find(account => account.provider === 'steam').connectionStatus, 'profile_game_id');
});

test('only own teams and notifications are exposed; unsafe activity links are removed', async () => {
  const own = await player(), other = await player();
  await Team.collection.insertMany([
    { name: 'Private Own Team', captain: own._id, members: [{ userId: own._id }], maxMembers: 6, game: 'valorant', privacy: 'private', isActive: true },
    { name: 'private-other-team', captain: other._id, members: [{ userId: other._id }], maxMembers: 6, game: 'valorant', isActive: true }
  ]);
  await Notification.collection.insertMany([
    { user: own._id, type: 'match', title: 'Own notice', actionUrl: 'javascript:alert(1)', metadata: { secret: 'private-notification-marker' }, createdAt: new Date() },
    { user: other._id, type: 'match', title: 'private-other-notice', actionUrl: '/teams', createdAt: new Date() }
  ]);
  const dashboard = await service.getCompetitionDashboard(own._id);
  assert.equal(dashboard.teams.length, 1);
  assert.equal(dashboard.teams[0].role, 'captain');
  assert.equal(dashboard.recentActivity.length, 1);
  assert.equal(dashboard.recentActivity[0].actionUrl, '');
  assert.doesNotMatch(JSON.stringify(dashboard), /private-other-team|private-other-notice|private-notification-marker/);
});

test('invalid and missing users fail without exposing database details', async () => {
  await assert.rejects(service.getCompetitionDashboard('invalid'), { status: 400 });
  await assert.rejects(service.getCompetitionDashboard(oid()), { status: 404 });
});

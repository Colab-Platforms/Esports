const test = require('node:test');
const assert = require('node:assert/strict');
require('../../features/game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.GOOGLE_CLIENT_ID = 'synthetic-client';
process.env.GOOGLE_CLIENT_SECRET = 'synthetic-secret';
process.env.STEAM_API_KEY = 'synthetic-steam-key';
process.env.CLIENT_URL = 'https://client.example.test';
process.env.SERVER_URL = 'https://server.example.test';
process.env.JWT_SECRET = 'synthetic-jwt-secret';
const User = require('../../models/User');
const Identity = require('../../models/Identity');
const AuthCode = require('../../models/AuthCode');
const auth = require('./auth.service');
const linking = require('./account-linking.service');
const identities = require('./identity.service');
const codes = require('./auth-code.service');
const passport = require('passport');
const fakeIdentity = id => ({ providerId: id, displayName: 'Synthetic Player', email: `${id}@example.com`,
  emailVerifiedByProvider: true, profile: {}, metadata: {} });
const originalAuthenticate = passport.authenticate;
let replica, servers = [], bases = [];

test.before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('oauth_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false });
  for (const Model of [User, Identity, AuthCode]) await Model.createCollection();
  await User.collection.createIndex({ username: 1 }, { unique: true });
  await User.collection.createIndex({ email: 1 }, { unique: true });
  await User.collection.createIndex({ phone: 1 }, { unique: true, sparse: true });
  for (const Model of [Identity, AuthCode]) await Model.createIndexes();
  // Simulate only the external provider response. Session, state, DB, account
  // resolution, callback routes, code exchange and JWT verification are real.
  passport.authenticate = (provider, options, callback) => {
    const handler = typeof options === 'function' ? options : callback;
    return handler
      ? (req, _res, next) => Promise.resolve(handler(null, fakeIdentity(req.query.subject || 'callback-user'))).catch(next)
      : (_req, res) => res.redirect(`https://provider.example.test/?state=${options?.state || ''}`);
  };
  for (let i = 0; i < 2; i++) {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'synthetic-shared-session', resave: false, saveUninitialized: false,
      store: MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'oauth_test_sessions' }),
      cookie: { httpOnly: true, sameSite: 'lax' } }));
    app.use('/api/auth', require('../../routes/auth'));
    app.use('/api/accounts', require('../../routes/accounts'));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    servers.push(server); bases.push(`http://127.0.0.1:${server.address().port}`);
  }
});
test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'oauth_disposable');
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
});
test.after(async () => {
  passport.authenticate = originalAuthenticate;
  for (const server of servers) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replica) await replica.stop();
});
const localUser = name => User.create({ username: name, email: `${name}@example.com`,
  authProvider: 'google', fullName: 'Synthetic Existing User', passwordHash: 'password-existing-user' });
const cookieFor = response => response.headers.get('set-cookie')?.split(';')[0];
async function request(path, { app = 0, cookie, token, method = 'GET', body } = {}) {
  return fetch(bases[app] + path, { method, redirect: 'manual', headers: {
    'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
}

test('existing Google subject keeps the same user, game IDs, and profile without email auto-linking', async () => {
  const user = await localUser('existing-google');
  await User.updateOne({ _id: user._id }, { $set: { 'socialAccounts.google': {
    id: 'google-subject', email: user.email, isConnected: true
  }, 'gameIds.valorant': 'SavedPlayer#TEST' } });
  const result = await auth.loginWithIdentity('google', { ...fakeIdentity('google-subject'), email: user.email });
  assert.equal(String(result.user._id), String(user._id));
  assert.equal(result.isNewUser, false);
  assert.equal(result.identity.linkedVia, 'migrated');
  assert.equal(result.user.gameIds.valorant, 'SavedPlayer#TEST');
  assert.equal(await User.countDocuments(), 1);
});

test('existing Steam subject is preserved and cannot be claimed by another logged-in user', async () => {
  const owner = await localUser('steam-owner'), other = await localUser('steam-other');
  await User.updateOne({ _id: owner._id }, { $set: { 'steamProfile.steamId': '76561190000000001', 'steamProfile.isConnected': false,
    'steamGames.cs2': { owned: true, playtime: 240, verified: true } } });
  const identity = { ...fakeIdentity('76561190000000001'), email: '' };
  await assert.rejects(linking.connectIdentity(other._id, 'steam', identity), { code: 'IDENTITY_ALREADY_LINKED' });
  const result = await auth.loginWithIdentity('steam', identity);
  assert.equal(String(result.user._id), String(owner._id));
  assert.equal(result.identity.metadata.steamGames.cs2.playtime, 240);
  assert.equal(await User.countDocuments(), 2);
});

test('same email without the same provider subject requires explicit linking', async () => {
  const user = await localUser('email-owner');
  await assert.rejects(auth.loginWithIdentity('google', { ...fakeIdentity('unknown-subject'), email: user.email }), { code: 'ACCOUNT_LINK_REQUIRED' });
  assert.equal(await Identity.countDocuments(), 0);
  assert.equal(await User.countDocuments(), 1);
});

test('concurrent first sign-ins create one user and one identity without orphan users', async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => auth.loginWithIdentity('facebook', fakeIdentity('new-facebook'))));
  assert.equal(new Set(results.map(result => String(result.user._id))).size, 1);
  assert.equal(await User.countDocuments(), 1);
  assert.equal(await Identity.countDocuments(), 1);
});

test('Xbox without email creates an account and provider display names satisfy user constraints', async () => {
  const result = await auth.loginWithIdentity('xbox', { ...fakeIdentity('1234567890'), email: '', displayName: 'X' });
  assert.equal(result.user.authProvider, 'xbox');
  assert.ok(result.user.username.length >= 3);
  assert.ok(result.user.fullName.length >= 3);
});

test('inactive legacy and migrated accounts cannot authenticate', async () => {
  const user = await localUser('inactive-user');
  await Identity.create({ userId: user._id, provider: 'google', providerId: 'inactive-subject' });
  await User.updateOne({ _id: user._id }, { $set: { isActive: false } });
  await assert.rejects(auth.loginWithIdentity('google', fakeIdentity('inactive-subject')), { code: 'ACCOUNT_UNAVAILABLE' });
  assert.equal(await AuthCode.countDocuments(), 0);
});

test('one-time codes reject concurrent replay and expired codes', async () => {
  const user = await localUser('code-owner');
  const code = await codes.issueCode({ userId: user._id, provider: 'google' });
  const results = await Promise.all(Array.from({ length: 4 }, () => codes.exchangeCode(code)));
  assert.equal(results.filter(Boolean).length, 1);
  const expired = await codes.issueCode({ userId: user._id, provider: 'google' });
  await AuthCode.updateOne({ code: expired }, { $set: { expiresAt: new Date(0) } });
  assert.equal(await codes.exchangeCode(expired), null);
});

test('disconnect refuses the final login method and serializes concurrent removals', async () => {
  const user = await User.create({ username: 'two-identities', fullName: 'Synthetic User', email: 'two@example.com', authProvider: 'google' });
  await Identity.create([{ userId: user._id, provider: 'google', providerId: 'google-id' }, { userId: user._id, provider: 'facebook', providerId: 'facebook-id' }]);
  const results = await Promise.allSettled(['google', 'facebook'].map(provider => linking.disconnectIdentity(user._id, provider)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(await Identity.countDocuments(), 1);
});

test('disconnect clears legacy ownership so it cannot silently reattach later', async () => {
  const user = await localUser('legacy-disconnect');
  await User.updateOne({ _id: user._id }, { $set: { 'socialAccounts.google': { id: 'disconnect-subject', isConnected: true } } });
  await linking.disconnectIdentity(user._id, 'google');
  assert.equal((await identities.findByUser(user._id)).length, 0);
  await assert.rejects(auth.loginWithIdentity('google', { ...fakeIdentity('disconnect-subject'), email: user.email }), { code: 'ACCOUNT_LINK_REQUIRED' });
});

test('state survives a different backend instance and callback redirects with a code, never a JWT', async () => {
  const start = await request('/api/auth/google');
  const cookie = cookieFor(start);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const callback = await request(`/api/auth/google/callback?state=${state}`, { cookie, app: 1 });
  const location = new URL(callback.headers.get('location'));
  assert.ok(location.searchParams.get('code'));
  assert.equal(location.searchParams.has('token'), false);
  const exchange = await request('/api/auth/exchange', { method: 'POST', body: { code: location.searchParams.get('code') } });
  assert.equal(exchange.status, 200);
  const data = await exchange.json();
  assert.ok(jwt.verify(data.data.token, process.env.JWT_SECRET).userId);
  assert.equal(data.data.user.passwordHash, undefined);
});

test('invalid callback state creates no user or identity', async () => {
  const start = await request('/api/auth/google');
  const response = await request('/api/auth/google/callback?state=wrong-state', { cookie: cookieFor(start) });
  assert.match(response.headers.get('location'), /OAUTH_STATE_INVALID/);
  assert.equal(await User.countDocuments(), 0);
});

test('Steam callback requires the initiating browser nonce before provider authentication', async () => {
  const missing = await request('/api/auth/steam/return?state=foreign');
  assert.match(missing.headers.get('location'), /OAUTH_STATE_INVALID/);
  const start = await request('/api/auth/steam');
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const success = await request(`/api/auth/steam/return?state=${state}`, { cookie: cookieFor(start), app: 1 });
  assert.ok(new URL(success.headers.get('location')).searchParams.get('code'));
});

test('authenticated connect keeps its intent through initiation and validates callback state', async () => {
  const user = await localUser('connect-owner');
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  const start = await request('/api/accounts/google/connect/start', { method: 'POST', token, body: { redirectPath: '/connected-accounts' } });
  const cookie = cookieFor(start);
  const startBody = await start.json();
  assert.match(startBody.data.connectUrl, /connect=1$/);
  const initiate = await request('/api/auth/google?connect=1', { cookie });
  const state = new URL(initiate.headers.get('location')).searchParams.get('state');
  const result = await request(`/api/auth/google/callback?state=${state}&subject=connected-google`, { cookie, app: 1 });
  assert.match(result.headers.get('location'), /connected=google/);
  assert.equal(String((await Identity.findOne({ providerId: 'connected-google' })).userId), String(user._id));
  assert.equal(await User.countDocuments(), 1);
});

test('connect without a session intent and connect with invalid state cannot link accounts', async () => {
  assert.equal((await request('/api/auth/google?connect=1')).status, 400);
  const user = await localUser('invalid-connect');
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  const start = await request('/api/accounts/google/connect/start', { method: 'POST', token, body: {} });
  const cookie = cookieFor(start);
  await request('/api/auth/google?connect=1', { cookie });
  const callback = await request('/api/auth/google/callback?state=invalid', { cookie });
  assert.match(callback.headers.get('location'), /connect_error/);
  assert.equal(await Identity.countDocuments(), 0);
});

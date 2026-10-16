const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const cloudinary = require('../../config/cloudinary');
const User = require('../../models/User');
const Registration = require('../../models/TournamentRegistration');
const Tournament = require('../../models/Tournament');

let replica, server, base, users, calls, deletes, failUpload, failDestroy, onDestroy;
const original = { upload: cloudinary.uploader.upload_stream, destroy: cloudinary.uploader.destroy };
const secret = 'synthetic-cloudinary-security-tests';
const id = () => new mongoose.Types.ObjectId();

test.before(async () => {
  process.env.JWT_SECRET = secret;
  process.env.REDIS_DISABLED = 'true';
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('cloudinary_security_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false });
  // Exercise the real adapter/Multer while replacing only the remote service boundary.
  cloudinary.uploader.upload_stream = (options, callback) => {
    const chunks = [];
    calls.push({ options, chunks });
    return new Writable({
      write(chunk, encoding, done) { chunks.push(chunk); done(); },
      final(done) {
        if (failUpload) callback(new Error('Synthetic upload failure'));
        else {
          const publicId = `${options.folder}/${options.public_id || randomUUID()}`;
          callback(null, { public_id: publicId, secure_url: `https://res.cloudinary.com/synthetic/image/upload/v1/${publicId}.png`,
            bytes: Buffer.concat(chunks).length, width: 1, height: 1, format: 'png' });
        }
        done();
      }
    });
  };
  cloudinary.uploader.destroy = async (publicId, options, callback) => {
    deletes.push(publicId);
    if (onDestroy) await onDestroy();
    if (failDestroy) throw new Error('Synthetic delete failure');
    if (callback) callback(null, { result: 'ok' });
    return { result: 'ok' };
  };
  const app = express();
  app.use(express.json());
  app.use('/api/upload', require('../../routes/upload'));
  app.use('/api/bgmi-images', require('../../routes/bgmiImageUpload'));
  app.use('/api/auth', require('../../routes/auth'));
  app.use((error, req, res, next) => res.status(400).json({ error: error.message }));
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'cloudinary_security_disposable');
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  calls = []; deletes = []; failUpload = false; failDestroy = false; onDestroy = null;
  users = {};
  for (const role of ['user', 'admin', 'designer', 'moderator']) {
    users[role] = await User.create({ fullName: `Image ${role}`, username: `image-${role}`, email: `${role}@example.com`, authProvider: 'google', role, isActive: true });
  }
});

test.after(async () => {
  cloudinary.uploader.upload_stream = original.upload;
  cloudinary.uploader.destroy = original.destroy;
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

const request = (url, role, options = {}) => fetch(base + url, {
  ...options, headers: { ...(role ? { Authorization: `Bearer ${jwt.sign({ userId: users[role]._id }, secret)}` } : {}), ...options.headers }
});
const upload = (url, role, field = 'avatar', extra = {}, type = 'image/png') => {
  const body = new FormData();
  for (const [key, value] of Object.entries(extra)) body.append(key, value);
  body.append(field, new Blob(['synthetic image'], { type }), 'malicious&overwrite=true.png');
  return request(url, role, { method: 'POST', body });
};

test('SDK signatures distinguish injected ampersand values from additional parameters', () => {
  const sign = params => cloudinary.utils.api_sign_request(params, 'synthetic-secret');
  assert.notEqual(sign({ public_id: 'asset&timestamp=1' }), sign({ public_id: 'asset', timestamp: 1 }));
});

test('missing credentials cannot upload or delete any image', async () => {
  for (const [route, field] of [['avatar', 'avatar'], ['team-logo', 'logo'], ['image', 'image']]) {
    assert.equal((await upload(`/api/upload/${route}`, null, field)).status, 401);
  }
  assert.equal((await request('/api/upload/avatar', null, { method: 'DELETE' })).status, 401);
  assert.equal(calls.length, 0);
  assert.equal(deletes.length, 0);
});

test('site image upload enforces existing content roles before remote work', async () => {
  assert.equal((await upload('/api/upload/image', 'user', 'image')).status, 403);
  assert.equal(calls.length, 0);
  for (const role of ['admin', 'designer', 'moderator']) {
    const response = await upload('/api/upload/image', role, 'image', { folder: 'victim', public_id: 'victim&overwrite=true' });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal(calls.at(-1).options.folder, 'site-images');
    assert.equal(calls.at(-1).options.public_id, undefined);
    assert.ok((await response.json()).data.imageUrl);
  }
});

test('avatar and team logo uploads retain adapter transformations and ignore client SDK parameters', async () => {
  const response = await upload('/api/upload/avatar', 'user', 'avatar', { public_id: 'other-user&overwrite=true', folder: 'victim' });
  assert.equal(response.status, 200, await response.clone().text());
  const user = await User.findById(users.user._id).select('+avatarAsset');
  assert.match(user.avatarAsset.publicId, new RegExp(`^esports/avatars/${user._id}/`));
  assert.equal(user.avatarAsset.url, user.avatarUrl);
  assert.equal(calls[0].options.overwrite, false);
  assert.equal(calls[0].options.transformation[0].width, 500);
  assert.equal((await User.findById(user._id)).avatarAsset, undefined);
  assert.equal((await upload('/api/upload/team-logo', 'user', 'logo')).status, 200);
  assert.equal(calls.at(-1).options.folder, 'esports/team-logos');
  assert.equal(calls.at(-1).options.transformation[0].width, 300);
  assert.equal((await upload('/api/upload/avatar', 'user', 'avatar', {}, 'text/plain')).status, 400);
  assert.equal(calls.length, 2);
});

test('avatar deletion uses the stored owner reference and never request body identifiers', async () => {
  await upload('/api/upload/avatar', 'user');
  const before = await User.findById(users.user._id).select('+avatarAsset');
  const response = await request('/api/upload/avatar', 'user', { method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId: 'other-user&invalidate=true', userId: users.admin._id }) });
  assert.equal(response.status, 200);
  assert.deepEqual(deletes, [before.avatarAsset.publicId]);
  const after = await User.findById(users.user._id).select('+avatarAsset');
  assert.equal(after.avatarUrl, '');
  assert.equal(after.avatarAsset, undefined);
});

test('legacy, external and forged display URLs cannot authorize cloud deletion', async () => {
  for (const url of ['https://evil.example/avatar&public_id=victim.png',
    'https://res.cloudinary.com/synthetic/image/upload/esports/avatars/victim.png',
    'https://res.cloudinary.com/synthetic/image/upload/%26public_id%3Dvictim.png']) {
    await User.updateOne({ _id: users.user._id }, { $set: { avatarUrl: url }, $unset: { avatarAsset: '' } });
    assert.equal((await request('/api/upload/avatar', 'user', { method: 'DELETE' })).status, 200);
  }
  assert.equal(deletes.length, 0);
});

test('profile updates cannot forge server-owned asset references or delete another owner asset', async () => {
  await upload('/api/upload/avatar', 'admin');
  const victim = await User.findById(users.admin._id).select('+avatarAsset');
  const response = await request('/api/auth/profile', 'user', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatarUrl: victim.avatarUrl, avatarAsset: victim.avatarAsset }) });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await User.findById(users.user._id).select('+avatarAsset')).avatarAsset, undefined);
  assert.equal((await request('/api/upload/avatar', 'user', { method: 'DELETE' })).status, 200);
  assert.equal(deletes.length, 0);
  assert.equal((await User.findById(users.admin._id)).avatarUrl, victim.avatarUrl);
});

test('malformed or cross-owner persisted references are rejected before remote calls', async () => {
  for (const publicId of [`esports/avatars/${users.admin._id}/${randomUUID()}`, `esports/avatars/${users.user._id}/x&invalidate=true`]) {
    await User.updateOne({ _id: users.user._id }, { $set: { avatarUrl: 'https://example.com/image.png',
      avatarAsset: { publicId, url: 'https://example.com/image.png' } } });
    assert.equal((await request('/api/upload/avatar', 'user', { method: 'DELETE' })).status, 400);
  }
  assert.equal(deletes.length, 0);
});

test('service failures preserve prior avatar state and failed persistence cleans only the new owned upload', async () => {
  await User.updateOne({ _id: users.user._id }, { avatarUrl: 'https://example.com/legacy.png' });
  failUpload = true;
  assert.equal((await upload('/api/upload/avatar', 'user')).status, 400);
  assert.equal((await User.findById(users.user._id)).avatarUrl, 'https://example.com/legacy.png');
  failUpload = false;
  const update = User.findByIdAndUpdate;
  User.findByIdAndUpdate = () => ({ select: async () => { throw new Error('Synthetic persistence failure'); } });
  try { assert.equal((await upload('/api/upload/avatar', 'user')).status, 500); }
  finally { User.findByIdAndUpdate = update; }
  assert.equal(deletes.length, 1);
  assert.ok(deletes[0].startsWith(`esports/avatars/${users.user._id}/`));
  await upload('/api/upload/avatar', 'user');
  const before = await User.findById(users.user._id).select('+avatarAsset');
  failDestroy = true;
  assert.equal((await request('/api/upload/avatar', 'user', { method: 'DELETE' })).status, 500);
  assert.equal((await User.findById(users.user._id)).avatarUrl, before.avatarUrl);
});

test('concurrent avatar replacement is not cleared by a delayed deletion', async () => {
  await upload('/api/upload/avatar', 'user');
  const replacement = `esports/avatars/${users.user._id}/${randomUUID()}`;
  onDestroy = () => User.updateOne({ _id: users.user._id }, { avatarUrl: 'https://example.com/new.png',
    avatarAsset: { publicId: replacement, url: 'https://example.com/new.png' } });
  assert.equal((await request('/api/upload/avatar', 'user', { method: 'DELETE' })).status, 409);
  assert.equal((await User.findById(users.user._id)).avatarUrl, 'https://example.com/new.png');
});

test('tournament verification uploads preserve owner checks, label validation and SDK options', async () => {
  const tournamentId = id();
  await Tournament.collection.insertOne({ _id: tournamentId, name: 'Synthetic BGMI', gameType: 'bgmi' });
  const registration = await Registration.create({ tournamentId, userId: users.user._id, teamName: 'Synthetic Team',
    teamLeader: { name: 'Leader', bgmiId: '10001', phone: '9876543210' }, whatsappNumber: '9876543210',
    teamMembers: [1, 2, 3].map(i => ({ name: `Member ${i}`, bgmiId: `1000${i + 1}` })) });
  const url = `/api/bgmi-images/${registration._id}/upload`;
  assert.equal((await upload(url, null, 'images', { 'imageLabels[]': 'leader_1' })).status, 401);
  assert.equal((await upload(url, 'admin', 'images', { 'imageLabels[]': 'leader_1' })).status, 403);
  assert.equal((await upload(url, 'user', 'images', { 'imageLabels[]': 'leader&overwrite=true_1' })).status, 400);
  assert.equal(calls.length, 0);
  const response = await upload(url, 'user', 'images', { 'imageLabels[]': 'leader_1' });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal(calls[0].options.folder, `bgmi-verification/${registration._id}`);
  assert.match(calls[0].options.public_id, /^leader_1_\d+$/);
  assert.equal((await Registration.findById(registration._id)).verificationImages.length, 1);
});

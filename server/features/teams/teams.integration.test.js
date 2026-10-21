const test = require('node:test');
const assert = require('node:assert/strict');
require('../game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../../models/User');
const Team = require('../../models/Team');
const Invitation = require('../../models/TeamInvitation');
const Registration = require('../../models/TournamentRegistration');
const Tournament = require('../../models/Tournament');
const Notification = require('../../models/Notification');
const service = require('./teams.service');
let replica, server, base, serial = 0;
const secret = 'synthetic-team-refactor-secret';
const models = [User, Team, Invitation, Registration, Tournament, Notification];
async function player() {
  const row = { _id: new mongoose.Types.ObjectId(), username: `team-${++serial}`, email: `team-${serial}@example.com`, isActive: true, role: 'user' };
  await User.collection.insertOne(row); return row;
}
const request = (path, method = 'GET', body, user) => fetch(base + '/api/teams' + path, {
  method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, secret)}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});
test.before(async () => {
  process.env.JWT_SECRET = secret;
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('teams_refactor_disposable'); assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  for (const Model of models) await Model.createCollection();
  const app = express(); app.use(express.json()); app.use('/api/teams', require('../../routes/teams'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => { assert.equal(mongoose.connection.name, 'teams_refactor_disposable'); for (const Model of models) await Model.deleteMany({}); });
test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (replica) await replica.stop(); });

test('legacy model imports resolve to the same model and collection after relocation', () => {
  assert.equal(Team, require('./team.model')); assert.equal(Invitation, require('./team-invitation.model'));
  assert.equal(Team.collection.name, 'teams'); assert.equal(Invitation.collection.name, 'teaminvitations');
});
test('create, read, captain update and public filtering retain team contracts and roster IDs', async () => {
  const captain = await player(), member = await player(), outsider = await player();
  assert.equal((await request('', 'POST', {})).status, 401);
  const response = await request('', 'POST', { name: 'Refactor Team', game: 'valorant', maxMembers: 3, memberIds: [String(member._id)] }, captain);
  assert.equal(response.status, 201); const team = (await response.json()).data.team;
  assert.equal(team.members.length, 2);
  assert.equal((await request('/' + team._id, 'PUT', { name: 'Forged' }, outsider)).status, 403);
  const update = await request('/' + team._id, 'PUT', { memberIds: [String(member._id)], substituteId: String(member._id) }, captain);
  assert.equal(update.status, 200);
  const stored = await Team.findById(team._id);
  assert.equal(stored.members.length, 2); assert.ok(stored.members.every(row => row.userId));
  assert.equal(stored.members.find(row => String(row.userId) === String(member._id)).isSubstitute, true);
  await Team.updateOne({ _id: team._id }, { privacy: 'private' });
  const list = await (await request('')).json(); assert.equal(list.data.teams.length, 0);
});
test('invitation ownership and active tournament deletion protections survive extraction', async () => {
  const captain = await player(), member = await player(), outsider = await player();
  const team = await service.createTeam(String(captain._id), { name: 'Invitation Team', game: 'valorant', maxMembers: 3 });
  const invite = await service.inviteUserToTeam(team._id, String(captain._id), String(member._id));
  await assert.rejects(service.acceptInvitation(invite._id, String(outsider._id)), { code: 'NOT_YOUR_INVITATION' });
  await service.acceptInvitation(invite._id, String(member._id));
  await assert.rejects(service.acceptInvitation(invite._id, String(member._id)), { code: 'INVITATION_NOT_PENDING' });
  const tournament = { _id: new mongoose.Types.ObjectId(), name: 'Active Cup', status: 'registration_open' };
  await Tournament.collection.insertOne(tournament);
  await Registration.collection.insertOne({ tournamentId: tournament._id, teamId: team._id, userId: captain._id, status: 'pending' });
  await assert.rejects(service.deleteTeam(team._id, String(captain._id)), { code: 'TEAM_IN_ACTIVE_TOURNAMENT' });
  assert.equal((await Team.findById(team._id)).isActive, true);
});

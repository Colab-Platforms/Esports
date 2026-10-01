const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoClient } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const {
  REQUIRED_DB_NAME,
  TARGET_DB_FLAG,
  CONFIRM_FLAG: PREPARE_CONFIRM_FLAG,
  PASSWORD_FLAG,
  createFixturePlan,
  normalizeRiotId,
  prepareFixtures
} = require('./prepareValorantStagingE2EFixtures');
const { validateFixtures } = require('./validateValorantStagingE2E');
const {
  CONFIRM_FLAG: CLEANUP_CONFIRM_FLAG,
  cleanupFixtures
} = require('./cleanupValorantStagingE2EFixtures');

let replSet;
let client;
let seq = 0;

const tmpManifestPath = () => path.join(os.tmpdir(), `valorant-e2e-fixtures-${process.pid}-${++seq}.json`);

const makeEnv = (overrides = {}) => ({
  [TARGET_DB_FLAG]: REQUIRED_DB_NAME,
  [PREPARE_CONFIRM_FLAG]: 'true',
  [CLEANUP_CONFIRM_FLAG]: 'true',
  [PASSWORD_FLAG]: 'fixture-password-only',
  VALORANT_E2E_RUN_ID: `test${seq + 1}`,
  ...overrides
});

const connectDb = async (dbName = REQUIRED_DB_NAME) => {
  if (client) await client.close();
  client = new MongoClient(replSet.getUri(dbName));
  await client.connect();
  return { client, db: client.db(dbName) };
};

test.before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
});

test.afterEach(async () => {
  if (client) {
    await client.db(REQUIRED_DB_NAME).dropDatabase().catch(() => {});
    await client.db('wrong-db').dropDatabase().catch(() => {});
    await client.close();
    client = null;
  }
});

test.after(async () => {
  await replSet.stop();
});

test('DB target mismatch aborts before prepare writes', async () => {
  const ctx = await connectDb('wrong-db');
  await assert.rejects(
    () => prepareFixtures({ client: ctx.client, env: makeEnv(), manifestPath: tmpManifestPath() }),
    /Connected database mismatch/
  );
  assert.equal(await ctx.db.collection('users').countDocuments(), 0);
});

test('dry-run performs no writes and creates no manifest file', async () => {
  const ctx = await connectDb();
  const manifestPath = tmpManifestPath();

  const result = await prepareFixtures({
    client: ctx.client,
    env: makeEnv({ VALORANT_E2E_DRY_RUN: 'true' }),
    manifestPath
  });

  assert.equal(result.dryRun, true);
  assert.equal(fs.existsSync(manifestPath), false);
  assert.equal(await ctx.db.collection('users').countDocuments(), 0);
  assert.equal(await ctx.db.collection('teams').countDocuments(), 0);
  assert.equal(await ctx.db.collection('tournaments').countDocuments(), 0);
  assert.equal(await ctx.db.collection('tournamentregistrations').countDocuments(), 0);
});

test('fixture plan has valid 5+1 rosters, intentional duplicate user, and intentional duplicate Riot ID', () => {
  const plan = createFixturePlan(makeEnv({ VALORANT_E2E_RUN_ID: 'shape1' }));
  const [teamA, teamB, teamC, teamD] = plan.teams;

  for (const team of [teamA, teamB, teamC, teamD]) {
    assert.equal(team.game, 'valorant');
    assert.equal(team.members.filter((member) => !member.isSubstitute).length, 5);
    assert.equal(team.members.filter((member) => member.isSubstitute).length, 1);
    assert.equal(team.members.filter((member) => member.role === 'captain').length, 1);
  }

  const teamAUsers = new Set(teamA.members.map((member) => member.userId.toString()));
  const teamBUsers = teamB.members.map((member) => member.userId.toString());
  assert.ok(teamBUsers.some((userId) => teamAUsers.has(userId)));

  const teamARiotIds = new Set(plan.users
    .filter((user) => teamA.members.some((member) => member.userId.toString() === user._id.toString()))
    .map((user) => normalizeRiotId(user.gameIds.valorant)));
  const teamCRiotIds = plan.users
    .filter((user) => teamC.members.some((member) => member.userId.toString() === user._id.toString()))
    .map((user) => normalizeRiotId(user.gameIds.valorant));
  assert.ok(teamCRiotIds.some((riotId) => teamARiotIds.has(riotId)));
});

test('prepare writes exact manifest IDs and never creates registrations or claims', async () => {
  const ctx = await connectDb();
  const manifestPath = tmpManifestPath();
  const result = await prepareFixtures({
    client: ctx.client,
    env: makeEnv({ VALORANT_E2E_RUN_ID: 'prep1' }),
    manifestPath
  });

  assert.equal(result.dryRun, false);
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.marker, 'VAL_E2E_prep1');
  assert.equal(manifest.users.length, 23);
  assert.equal(manifest.teams.length, 4);
  assert.equal(manifest.tournaments.length, 2);

  assert.equal(await ctx.db.collection('users').countDocuments(), 23);
  assert.equal(await ctx.db.collection('teams').countDocuments(), 4);
  assert.equal(await ctx.db.collection('tournaments').countDocuments(), 2);
  assert.equal(await ctx.db.collection('tournamentregistrations').countDocuments(), 0);
  assert.equal(await ctx.db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext(), false);

  const firstUser = await ctx.db.collection('users').findOne({ _id: result.plan.users[0]._id });
  assert.notEqual(firstUser.passwordHash, 'fixture-password-only');
  assert.match(firstUser.passwordHash, /^\$2/);
});

test('validation is read-only and passes prepared empty registration state', async () => {
  const ctx = await connectDb();
  const manifestPath = tmpManifestPath();
  await prepareFixtures({
    client: ctx.client,
    env: makeEnv({ VALORANT_E2E_RUN_ID: 'val1' }),
    manifestPath
  });
  const before = {
    users: await ctx.db.collection('users').countDocuments(),
    teams: await ctx.db.collection('teams').countDocuments(),
    tournaments: await ctx.db.collection('tournaments').countDocuments()
  };

  const report = await validateFixtures({
    client: ctx.client,
    env: makeEnv(),
    manifestPath
  });

  assert.equal(report.ok, true);
  assert.deepEqual(before, {
    users: await ctx.db.collection('users').countDocuments(),
    teams: await ctx.db.collection('teams').countDocuments(),
    tournaments: await ctx.db.collection('tournaments').countDocuments()
  });
});

test('cleanup dry-run performs no deletes', async () => {
  const ctx = await connectDb();
  const manifestPath = tmpManifestPath();
  await prepareFixtures({
    client: ctx.client,
    env: makeEnv({ VALORANT_E2E_RUN_ID: 'dryclean' }),
    manifestPath
  });

  const result = await cleanupFixtures({
    client: ctx.client,
    env: makeEnv({ VALORANT_E2E_DRY_RUN: 'true' }),
    manifestPath
  });

  assert.equal(result.dryRun, true);
  assert.equal(await ctx.db.collection('users').countDocuments(), 23);
  assert.equal(await ctx.db.collection('teams').countDocuments(), 4);
  assert.equal(await ctx.db.collection('tournaments').countDocuments(), 2);
});

test('cleanup removes only manifest artifacts and rerun is safe', async () => {
  const ctx = await connectDb();
  const manifestPath = tmpManifestPath();
  await prepareFixtures({
    client: ctx.client,
    env: makeEnv({ VALORANT_E2E_RUN_ID: 'clean1' }),
    manifestPath
  });

  const first = await cleanupFixtures({
    client: ctx.client,
    env: makeEnv(),
    manifestPath
  });
  assert.equal(first.dryRun, false);
  assert.equal(await ctx.db.collection('users').countDocuments(), 0);
  assert.equal(await ctx.db.collection('teams').countDocuments(), 0);
  assert.equal(await ctx.db.collection('tournaments').countDocuments(), 0);

  const second = await cleanupFixtures({
    client: ctx.client,
    env: makeEnv(),
    manifestPath
  });
  assert.equal(second.alreadyClean, true);
});

test('unexpected external dependency causes cleanup abort', async () => {
  const ctx = await connectDb();
  const manifestPath = tmpManifestPath();
  const prepared = await prepareFixtures({
    client: ctx.client,
    env: makeEnv({ VALORANT_E2E_RUN_ID: 'block1' }),
    manifestPath
  });

  await ctx.db.collection('teams').insertOne({
    name: 'External Team',
    game: 'valorant',
    captain: prepared.plan.users[0]._id,
    members: [{ userId: prepared.plan.users[0]._id, role: 'captain', isSubstitute: false }],
    maxMembers: 6,
    privacy: 'private',
    isActive: true
  });

  await assert.rejects(
    () => cleanupFixtures({ client: ctx.client, env: makeEnv(), manifestPath }),
    /Cleanup dependency verification failed/
  );
  assert.equal(await ctx.db.collection('users').countDocuments(), 23);
});

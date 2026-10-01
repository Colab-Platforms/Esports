const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const {
  CLAIM_INDEX_NAME,
  REGISTRATION_INDEX_NAME,
  runMigration,
  runPreflight
} = require('./migrateValorantRegistrationClaims');

let replSet;
let client;
let db;
let seq = 0;

const oid = () => new ObjectId();

const freshDbName = () => {
  seq += 1;
  return `valorant_migration_test_${seq}`;
};

const connectFreshDb = async () => {
  if (client) await client.close();
  const dbName = freshDbName();
  client = new MongoClient(replSet.getUri(dbName));
  await client.connect();
  db = client.db(dbName);
  await db.createCollection('tournamentregistrations');
  await db.collection('tournamentregistrations').createIndex(
    { tournamentId: 1, userId: 1 },
    { name: REGISTRATION_INDEX_NAME, unique: true }
  );
  await db.createCollection('tournaments');
  return { client, db, dbName };
};

const uniqueRiot = () => {
  seq += 1;
  return `player${seq}#tag`;
};

const makeRoster = ({ duplicateUser = false, duplicateRiot = false, invalidShape = false } = {}) => {
  const sharedUserId = oid();
  const sharedRiot = uniqueRiot();
  const roster = Array.from({ length: 6 }, (_, index) => ({
    userId: duplicateUser && index === 1 ? sharedUserId : (index === 0 ? sharedUserId : oid()),
    username: `player-${seq}-${index}`,
    riotId: duplicateRiot && index < 2 ? sharedRiot : uniqueRiot(),
    normalizedRiotId: duplicateRiot && index < 2 ? sharedRiot : uniqueRiot(),
    role: index === 5 ? 'substitute' : 'starter'
  }));
  if (invalidShape) roster[5].role = 'starter';
  return roster;
};

const seedValorantRegistration = async ({
  tournamentId,
  teamId = oid(),
  userId = oid(),
  roster = makeRoster(),
  status = 'verified',
  teamName = `Team ${seq}`
} = {}) => {
  const registration = {
    _id: oid(),
    tournamentId,
    userId,
    teamId,
    teamName,
    teamLeader: { name: `${teamName} Captain`, phone: '9876543210', riotId: { name: 'cap', tag: `${seq}` } },
    teamMembers: [1, 2, 3, 4].map((index) => ({ name: `${teamName} ${index}`, riotId: { name: `m${index}`, tag: `${seq}` } })),
    substitutePlayer: { name: `${teamName} Sub`, riotId: { name: 'sub', tag: `${seq}` } },
    roster,
    status,
    whatsappNumber: '9876543210',
    registeredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await db.collection('tournamentregistrations').insertOne(registration);
  return registration;
};

const seedTournament = async ({ currentParticipants = 0 } = {}) => {
  const tournament = {
    _id: oid(),
    name: `Valorant Cup ${seq}`,
    gameType: 'valorant',
    currentParticipants,
    maxParticipants: 16
  };
  await db.collection('tournaments').insertOne(tournament);
  return tournament;
};

const getClaimIndex = async () => {
  const indexes = await db.collection('tournamentregistrationclaims').indexes();
  return indexes.find((index) => index.name === CLAIM_INDEX_NAME);
};

const getRegistrationIndex = async () => {
  const indexes = await db.collection('tournamentregistrations').indexes();
  return indexes.find((index) => index.name === REGISTRATION_INDEX_NAME);
};

test.before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
});

test.afterEach(async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
});

test.after(async () => {
  await replSet.stop();
});

test('zero active registrations creates claim index and non-unique registration index', async () => {
  const ctx = await connectFreshDb();
  await runMigration({ client: ctx.client, expectedDbName: ctx.dbName });

  const claimIndex = await getClaimIndex();
  assert.deepEqual(claimIndex.key, { tournamentId: 1, type: 1, value: 1 });
  assert.equal(claimIndex.unique, true);
  assert.equal(await db.collection('tournamentregistrationclaims').countDocuments(), 0);
  assert.notEqual((await getRegistrationIndex()).unique, true);
});

test('valid active Valorant registration backfills 13 claims', async () => {
  const ctx = await connectFreshDb();
  const tournament = await seedTournament({ currentParticipants: 1 });
  const registration = await seedValorantRegistration({ tournamentId: tournament._id });

  await runMigration({ client: ctx.client, expectedDbName: ctx.dbName });

  const claims = await db.collection('tournamentregistrationclaims').find({ registrationId: registration._id }).toArray();
  assert.equal(claims.length, 13);
  assert.equal(claims.filter((claim) => claim.type === 'team').length, 1);
  assert.equal(claims.filter((claim) => claim.type === 'user').length, 6);
  assert.equal(claims.filter((claim) => claim.type === 'riot').length, 6);
});

test('multiple registrations backfill correct claim counts without conflicts', async () => {
  const ctx = await connectFreshDb();
  const tournament = await seedTournament({ currentParticipants: 2 });
  await seedValorantRegistration({ tournamentId: tournament._id, teamName: 'Alpha' });
  await seedValorantRegistration({ tournamentId: tournament._id, teamName: 'Bravo' });

  await runMigration({ client: ctx.client, expectedDbName: ctx.dbName });

  assert.equal(await db.collection('tournamentregistrationclaims').countDocuments(), 26);
});

test('duplicate user conflict aborts before mutation', async () => {
  await connectFreshDb();
  const tournament = await seedTournament({ currentParticipants: 1 });
  await seedValorantRegistration({ tournamentId: tournament._id, roster: makeRoster({ duplicateUser: true }) });

  const preflight = await runPreflight(db);
  assert.match(JSON.stringify(preflight.conflicts), /platform user IDs are not unique/);
  assert.equal(await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext(), false);
});

test('duplicate normalized Riot conflict aborts before mutation', async () => {
  await connectFreshDb();
  const tournament = await seedTournament({ currentParticipants: 1 });
  await seedValorantRegistration({ tournamentId: tournament._id, roster: makeRoster({ duplicateRiot: true }) });

  const preflight = await runPreflight(db);
  assert.match(JSON.stringify(preflight.conflicts), /normalized Riot IDs are not unique/);
  assert.equal(await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext(), false);
});

test('invalid 5+1 roster aborts before mutation', async () => {
  await connectFreshDb();
  const tournament = await seedTournament({ currentParticipants: 1 });
  await seedValorantRegistration({ tournamentId: tournament._id, roster: makeRoster({ invalidShape: true }) });

  const preflight = await runPreflight(db);
  assert.match(JSON.stringify(preflight.conflicts), /exactly 5 starters/);
  assert.equal(await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext(), false);
});

test('participant-count mismatch aborts before mutation', async () => {
  await connectFreshDb();
  const tournament = await seedTournament({ currentParticipants: 0 });
  await seedValorantRegistration({ tournamentId: tournament._id });

  const preflight = await runPreflight(db);
  assert.match(JSON.stringify(preflight.conflicts), /participant-count mismatch/);
  assert.equal(await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext(), false);
});

test('rerun does not duplicate claims and keeps indexes correct', async () => {
  const ctx = await connectFreshDb();
  const tournament = await seedTournament({ currentParticipants: 1 });
  await seedValorantRegistration({ tournamentId: tournament._id });

  await runMigration({ client: ctx.client, expectedDbName: ctx.dbName });
  await runMigration({ client: ctx.client, expectedDbName: ctx.dbName });

  assert.equal(await db.collection('tournamentregistrationclaims').countDocuments(), 13);
  assert.equal((await getClaimIndex()).unique, true);
  assert.notEqual((await getRegistrationIndex()).unique, true);
});

test('missing registration index is recreated as non-unique', async () => {
  const ctx = await connectFreshDb();
  await db.collection('tournamentregistrations').dropIndex(REGISTRATION_INDEX_NAME);

  await runMigration({ client: ctx.client, expectedDbName: ctx.dbName });

  const index = await getRegistrationIndex();
  assert.ok(index);
  assert.notEqual(index.unique, true);
});

test('incompatible claim index aborts before registration index transition', async () => {
  const ctx = await connectFreshDb();
  await db.createCollection('tournamentregistrationclaims');
  await db.collection('tournamentregistrationclaims').createIndex(
    { tournamentId: 1, type: 1, value: 1 },
    { name: 'wrong_claim_index_name' }
  );

  await assert.rejects(
    () => runMigration({ client: ctx.client, expectedDbName: ctx.dbName }),
    /Incompatible TournamentRegistrationClaim index/
  );
  assert.equal((await getRegistrationIndex()).unique, true);
});

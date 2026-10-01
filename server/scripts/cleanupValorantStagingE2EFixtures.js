require('dotenv').config();

const { MongoClient } = require('mongodb');
const {
  ACTIVE_STATUSES,
  MANIFEST_PATH_FLAG,
  REQUIRED_DB_NAME,
  TARGET_DB_FLAG,
  assertExpectedDb,
  defaultManifestPath,
  toObjectId,
  toIdString
} = require('./prepareValorantStagingE2EFixtures');
const { loadManifest } = require('./validateValorantStagingE2E');

const CONFIRM_FLAG = 'CONFIRM_VALORANT_E2E_CLEANUP';
const DRY_RUN_FLAG = 'VALORANT_E2E_DRY_RUN';
const FIXTURE_TYPE = 'valorant-staging-e2e';

const printJson = (label, value) => {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
};

const isDryRun = (env = process.env) => env[DRY_RUN_FLAG] === 'true';

const assertCleanupEnv = (env = process.env) => {
  if (env[TARGET_DB_FLAG] !== REQUIRED_DB_NAME) {
    throw new Error(`${TARGET_DB_FLAG}=${REQUIRED_DB_NAME} is required`);
  }
  if (env[CONFIRM_FLAG] !== 'true') {
    throw new Error(`${CONFIRM_FLAG}=true is required`);
  }
};

const idsFromManifest = (manifest, key) => (manifest[key] || []).map((entry) => toObjectId(entry.id));

const collectionExists = async (db, name) => db.listCollections({ name }).hasNext();

const loadCleanupTargets = async (db, manifest) => {
  const tournamentIds = idsFromManifest(manifest, 'tournaments');
  const teamIds = idsFromManifest(manifest, 'teams');
  const userIds = idsFromManifest(manifest, 'users');

  const [tournaments, teams, users, registrations] = await Promise.all([
    db.collection('tournaments').find({ _id: { $in: tournamentIds } }).toArray(),
    db.collection('teams').find({ _id: { $in: teamIds } }).toArray(),
    db.collection('users').find({ _id: { $in: userIds } }).toArray(),
    db.collection('tournamentregistrations').find({
      $or: [
        { tournamentId: { $in: tournamentIds } },
        { teamId: { $in: teamIds } },
        { 'roster.userId': { $in: userIds } }
      ]
    }).toArray()
  ]);

  const registrationIds = registrations.map((registration) => registration._id);
  const claims = await collectionExists(db, 'tournamentregistrationclaims')
    ? await db.collection('tournamentregistrationclaims').find({
      $or: [
        { tournamentId: { $in: tournamentIds } },
        { registrationId: { $in: registrationIds } }
      ]
    }).toArray()
    : [];

  const notifications = await collectionExists(db, 'notifications')
    ? await db.collection('notifications').find({
      $or: [
        { user: { $in: userIds } },
        { 'metadata.teamId': { $in: teamIds } },
        { 'metadata.tournamentId': { $in: tournamentIds } },
        { 'metadata.registrationId': { $in: registrationIds } }
      ]
    }).toArray()
    : [];

  const whatsappMessages = await collectionExists(db, 'whatsappmessages')
    ? await db.collection('whatsappmessages').find({ registrationId: { $in: registrationIds } }).toArray()
    : [];

  return {
    tournamentIds,
    teamIds,
    userIds,
    registrationIds,
    tournaments,
    teams,
    users,
    registrations,
    claims,
    notifications,
    whatsappMessages
  };
};

const assertFixtureMarker = (docs, manifest, label, errors) => {
  for (const doc of docs) {
    if (doc.e2eFixture?.type !== FIXTURE_TYPE || doc.e2eFixture?.marker !== manifest.marker) {
      errors.push(`${label} ${toIdString(doc._id)} marker mismatch`);
    }
  }
};

const assertNoUnexpectedDependencies = async (db, manifest, targets) => {
  const errors = [];
  assertFixtureMarker(targets.users, manifest, 'user', errors);
  assertFixtureMarker(targets.teams, manifest, 'team', errors);
  assertFixtureMarker(targets.tournaments, manifest, 'tournament', errors);

  const teamIdSet = new Set(targets.teamIds.map(toIdString));
  const tournamentIdSet = new Set(targets.tournamentIds.map(toIdString));
  const userIdSet = new Set(targets.userIds.map(toIdString));

  for (const registration of targets.registrations) {
    const registrationTeamId = toIdString(registration.teamId);
    const registrationTournamentId = toIdString(registration.tournamentId);
    const rosterUserIds = Array.isArray(registration.roster) ? registration.roster.map((entry) => toIdString(entry.userId)) : [];
    const belongsToFixtureTournament = tournamentIdSet.has(registrationTournamentId);
    const belongsToFixtureTeam = teamIdSet.has(registrationTeamId);
    const rosterOnlyFixtureUsers = rosterUserIds.every((id) => userIdSet.has(id));
    if (!belongsToFixtureTournament && !belongsToFixtureTeam) {
      errors.push(`registration ${toIdString(registration._id)} is not scoped to fixture tournament/team`);
    }
    if (rosterUserIds.length > 0 && !rosterOnlyFixtureUsers) {
      errors.push(`registration ${toIdString(registration._id)} references non-fixture roster users`);
    }
  }

  if (await collectionExists(db, 'teams')) {
    const externalTeamsUsingFixtureUsers = await db.collection('teams').find({
      _id: { $nin: targets.teamIds },
      'members.userId': { $in: targets.userIds },
      'e2eFixture.marker': { $ne: manifest.marker }
    }).project({ _id: 1, name: 1 }).limit(10).toArray();
    if (externalTeamsUsingFixtureUsers.length > 0) {
      errors.push(`fixture users are referenced by non-fixture teams: ${JSON.stringify(externalTeamsUsingFixtureUsers)}`);
    }
  }

  if (errors.length > 0) {
    const error = new Error('Cleanup dependency verification failed');
    error.details = errors;
    throw error;
  }
};

const participantCountsAfterCleanup = async (db, tournamentIds, registrationIds, session = undefined) => {
  const rows = await db.collection('tournamentregistrations').aggregate([
    {
      $match: {
        tournamentId: { $in: tournamentIds },
        _id: { $nin: registrationIds },
        status: { $in: ACTIVE_STATUSES }
      }
    },
    { $group: { _id: '$tournamentId', activeCount: { $sum: 1 } } }
  ], { session }).toArray();
  const counts = new Map(rows.map((row) => [toIdString(row._id), row.activeCount]));
  return tournamentIds.map((tournamentId) => ({
    tournamentId,
    activeCount: counts.get(toIdString(tournamentId)) || 0
  }));
};

const summarizeTargets = (targets) => ({
  tournaments: targets.tournaments.map((doc) => ({ _id: doc._id, name: doc.name })),
  teams: targets.teams.map((doc) => ({ _id: doc._id, name: doc.name })),
  users: targets.users.map((doc) => ({ _id: doc._id, username: doc.username })),
  registrations: targets.registrations.map((doc) => ({
    _id: doc._id,
    tournamentId: doc.tournamentId,
    teamId: doc.teamId,
    status: doc.status
  })),
  claims: targets.claims.length,
  notifications: targets.notifications.length,
  whatsappMessages: targets.whatsappMessages.length
});

const deleteTargets = async (db, targets, session) => {
  const result = {};
  if (await collectionExists(db, 'tournamentregistrationclaims')) {
    result.tournamentregistrationclaims = (await db.collection('tournamentregistrationclaims').deleteMany({
      _id: { $in: targets.claims.map((claim) => claim._id) }
    }, { session })).deletedCount;
  } else {
    result.tournamentregistrationclaims = 0;
  }
  if (await collectionExists(db, 'whatsappmessages')) {
    result.whatsappmessages = (await db.collection('whatsappmessages').deleteMany({
      _id: { $in: targets.whatsappMessages.map((message) => message._id) }
    }, { session })).deletedCount;
  } else {
    result.whatsappmessages = 0;
  }
  if (await collectionExists(db, 'notifications')) {
    result.notifications = (await db.collection('notifications').deleteMany({
      _id: { $in: targets.notifications.map((notification) => notification._id) }
    }, { session })).deletedCount;
  } else {
    result.notifications = 0;
  }

  result.tournamentregistrations = (await db.collection('tournamentregistrations').deleteMany({
    _id: { $in: targets.registrationIds }
  }, { session })).deletedCount;

  const participantCounts = await participantCountsAfterCleanup(db, targets.tournamentIds, targets.registrationIds, session);
  for (const row of participantCounts) {
    await db.collection('tournaments').updateOne(
      { _id: row.tournamentId },
      { $set: { currentParticipants: row.activeCount } },
      { session }
    );
  }

  result.teams = (await db.collection('teams').deleteMany({ _id: { $in: targets.teamIds } }, { session })).deletedCount;
  result.users = (await db.collection('users').deleteMany({ _id: { $in: targets.userIds } }, { session })).deletedCount;
  result.tournaments = (await db.collection('tournaments').deleteMany({ _id: { $in: targets.tournamentIds } }, { session })).deletedCount;
  result.participantCountsAppliedBeforeTournamentDelete = participantCounts;
  return result;
};

async function cleanupFixtures({ client, env = process.env, manifestPath = env[MANIFEST_PATH_FLAG] || defaultManifestPath() }) {
  assertCleanupEnv(env);
  const db = client.db();
  assertExpectedDb(db, env[TARGET_DB_FLAG]);
  const { manifest } = loadManifest(manifestPath);
  if (manifest.database !== db.databaseName) {
    throw new Error(`Manifest database ${manifest.database} does not match connected database ${db.databaseName}`);
  }

  const targets = await loadCleanupTargets(db, manifest);
  printJson('Cleanup target summary', summarizeTargets(targets));

  if (
    targets.tournaments.length === 0 &&
    targets.teams.length === 0 &&
    targets.users.length === 0 &&
    targets.registrations.length === 0 &&
    targets.claims.length === 0
  ) {
    console.log('\nFixture cleanup is already complete. No-op.');
    return { dryRun: isDryRun(env), alreadyClean: true, deletionSummary: {} };
  }

  await assertNoUnexpectedDependencies(db, manifest, targets);

  if (isDryRun(env)) {
    console.log('\nDry run enabled. No writes or deletes were performed.');
    return { dryRun: true, alreadyClean: false, deletionSummary: summarizeTargets(targets) };
  }

  const session = client.startSession();
  let deletionSummary;
  try {
    await session.withTransaction(async () => {
      deletionSummary = await deleteTargets(db, targets, session);
    });
  } finally {
    await session.endSession();
  }

  printJson('Cleanup deletion summary', deletionSummary);
  return { dryRun: false, alreadyClean: false, deletionSummary };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    await cleanupFixtures({ client });
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    if (error.details) printJson('Cleanup error details', error.details);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRM_FLAG,
  assertCleanupEnv,
  assertNoUnexpectedDependencies,
  cleanupFixtures,
  loadCleanupTargets,
  participantCountsAfterCleanup
};

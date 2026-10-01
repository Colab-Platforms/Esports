require('dotenv').config();

const { MongoClient } = require('mongodb');

const ACTIVE_STATUSES = ['pending', 'images_uploaded', 'verified'];
const CONFIRM_FLAG = 'CONFIRM_VALORANT_MIGRATION';
const TARGET_DB_FLAG = 'MIGRATION_TARGET_DB';
const CLAIM_INDEX_NAME = 'uniq_tournament_registration_claim';
const REGISTRATION_INDEX_NAME = 'tournamentId_1_userId_1';
const CLAIM_INDEX_KEY = { tournamentId: 1, type: 1, value: 1 };
const REGISTRATION_INDEX_KEY = { tournamentId: 1, userId: 1 };

const sameKey = (left = {}, right = {}) => (
  Object.keys(left).length === Object.keys(right).length &&
  Object.keys(right).every((key) => left[key] === right[key])
);

const toIdString = (value) => (value ? value.toString() : '');
const claimKey = (claim) => `${toIdString(claim.tournamentId)}|${claim.type}|${claim.value}`;

const responseError = (message, details = undefined) => {
  const error = new Error(message);
  if (details !== undefined) error.details = details;
  return error;
};

const printJson = (label, value) => {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
};

const buildClaimsForRegistration = (registration) => {
  const base = {
    tournamentId: registration.tournamentId,
    registrationId: registration._id
  };
  return [
    { ...base, type: 'team', value: registration.teamId?.toString() },
    ...registration.roster.map((entry) => ({ ...base, type: 'user', value: entry.userId?.toString() })),
    ...registration.roster.map((entry) => ({ ...base, type: 'riot', value: entry.normalizedRiotId }))
  ];
};

const getActiveValorantRegistrations = async (db, session = undefined) => db.collection('tournamentregistrations').aggregate([
  { $match: { status: { $in: ACTIVE_STATUSES } } },
  {
    $lookup: {
      from: 'tournaments',
      localField: 'tournamentId',
      foreignField: '_id',
      as: 'tournament'
    }
  },
  { $unwind: '$tournament' },
  { $match: { 'tournament.gameType': 'valorant' } }
], { session }).toArray();

const getClaimIndexState = async (db) => {
  const collectionExists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  if (!collectionExists) return { collectionExists: false, status: 'missing', indexes: [] };

  const indexes = await db.collection('tournamentregistrationclaims').indexes();
  const byName = indexes.find((index) => index.name === CLAIM_INDEX_NAME);
  const byKey = indexes.find((index) => sameKey(index.key, CLAIM_INDEX_KEY));

  if (byName && sameKey(byName.key, CLAIM_INDEX_KEY) && byName.unique === true) {
    return { collectionExists: true, status: 'correct', index: byName, indexes };
  }
  if (byName) return { collectionExists: true, status: 'incompatible_name', index: byName, indexes };
  if (byKey) return { collectionExists: true, status: 'incompatible_key', index: byKey, indexes };
  return { collectionExists: true, status: 'missing', indexes };
};

const ensureClaimIndex = async (db) => {
  const state = await getClaimIndexState(db);
  if (state.status === 'correct') return state;
  if (state.status === 'incompatible_name' || state.status === 'incompatible_key') {
    throw responseError('Incompatible TournamentRegistrationClaim index exists. Resolve manually before migration.', state);
  }

  await db.collection('tournamentregistrationclaims').createIndex(
    CLAIM_INDEX_KEY,
    { unique: true, name: CLAIM_INDEX_NAME }
  );
  return getClaimIndexState(db);
};

const getRegistrationIndexState = async (db) => {
  const indexes = await db.collection('tournamentregistrations').indexes();
  const byName = indexes.find((index) => index.name === REGISTRATION_INDEX_NAME);
  const byKey = indexes.find((index) => sameKey(index.key, REGISTRATION_INDEX_KEY));

  if (byName && sameKey(byName.key, REGISTRATION_INDEX_KEY) && byName.unique !== true) {
    return { status: 'correct', index: byName, indexes };
  }
  if (byName && sameKey(byName.key, REGISTRATION_INDEX_KEY) && byName.unique === true) {
    return { status: 'expected_unique', index: byName, indexes };
  }
  if (byName) return { status: 'incompatible_name', index: byName, indexes };
  if (byKey && byKey.unique === true) return { status: 'expected_unique', index: byKey, indexes };
  if (byKey && byKey.unique !== true) return { status: 'correct', index: byKey, indexes };
  return { status: 'missing', indexes };
};

const ensureRegistrationIndex = async (db) => {
  const collection = db.collection('tournamentregistrations');
  const state = await getRegistrationIndexState(db);

  if (state.status === 'correct') return state;
  if (state.status === 'incompatible_name') {
    throw responseError('Incompatible TournamentRegistration index with expected name exists. Resolve manually before migration.', state);
  }
  if (state.status === 'expected_unique') {
    await collection.dropIndex(state.index.name);
    try {
      await collection.createIndex(REGISTRATION_INDEX_KEY, { name: REGISTRATION_INDEX_NAME });
    } catch (error) {
      console.error('\nCRITICAL: old unique tournamentId/userId index was dropped but replacement creation failed.');
      console.error('Recovery command:');
      console.error('db.tournamentregistrations.createIndex({ tournamentId: 1, userId: 1 }, { name: "tournamentId_1_userId_1" })');
      throw error;
    }
    return getRegistrationIndexState(db);
  }

  await collection.createIndex(REGISTRATION_INDEX_KEY, { name: REGISTRATION_INDEX_NAME });
  return getRegistrationIndexState(db);
};

const validateRegistrationShapeAndClaims = (registrations) => {
  const conflicts = [];
  const expectedClaims = [];
  const seenClaims = new Map();

  for (const registration of registrations) {
    const registrationId = registration._id;
    if (!registration.tournamentId) conflicts.push({ registrationId, reason: 'missing tournamentId' });
    if (!registration.teamId) conflicts.push({ registrationId, reason: 'missing teamId' });
    if (!Array.isArray(registration.roster)) {
      conflicts.push({ registrationId, reason: 'roster is missing' });
      continue;
    }
    if (registration.roster.length !== 6) {
      conflicts.push({ registrationId, reason: 'roster is not exactly 6 players' });
      continue;
    }

    const starters = registration.roster.filter((entry) => entry.role === 'starter');
    const substitutes = registration.roster.filter((entry) => entry.role === 'substitute');
    const representedCaptains = registration.roster.filter((entry) => entry.role === 'captain');
    if (starters.length !== 5) conflicts.push({ registrationId, reason: 'roster does not contain exactly 5 starters' });
    if (substitutes.length !== 1) conflicts.push({ registrationId, reason: 'roster does not contain exactly 1 substitute' });
    if (representedCaptains.length > 0 && !representedCaptains.every((entry) => entry.role === 'starter')) {
      conflicts.push({ registrationId, reason: 'captain is not a starter' });
    }

    const userIds = registration.roster.map((entry) => entry.userId?.toString()).filter(Boolean);
    const riotIds = registration.roster.map((entry) => entry.normalizedRiotId).filter(Boolean);
    if (userIds.length !== 6) conflicts.push({ registrationId, reason: 'roster does not contain 6 valid platform user IDs' });
    if (new Set(userIds).size !== 6) conflicts.push({ registrationId, reason: 'roster platform user IDs are not unique' });
    if (riotIds.length !== 6) conflicts.push({ registrationId, reason: 'roster does not contain 6 normalized Riot IDs' });
    if (new Set(riotIds).size !== 6) conflicts.push({ registrationId, reason: 'roster normalized Riot IDs are not unique' });

    const claims = buildClaimsForRegistration(registration);
    if (claims.length !== 13 || claims.some((claim) => !claim.tournamentId || !claim.registrationId || !claim.type || !claim.value)) {
      conflicts.push({ registrationId, reason: 'required claim values cannot be generated' });
      continue;
    }
    expectedClaims.push(...claims);

    for (const claim of claims) {
      const key = claimKey(claim);
      const existing = seenClaims.get(key);
      if (existing && existing.toString() !== registrationId.toString()) {
        conflicts.push({
          reason: 'duplicate active claim requirement',
          claim: { tournamentId: claim.tournamentId, type: claim.type, value: claim.value },
          registrationIds: [existing, registrationId]
        });
      } else {
        seenClaims.set(key, registrationId);
      }
    }
  }

  return { conflicts, expectedClaims };
};

const validateExistingClaims = async (db, expectedClaims) => {
  const collectionExists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  if (!collectionExists || expectedClaims.length === 0) return [];

  const expectedByKey = new Map(expectedClaims.map((claim) => [claimKey(claim), claim]));
  const existingClaims = await db.collection('tournamentregistrationclaims').find({
    $or: expectedClaims.map((claim) => ({
      tournamentId: claim.tournamentId,
      type: claim.type,
      value: claim.value
    }))
  }).toArray();

  return existingClaims
    .filter((existing) => {
      const expected = expectedByKey.get(claimKey(existing));
      return expected && existing.registrationId?.toString() !== expected.registrationId.toString();
    })
    .map((existing) => ({
      reason: 'existing claim conflicts with active registration requirement',
      claim: { tournamentId: existing.tournamentId, type: existing.type, value: existing.value },
      existingRegistrationId: existing.registrationId,
      expectedRegistrationId: expectedByKey.get(claimKey(existing)).registrationId
    }));
};

const getParticipantMismatches = async (db, session = undefined) => db.collection('tournaments').aggregate([
  { $match: { gameType: 'valorant' } },
  {
    $lookup: {
      from: 'tournamentregistrations',
      let: { tournamentId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$tournamentId', '$$tournamentId'] },
            status: { $in: ACTIVE_STATUSES }
          }
        },
        { $count: 'activeCount' }
      ],
      as: 'activeRegistrations'
    }
  },
  {
    $addFields: {
      activeRegistrationCount: {
        $ifNull: [{ $arrayElemAt: ['$activeRegistrations.activeCount', 0] }, 0]
      }
    }
  },
  { $match: { $expr: { $ne: ['$currentParticipants', '$activeRegistrationCount'] } } },
  { $project: { name: 1, currentParticipants: 1, activeRegistrationCount: 1 } }
], { session }).toArray();

const runPreflight = async (db) => {
  const registrations = await getActiveValorantRegistrations(db);
  const { conflicts, expectedClaims } = validateRegistrationShapeAndClaims(registrations);
  const existingClaimConflicts = await validateExistingClaims(db, expectedClaims);
  const participantMismatches = await getParticipantMismatches(db);
  const allConflicts = [...conflicts, ...existingClaimConflicts];
  if (participantMismatches.length > 0) {
    allConflicts.push({ reason: 'participant-count mismatch', mismatches: participantMismatches });
  }
  return { registrations, expectedClaims, conflicts: allConflicts, participantMismatches };
};

const backfillClaims = async (db, session, registrations) => {
  const claimsCollection = db.collection('tournamentregistrationclaims');
  let inserted = 0;
  let skipped = 0;

  for (const registration of registrations) {
    const claims = buildClaimsForRegistration(registration).map((claim) => ({
      ...claim,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    for (const claim of claims) {
      const result = await claimsCollection.updateOne(
        { tournamentId: claim.tournamentId, type: claim.type, value: claim.value },
        { $setOnInsert: claim },
        { upsert: true, session }
      );
      if (result.upsertedCount === 1) inserted += 1;
      else skipped += 1;
    }
  }

  return { inserted, skipped };
};

const getClaimCount = async (db) => {
  const collectionExists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  if (!collectionExists) return 0;
  return db.collection('tournamentregistrationclaims').countDocuments();
};

const getDuplicateClaims = async (db) => {
  const collectionExists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  if (!collectionExists) return [];
  return db.collection('tournamentregistrationclaims').aggregate([
    {
      $group: {
        _id: { tournamentId: '$tournamentId', type: '$type', value: '$value' },
        count: { $sum: 1 },
        registrationIds: { $addToSet: '$registrationId' }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
};

const getOrphanClaims = async (db) => {
  const collectionExists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  if (!collectionExists) return [];
  return db.collection('tournamentregistrationclaims').aggregate([
    {
      $lookup: {
        from: 'tournamentregistrations',
        localField: 'registrationId',
        foreignField: '_id',
        as: 'registration'
      }
    },
    { $unwind: { path: '$registration', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'tournaments',
        localField: 'registration.tournamentId',
        foreignField: '_id',
        as: 'tournament'
      }
    },
    { $unwind: { path: '$tournament', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { registration: null },
          { 'registration.status': { $nin: ACTIVE_STATUSES } },
          { 'tournament.gameType': { $ne: 'valorant' } }
        ]
      }
    },
    { $project: { tournamentId: 1, type: 1, value: 1, registrationId: 1 } }
  ]).toArray();
};

const verifyClaimsForActiveRegistrations = async (db, registrations) => {
  const collectionExists = await db.listCollections({ name: 'tournamentregistrationclaims' }).hasNext();
  const conflicts = [];
  if (!collectionExists && registrations.length > 0) return [{ reason: 'claim collection missing after migration' }];

  for (const registration of registrations) {
    const claims = collectionExists
      ? await db.collection('tournamentregistrationclaims').find({ registrationId: registration._id }).toArray()
      : [];
    const counts = {
      team: claims.filter((claim) => claim.type === 'team').length,
      user: claims.filter((claim) => claim.type === 'user').length,
      riot: claims.filter((claim) => claim.type === 'riot').length
    };
    if (claims.length !== 13 || counts.team !== 1 || counts.user !== 6 || counts.riot !== 6) {
      conflicts.push({ registrationId: registration._id, reason: 'incorrect claim count', counts, total: claims.length });
    }
  }
  return conflicts;
};

const verifyPostMigration = async (db) => {
  const registrations = await getActiveValorantRegistrations(db);
  const claimIndexState = await getClaimIndexState(db);
  const registrationIndexState = await getRegistrationIndexState(db);
  const claimCount = await getClaimCount(db);
  const expectedClaimCount = registrations.length * 13;
  const duplicateClaims = await getDuplicateClaims(db);
  const orphanClaims = await getOrphanClaims(db);
  const participantMismatches = await getParticipantMismatches(db);
  const registrationClaimConflicts = await verifyClaimsForActiveRegistrations(db, registrations);

  const errors = [];
  if (claimIndexState.status !== 'correct') errors.push({ reason: 'claim index is not correct', claimIndexState });
  if (registrationIndexState.status !== 'correct') errors.push({ reason: 'registration index is not correct', registrationIndexState });
  if (claimCount !== expectedClaimCount) errors.push({ reason: 'claim count mismatch', claimCount, expectedClaimCount });
  if (duplicateClaims.length > 0) errors.push({ reason: 'duplicate claim keys found', duplicateClaims });
  if (orphanClaims.length > 0) errors.push({ reason: 'orphan claims found', orphanClaims });
  if (participantMismatches.length > 0) errors.push({ reason: 'participant-count mismatch', participantMismatches });
  errors.push(...registrationClaimConflicts);

  return {
    ok: errors.length === 0,
    errors,
    activeValorantRegistrations: registrations.length,
    claimCount,
    expectedClaimCount,
    claimIndexState,
    registrationIndexState,
    participantMismatches
  };
};

const getReport = async (db, transactionCapable = null) => {
  const registrations = await getActiveValorantRegistrations(db);
  return {
    connectedDb: db.databaseName,
    transactionCapable,
    activeValorantRegistrations: registrations.length,
    existingClaimCount: await getClaimCount(db),
    claimIndexState: await getClaimIndexState(db),
    registrationIndexState: await getRegistrationIndexState(db),
    participantMismatches: await getParticipantMismatches(db)
  };
};

const runMigration = async ({ client, expectedDbName }) => {
  const db = client.db();
  const actualDbName = db.databaseName;
  console.log(`Expected migration DB: ${expectedDbName}`);
  console.log(`Actual connected DB: ${actualDbName}`);
  if (!expectedDbName || actualDbName !== expectedDbName) {
    throw new Error(`Migration DB mismatch. Expected ${expectedDbName || '<missing>'}, got ${actualDbName}.`);
  }

  const hello = await db.admin().command({ hello: 1 });
  const transactionCapable = Boolean(hello.setName || hello.msg === 'isdbgrid');
  if (!transactionCapable) {
    throw new Error('MongoDB must be a replica set or sharded cluster for transaction-backed migration');
  }

  const before = await getReport(db, transactionCapable);
  printJson('BEFORE migration report', before);

  const preflight = await runPreflight(db);
  if (preflight.conflicts.length > 0) {
    printJson('Preflight conflicts', preflight.conflicts);
    throw new Error('Preflight failed. No migration writes or index mutations were performed.');
  }

  await ensureClaimIndex(db);

  const session = client.startSession();
  let backfillResult;
  try {
    await session.withTransaction(async () => {
      backfillResult = await backfillClaims(db, session, preflight.registrations);
    });
  } finally {
    await session.endSession();
  }

  await ensureRegistrationIndex(db);

  const verification = await verifyPostMigration(db);
  const after = await getReport(db, transactionCapable);
  printJson('AFTER migration report', {
    ...after,
    expectedClaimCount: verification.expectedClaimCount,
    verificationResult: verification.ok ? 'passed' : 'failed'
  });

  if (!verification.ok) {
    printJson('Post-migration verification errors', verification.errors);
    const error = new Error('MIGRATION COMPLETED WITH VERIFICATION FAILURE');
    error.verification = verification;
    throw error;
  }

  console.log(JSON.stringify({
    success: true,
    activeValorantRegistrations: preflight.registrations.length,
    claimsInserted: backfillResult.inserted,
    claimsAlreadyPresent: backfillResult.skipped
  }, null, 2));

  return { before, after, preflight, verification, backfillResult };
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (process.env[CONFIRM_FLAG] !== 'true') {
    throw new Error(`${CONFIRM_FLAG}=true is required. This migration changes indexes and backfills claims.`);
  }
  if (!process.env[TARGET_DB_FLAG]) {
    throw new Error(`${TARGET_DB_FLAG}=<expected database name> is required.`);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    await runMigration({ client, expectedDbName: process.env[TARGET_DB_FLAG] });
  } catch (error) {
    if (error.message === 'MIGRATION COMPLETED WITH VERIFICATION FAILURE') console.error(error.message);
    else console.error(error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  ACTIVE_STATUSES,
  CLAIM_INDEX_KEY,
  CLAIM_INDEX_NAME,
  REGISTRATION_INDEX_KEY,
  REGISTRATION_INDEX_NAME,
  buildClaimsForRegistration,
  ensureClaimIndex,
  ensureRegistrationIndex,
  getActiveValorantRegistrations,
  getClaimIndexState,
  getParticipantMismatches,
  getRegistrationIndexState,
  runMigration,
  runPreflight,
  validateRegistrationShapeAndClaims,
  verifyPostMigration
};

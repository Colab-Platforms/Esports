require('dotenv').config();

const { MongoClient, ObjectId } = require('mongodb');

const CONFIRM_FLAG = 'CONFIRM_VALORANT_STAGING_CLEANUP';
const REQUIRED_DB_NAME = 'colab-esports-dev';
const ACTIVE_STATUSES = ['pending', 'images_uploaded', 'verified'];

const TARGETS = [
  {
    _id: new ObjectId('6ab12ea951f3ee2fb71d0e89'),
    tournamentId: new ObjectId('6ab12ea951f3ee2fb71d0e78'),
    teamName: 'Phase 4 Valorant A',
    teamId: null,
    userId: new ObjectId('6ab12ea951f3ee2fb71d0e63')
  },
  {
    _id: new ObjectId('6ab12eaa51f3ee2fb71d0e9a'),
    tournamentId: new ObjectId('6ab12ea951f3ee2fb71d0e78'),
    teamName: 'Phase 4 Valorant B',
    teamId: null,
    userId: new ObjectId('6ab12ea951f3ee2fb71d0e6c')
  },
  {
    _id: new ObjectId('6ab37419c50955917dc23677'),
    tournamentId: new ObjectId('6ab37418c50955917dc23676'),
    teamName: 'Phase 6 Valorant A',
    teamId: new ObjectId('6ab37418c50955917dc23674'),
    userId: new ObjectId('6ab37418c50955917dc2366a')
  },
  {
    _id: new ObjectId('6ab37419c50955917dc23678'),
    tournamentId: new ObjectId('6ab37418c50955917dc23676'),
    teamName: 'Phase 6 Valorant B',
    teamId: new ObjectId('6ab37418c50955917dc23675'),
    userId: new ObjectId('6ab37418c50955917dc2366b')
  }
];

const TARGET_IDS = TARGETS.map((target) => target._id);
const TARGET_ID_STRINGS = new Set(TARGETS.map((target) => target._id.toString()));
const TARGET_BY_ID = new Map(TARGETS.map((target) => [target._id.toString(), target]));

const MATCH_RESULT_TARGETS = [
  {
    _id: new ObjectId('6ab12eaa51f3ee2fb71d0ec9'),
    tournamentId: new ObjectId('6ab12ea951f3ee2fb71d0e78'),
    matchNumber: 9401,
    status: 'verified',
    teamA: {
      registrationId: new ObjectId('6ab12ea951f3ee2fb71d0e89'),
      teamNameSnapshot: 'Phase 4 Valorant A',
      score: 13
    },
    teamB: {
      registrationId: new ObjectId('6ab12eaa51f3ee2fb71d0e9a'),
      teamNameSnapshot: 'Phase 4 Valorant B',
      score: 8
    },
    winnerRegistrationId: new ObjectId('6ab12ea951f3ee2fb71d0e89')
  },
  {
    _id: new ObjectId('6ab37419c50955917dc23679'),
    tournamentId: new ObjectId('6ab37418c50955917dc23676'),
    matchNumber: 6,
    status: 'verified',
    teamA: {
      registrationId: new ObjectId('6ab37419c50955917dc23677'),
      teamNameSnapshot: 'Phase 6 Valorant A',
      score: 13
    },
    teamB: {
      registrationId: new ObjectId('6ab37419c50955917dc23678'),
      teamNameSnapshot: 'Phase 6 Valorant B',
      score: 8
    },
    winnerRegistrationId: new ObjectId('6ab37419c50955917dc23677')
  }
];

const MATCH_RESULT_IDS = MATCH_RESULT_TARGETS.map((target) => target._id);
const MATCH_RESULT_ID_STRINGS = new Set(MATCH_RESULT_TARGETS.map((target) => target._id.toString()));
const MATCH_RESULT_BY_ID = new Map(MATCH_RESULT_TARGETS.map((target) => [target._id.toString(), target]));

const REFERENCE_PATHS = [
  'registrationId',
  'teamA.registrationId',
  'teamB.registrationId',
  'winnerRegistrationId',
  'teamResults.registrationId',
  'winner.registrationId',
  'podium.registrationId',
  'standings.registrationId',
  'metadata.registrationId'
];

const MATCH_RESULT_REFERENCE_PATHS = [
  'matchResultId',
  'valorantMatchResultId',
  'resultId',
  'matchId',
  'metadata.matchResultId',
  'metadata.valorantMatchResultId',
  'metadata.resultId',
  'metadata.matchId'
];

const DISPOSABLE_REFERENCE_COLLECTIONS = new Set([
  'tournamentregistrationclaims',
  'whatsappmessages'
]);

const PROTECTED_COLLECTIONS = new Set([
  'users',
  'teams',
  'tournaments',
  'identities'
]);

const toIdString = (value) => (value ? value.toString() : null);

const sameObjectId = (left, right) => {
  if (left === null || right === null) return left === right;
  return Boolean(left && right && left.toString() === right.toString());
};

const getRosterLength = (roster) => {
  if (roster == null) return 0;
  if (typeof roster.length === 'number') return roster.length;
  return null;
};

const isEmptyLegacyRoster = (roster) => {
  const length = getRosterLength(roster);
  return length === 0;
};

const printJson = (label, value) => {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
};

const referenceQuery = () => ({
  $or: REFERENCE_PATHS.map((path) => ({ [path]: { $in: TARGET_IDS } }))
});

const collectionExists = async (db, name) => {
  const matches = await db.listCollections({ name }).toArray();
  return matches.length > 0;
};

const loadTargetRegistrations = async (db, session = undefined) => db.collection('tournamentregistrations')
  .find({ _id: { $in: TARGET_IDS } }, { session })
  .toArray();

const loadTargetMatchResults = async (db, session = undefined) => db.collection('valorantmatchresults')
  .find({ _id: { $in: MATCH_RESULT_IDS } }, { session })
  .toArray();

const loadTargetTournaments = async (db, registrations, session = undefined) => {
  const tournamentIds = [...new Set(registrations.map((registration) => registration.tournamentId.toString()))]
    .map((id) => new ObjectId(id));
  if (tournamentIds.length === 0) return [];
  return db.collection('tournaments')
    .find({ _id: { $in: tournamentIds } }, { session })
    .project({ name: 1, gameType: 1, currentParticipants: 1 })
    .toArray();
};

const summarizeRegistrations = (registrations, tournaments) => {
  const tournamentById = new Map(tournaments.map((tournament) => [tournament._id.toString(), tournament]));
  return registrations.map((registration) => {
    const tournament = tournamentById.get(registration.tournamentId.toString());
    return {
      _id: registration._id,
      tournamentId: registration.tournamentId,
      tournamentGameType: tournament?.gameType || null,
      status: registration.status,
      teamName: registration.teamName,
      teamId: registration.teamId || null,
      userId: registration.userId,
      rosterSize: getRosterLength(registration.roster) || 0,
      teamLeaderName: registration.teamLeader?.name || null,
      teamMemberCount: Array.isArray(registration.teamMembers) ? registration.teamMembers.length : 0,
      hasSubstitute: Boolean(registration.substitutePlayer)
    };
  });
};

const verifyExpectedRegistrations = (registrations, tournaments) => {
  if (registrations.length === 0) {
    return { allAbsent: true, errors: [] };
  }

  if (registrations.length !== TARGETS.length) {
    return {
      allAbsent: false,
      errors: [`Expected either all ${TARGETS.length} target records or none; found ${registrations.length}. Aborting to avoid partial cleanup.`]
    };
  }

  const errors = [];
  const tournamentById = new Map(tournaments.map((tournament) => [tournament._id.toString(), tournament]));

  for (const registration of registrations) {
    const id = registration._id.toString();
    const expected = TARGET_BY_ID.get(id);
    if (!expected || !TARGET_ID_STRINGS.has(id)) {
      errors.push(`Registration ${id} is not allowlisted`);
      continue;
    }

    const tournament = tournamentById.get(registration.tournamentId?.toString());
    if (registration.status !== 'verified') errors.push(`${id}: status is ${registration.status}, expected verified`);
    if (!tournament || tournament.gameType !== 'valorant') errors.push(`${id}: tournament is not Valorant`);
    if (!isEmptyLegacyRoster(registration.roster)) errors.push(`${id}: roster is not empty`);
    if (registration.teamName !== expected.teamName) errors.push(`${id}: teamName mismatch`);
    if (!sameObjectId(registration.tournamentId, expected.tournamentId)) errors.push(`${id}: tournamentId mismatch`);
    if (!sameObjectId(registration.teamId || null, expected.teamId)) errors.push(`${id}: teamId mismatch`);
    if (!sameObjectId(registration.userId, expected.userId)) errors.push(`${id}: userId mismatch`);
    if (!Array.isArray(registration.teamMembers) || registration.teamMembers.length !== 4) {
      errors.push(`${id}: expected 4 legacy teamMembers`);
    }
    if (registration.substitutePlayer) errors.push(`${id}: expected no legacy substitutePlayer`);
  }

  return { allAbsent: false, errors };
};

const summarizeMatchResults = (matchResults) => matchResults.map((result) => ({
  _id: result._id,
  tournamentId: result.tournamentId,
  matchNumber: result.matchNumber,
  status: result.status,
  teamA: {
    registrationId: result.teamA?.registrationId || null,
    teamNameSnapshot: result.teamA?.teamNameSnapshot || '',
    score: result.teamA?.score ?? null
  },
  teamB: {
    registrationId: result.teamB?.registrationId || null,
    teamNameSnapshot: result.teamB?.teamNameSnapshot || '',
    score: result.teamB?.score ?? null
  },
  winnerRegistrationId: result.winnerRegistrationId || null,
  createdAt: result.createdAt || null,
  updatedAt: result.updatedAt || null
}));

const getMatchResultRegistrationIds = (result) => [
  result.teamA?.registrationId,
  result.teamB?.registrationId,
  result.winnerRegistrationId
].filter(Boolean).map((id) => id.toString());

const verifyExpectedMatchResults = (matchResults) => {
  if (matchResults.length !== MATCH_RESULT_TARGETS.length) {
    return {
      errors: [`Expected ${MATCH_RESULT_TARGETS.length} target ValorantMatchResult documents; found ${matchResults.length}.`]
    };
  }

  const errors = [];
  for (const result of matchResults) {
    const id = result._id.toString();
    const expected = MATCH_RESULT_BY_ID.get(id);
    if (!expected || !MATCH_RESULT_ID_STRINGS.has(id)) {
      errors.push(`ValorantMatchResult ${id} is not allowlisted`);
      continue;
    }

    const registrationIds = getMatchResultRegistrationIds(result);
    if (!registrationIds.every((registrationId) => TARGET_ID_STRINGS.has(registrationId))) {
      errors.push(`${id}: references a registration outside the four allowlisted test registrations`);
    }
    if (!sameObjectId(result.tournamentId, expected.tournamentId)) errors.push(`${id}: tournamentId mismatch`);
    if (result.matchNumber !== expected.matchNumber) errors.push(`${id}: matchNumber mismatch`);
    if (result.status !== expected.status) errors.push(`${id}: status is ${result.status}, expected ${expected.status}`);
    if (!sameObjectId(result.teamA?.registrationId, expected.teamA.registrationId)) errors.push(`${id}: teamA.registrationId mismatch`);
    if (!sameObjectId(result.teamB?.registrationId, expected.teamB.registrationId)) errors.push(`${id}: teamB.registrationId mismatch`);
    if (!sameObjectId(result.winnerRegistrationId, expected.winnerRegistrationId)) errors.push(`${id}: winnerRegistrationId mismatch`);
    if (result.teamA?.teamNameSnapshot !== expected.teamA.teamNameSnapshot) errors.push(`${id}: teamA.teamNameSnapshot mismatch`);
    if (result.teamB?.teamNameSnapshot !== expected.teamB.teamNameSnapshot) errors.push(`${id}: teamB.teamNameSnapshot mismatch`);
    if (result.teamA?.score !== expected.teamA.score) errors.push(`${id}: teamA.score mismatch`);
    if (result.teamB?.score !== expected.teamB.score) errors.push(`${id}: teamB.score mismatch`);
  }

  return { errors };
};

const isCleanupAlreadyComplete = (registrations, matchResults) => (
  registrations.length === 0 && matchResults.length === 0
);

const findReferences = async (db, session = undefined) => {
  const collections = await db.listCollections().toArray();
  const references = [];
  const query = referenceQuery();

  for (const { name } of collections) {
    const collection = db.collection(name);
    const matches = await collection
      .find(query, { session })
      .project({ _id: 1 })
      .limit(20)
      .toArray();
    const count = matches.length === 0 ? 0 : await collection.countDocuments(query, { session });
    if (count > 0) {
      references.push({
        collection: name,
        count,
        sampleIds: matches.map((doc) => doc._id)
      });
    }
  }

  return references;
};

const findMatchResultReferences = async (db, session = undefined) => {
  const collections = await db.listCollections().toArray();
  const references = [];
  const query = {
    $or: MATCH_RESULT_REFERENCE_PATHS.map((path) => ({ [path]: { $in: MATCH_RESULT_IDS } }))
  };

  for (const { name } of collections) {
    const collection = db.collection(name);
    const matches = await collection
      .find(query, { session })
      .project({ _id: 1 })
      .limit(20)
      .toArray();
    const count = matches.length === 0 ? 0 : await collection.countDocuments(query, { session });
    if (count > 0) {
      references.push({
        collection: name,
        count,
        sampleIds: matches.map((doc) => doc._id)
      });
    }
  }

  return references;
};

const isAllowedValorantMatchResultReference = (reference) => (
  reference.collection === 'valorantmatchresults' &&
  reference.count === MATCH_RESULT_TARGETS.length &&
  reference.sampleIds.every((id) => MATCH_RESULT_ID_STRINGS.has(id.toString()))
);

const assertNoBlockingReferences = (references) => {
  const blocking = references.filter((reference) => (
    !DISPOSABLE_REFERENCE_COLLECTIONS.has(reference.collection) &&
    reference.collection !== 'tournamentregistrations' &&
    !isAllowedValorantMatchResultReference(reference)
  ));
  if (blocking.length > 0) {
    throw new Error(`Blocking references found outside disposable collections: ${JSON.stringify(blocking)}`);
  }
};

const assertNoMatchResultReverseDependencies = (references) => {
  if (references.length > 0) {
    throw new Error(`Blocking ValorantMatchResult reverse dependencies found: ${JSON.stringify(references)}`);
  }
};

const countActiveRegistrationsByTournament = async (db, tournamentIds, session) => {
  const rows = await db.collection('tournamentregistrations').aggregate([
    {
      $match: {
        tournamentId: { $in: tournamentIds },
        status: { $in: ACTIVE_STATUSES }
      }
    },
    {
      $group: {
        _id: '$tournamentId',
        activeCount: { $sum: 1 }
      }
    }
  ], { session }).toArray();

  const counts = new Map(rows.map((row) => [row._id.toString(), row.activeCount]));
  return tournamentIds.map((tournamentId) => ({
    tournamentId,
    activeCount: counts.get(tournamentId.toString()) || 0
  }));
};

const deleteDisposableReferences = async (db, session) => {
  const deletions = {};

  if (await collectionExists(db, 'tournamentregistrationclaims')) {
    const result = await db.collection('tournamentregistrationclaims')
      .deleteMany({ registrationId: { $in: TARGET_IDS } }, { session });
    deletions.tournamentregistrationclaims = result.deletedCount;
  } else {
    deletions.tournamentregistrationclaims = 0;
  }

  if (await collectionExists(db, 'whatsappmessages')) {
    const result = await db.collection('whatsappmessages')
      .deleteMany({ registrationId: { $in: TARGET_IDS } }, { session });
    deletions.whatsappmessages = result.deletedCount;
  } else {
    deletions.whatsappmessages = 0;
  }

  return deletions;
};

const deleteTargetMatchResults = async (db, session) => {
  const result = await db.collection('valorantmatchresults')
    .deleteMany({ _id: { $in: MATCH_RESULT_IDS } }, { session });
  return result.deletedCount;
};

async function main() {
  if (process.env[CONFIRM_FLAG] !== 'true') {
    throw new Error(`${CONFIRM_FLAG}=true is required`);
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  try {
    const db = client.db();
    if (db.databaseName !== REQUIRED_DB_NAME) {
      throw new Error(`Connected database is ${db.databaseName}; expected ${REQUIRED_DB_NAME}. Aborting.`);
    }

    const beforeRegistrations = await loadTargetRegistrations(db);
    const beforeTournaments = await loadTargetTournaments(db, beforeRegistrations);
    printJson('BEFORE target registration summary', summarizeRegistrations(beforeRegistrations, beforeTournaments));

    const verification = verifyExpectedRegistrations(beforeRegistrations, beforeTournaments);
    if (verification.allAbsent) {
      const existingMatchResults = await loadTargetMatchResults(db);
      if (isCleanupAlreadyComplete(beforeRegistrations, existingMatchResults)) {
        console.log('\nAll four target registrations and both target ValorantMatchResults are already absent. No cleanup needed.');
        return;
      }
      printJson('ABORT orphan target ValorantMatchResults', summarizeMatchResults(existingMatchResults));
      throw new Error('Target registrations are absent but target ValorantMatchResults remain. Review manually.');
    }
    if (verification.errors.length > 0) {
      printJson('ABORT verification errors', verification.errors);
      throw new Error('Target verification failed. Deleted nothing.');
    }

    const beforeMatchResults = await loadTargetMatchResults(db);
    printJson('BEFORE target ValorantMatchResult summary', summarizeMatchResults(beforeMatchResults));
    const matchResultVerification = verifyExpectedMatchResults(beforeMatchResults);
    if (matchResultVerification.errors.length > 0) {
      printJson('ABORT ValorantMatchResult verification errors', matchResultVerification.errors);
      throw new Error('Target ValorantMatchResult verification failed. Deleted nothing.');
    }

    const references = await findReferences(db);
    printJson('References found before cleanup', references);
    assertNoBlockingReferences(references);

    const matchResultReferences = await findMatchResultReferences(db);
    printJson('ValorantMatchResult reverse dependencies before cleanup', matchResultReferences);
    assertNoMatchResultReverseDependencies(matchResultReferences);

    const affectedTournamentIds = [...new Set(beforeRegistrations.map((registration) => registration.tournamentId.toString()))]
      .map((id) => new ObjectId(id));

    const session = client.startSession();
    let afterCounts = [];
    let deletionSummary = {};
    try {
      await session.withTransaction(async () => {
        deletionSummary = await deleteDisposableReferences(db, session);

        deletionSummary.valorantmatchresults = await deleteTargetMatchResults(db, session);
        if (deletionSummary.valorantmatchresults !== MATCH_RESULT_TARGETS.length) {
          throw new Error(`Expected to delete ${MATCH_RESULT_TARGETS.length} ValorantMatchResults, deleted ${deletionSummary.valorantmatchresults}`);
        }

        const registrationDelete = await db.collection('tournamentregistrations')
          .deleteMany({ _id: { $in: TARGET_IDS } }, { session });
        if (registrationDelete.deletedCount !== TARGETS.length) {
          throw new Error(`Expected to delete ${TARGETS.length} registrations, deleted ${registrationDelete.deletedCount}`);
        }
        deletionSummary.tournamentregistrations = registrationDelete.deletedCount;

        afterCounts = await countActiveRegistrationsByTournament(db, affectedTournamentIds, session);
        for (const row of afterCounts) {
          await db.collection('tournaments').updateOne(
            { _id: row.tournamentId },
            { $set: { currentParticipants: row.activeCount } },
            { session }
          );
        }
      });
    } finally {
      await session.endSession();
    }

    const afterRegistrations = await loadTargetRegistrations(db);
    const afterMatchResults = await loadTargetMatchResults(db);
    const afterTournaments = await db.collection('tournaments')
      .find({ _id: { $in: affectedTournamentIds } })
      .project({ name: 1, gameType: 1, currentParticipants: 1 })
      .toArray();

    printJson('Deletion summary', deletionSummary);
    printJson('AFTER target registrations remaining', afterRegistrations.map((registration) => registration._id));
    printJson('AFTER target ValorantMatchResults remaining', afterMatchResults.map((result) => result._id));
    printJson('AFTER active-registration counts applied', afterCounts);
    printJson('AFTER affected tournament participant fields', afterTournaments.map((tournament) => ({
      _id: tournament._id,
      name: tournament.name,
      gameType: tournament.gameType,
      currentParticipants: tournament.currentParticipants
    })));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  getRosterLength,
  isEmptyLegacyRoster,
  isCleanupAlreadyComplete,
  verifyExpectedRegistrations,
  verifyExpectedMatchResults,
  assertNoBlockingReferences,
  assertNoMatchResultReverseDependencies
};

require('dotenv').config();

const { MongoClient } = require('mongodb');

const CONFIRM_FLAG = 'CONFIRM_VALORANT_PAYMENT_SCHEMA_BACKFILL';
const TARGET_DB_FLAG = 'MIGRATION_TARGET_DB';
const CLAIM_INDEX_NAME = 'uniq_tournament_registration_claim';
const CLAIM_INDEX_KEY = { tournamentId: 1, type: 1, value: 1 };

const sameKey = (left = {}, right = {}) => (
  Object.keys(left).length === Object.keys(right).length &&
  Object.keys(right).every((key) => left[key] === right[key])
);

const printJson = (label, value) => {
  console.log(`\n## ${label}`);
  console.log(JSON.stringify(value, null, 2));
};

const getCollection = async (db, name) => {
  const exists = await db.listCollections({ name }).hasNext();
  return exists ? db.collection(name) : null;
};

const getClaimIndexState = async (db) => {
  const collection = await getCollection(db, 'tournamentregistrationclaims');
  if (!collection) return { collectionExists: false, status: 'missing_collection', indexes: [] };

  const indexes = await collection.indexes();
  const byName = indexes.find((index) => index.name === CLAIM_INDEX_NAME);
  const byKey = indexes.find((index) => sameKey(index.key, CLAIM_INDEX_KEY));

  if (byName && sameKey(byName.key, CLAIM_INDEX_KEY) && byName.unique === true && !byName.partialFilterExpression) {
    return { collectionExists: true, status: 'legacy_unique_authoritative', index: byName, indexes };
  }
  if (byName && sameKey(byName.key, CLAIM_INDEX_KEY) && byName.unique === true && byName.partialFilterExpression) {
    return { collectionExists: true, status: 'partial_unique_active', index: byName, indexes };
  }
  if (byName) return { collectionExists: true, status: 'incompatible_name', index: byName, indexes };
  if (byKey) return { collectionExists: true, status: 'incompatible_key', index: byKey, indexes };
  return { collectionExists: true, status: 'missing_index', indexes };
};

const ensureSupportIndexes = async (db, { dryRun }) => {
  const claims = await getCollection(db, 'tournamentregistrationclaims');
  if (!claims) return { skipped: true, reason: 'claim collection does not exist' };
  if (dryRun) {
    return {
      dryRun: true,
      indexes: [
        { key: { intentId: 1 }, name: 'intentId_1' },
        { key: { status: 1, tournamentId: 1 }, name: 'status_1_tournamentId_1' }
      ]
    };
  }
  await claims.createIndex({ intentId: 1 });
  await claims.createIndex({ status: 1, tournamentId: 1 });
  return { createdOrAlreadyPresent: true };
};

const runUpdate = async ({ collection, filter, update, dryRun }) => {
  const matched = await collection.countDocuments(filter);
  if (dryRun) return { matched, modified: 0, dryRun: true };
  const result = await collection.updateMany(filter, update);
  return { matched, modified: result.modifiedCount };
};

const backfillClaims = async (db, { dryRun }) => {
  const collection = await getCollection(db, 'tournamentregistrationclaims');
  if (!collection) return { skipped: true, reason: 'claim collection does not exist' };

  return {
    holderType: await runUpdate({
      collection,
      filter: { holderType: { $exists: false } },
      update: { $set: { holderType: 'registration' } },
      dryRun
    }),
    status: await runUpdate({
      collection,
      filter: { status: { $exists: false } },
      update: { $set: { status: 'active' } },
      dryRun
    }),
    intentId: await runUpdate({
      collection,
      filter: { intentId: { $exists: false } },
      update: { $set: { intentId: null } },
      dryRun
    }),
    releasedAt: await runUpdate({
      collection,
      filter: { releasedAt: { $exists: false } },
      update: { $set: { releasedAt: null } },
      dryRun
    }),
    releaseReason: await runUpdate({
      collection,
      filter: { releaseReason: { $exists: false } },
      update: { $set: { releaseReason: '' } },
      dryRun
    })
  };
};

const backfillTournamentFees = async (db, { dryRun }) => {
  const collection = await getCollection(db, 'tournaments');
  if (!collection) return { skipped: true, reason: 'tournaments collection does not exist' };

  const metadataMissing = { entryFeeAmountMinor: { $exists: false } };
  const metadataMissingCount = await collection.countDocuments(metadataMissing);

  let amountMinor = { matched: metadataMissingCount, modified: 0, dryRun };
  if (!dryRun && metadataMissingCount > 0) {
    const result = await collection.updateMany(metadataMissing, [
      {
        $set: {
          entryFeeAmountMinor: {
            $toInt: {
              $round: [{ $multiply: [{ $ifNull: ['$entryFee', 0] }, 100] }, 0]
            }
          }
        }
      }
    ]);
    amountMinor = { matched: metadataMissingCount, modified: result.modifiedCount };
  }

  return {
    entryFeeAmountMinor: amountMinor,
    entryFeeCurrency: await runUpdate({
      collection,
      filter: { entryFeeCurrency: { $exists: false } },
      update: { $set: { entryFeeCurrency: 'INR' } },
      dryRun
    }),
    entryFeeScope: await runUpdate({
      collection,
      filter: { entryFeeScope: { $exists: false } },
      update: { $set: { entryFeeScope: 'team' } },
      dryRun
    }),
    feeVersion: await runUpdate({
      collection,
      filter: { feeVersion: { $exists: false } },
      update: { $set: { feeVersion: 1 } },
      dryRun
    }),
    feeLockedAt: await runUpdate({
      collection,
      filter: { feeLockedAt: { $exists: false } },
      update: { $set: { feeLockedAt: null } },
      dryRun
    })
  };
};

const backfillRegistrationPayments = async (db, { dryRun }) => {
  const collection = await getCollection(db, 'tournamentregistrations');
  if (!collection) return { skipped: true, reason: 'tournamentregistrations collection does not exist' };

  return {
    paymentDefaults: await runUpdate({
      collection,
      filter: { 'payment.status': { $exists: false } },
      update: {
        $set: {
          'payment.status': 'not_required',
          'payment.amountMinor': 0,
          'payment.currency': 'INR',
          'payment.feeScope': 'team',
          'payment.intentId': null,
          'payment.paymentOrderId': null,
          'payment.paidAt': null,
          'payment.refundStatus': 'not_applicable'
        }
      },
      dryRun
    })
  };
};

const runBackfill = async ({ db, dryRun = true } = {}) => {
  const beforeClaimIndex = await getClaimIndexState(db);
  const result = {
    dryRun,
    databaseName: db.databaseName,
    beforeClaimIndex,
    supportIndexes: await ensureSupportIndexes(db, { dryRun }),
    claims: await backfillClaims(db, { dryRun }),
    tournaments: await backfillTournamentFees(db, { dryRun }),
    registrations: await backfillRegistrationPayments(db, { dryRun }),
    afterClaimIndex: await getClaimIndexState(db)
  };
  return result;
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (!process.env[TARGET_DB_FLAG]) throw new Error(`${TARGET_DB_FLAG}=<expected database name> is required`);

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db();
    if (db.databaseName !== process.env[TARGET_DB_FLAG]) {
      throw new Error(`Migration DB mismatch. Expected ${process.env[TARGET_DB_FLAG]}, got ${db.databaseName}.`);
    }
    const dryRun = process.env[CONFIRM_FLAG] !== 'true';
    const result = await runBackfill({ db, dryRun });
    printJson(dryRun ? 'DRY RUN payment schema backfill report' : 'Payment schema backfill report', result);
    if (dryRun) {
      console.log(`\nNo writes performed. Set ${CONFIRM_FLAG}=true to apply compatible field backfills.`);
    }
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
  CLAIM_INDEX_KEY,
  CLAIM_INDEX_NAME,
  getClaimIndexState,
  runBackfill
};

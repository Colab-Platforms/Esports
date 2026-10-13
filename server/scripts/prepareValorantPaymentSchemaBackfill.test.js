const test = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  CLAIM_INDEX_NAME,
  getClaimIndexState,
  runBackfill
} = require('./prepareValorantPaymentSchemaBackfill');

let mongo;
let client;
let db;
let seq = 0;

const oid = () => new ObjectId();

const connectFreshDb = async () => {
  if (client) await client.close();
  seq += 1;
  client = new MongoClient(mongo.getUri());
  await client.connect();
  db = client.db(`payment_foundation_backfill_${seq}`);
  return db;
};

test.before(async () => {
  mongo = await MongoMemoryServer.create();
});

test.afterEach(async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
});

test.after(async () => {
  await mongo.stop();
});

test('payment schema backfill is dry-run safe, repeatable, and preserves legacy claim index', async () => {
  await connectFreshDb();
  await db.createCollection('tournamentregistrationclaims');
  await db.collection('tournamentregistrationclaims').createIndex(
    { tournamentId: 1, type: 1, value: 1 },
    { unique: true, name: CLAIM_INDEX_NAME }
  );

  const registrationId = oid();
  await db.collection('tournamentregistrationclaims').insertOne({
    tournamentId: oid(),
    type: 'team',
    value: oid().toString(),
    registrationId
  });
  await db.collection('tournaments').insertOne({
    name: 'Legacy Free Cup',
    gameType: 'valorant',
    entryFee: 0,
    currentParticipants: 1,
    maxParticipants: 16
  });
  await db.collection('tournamentregistrations').insertOne({
    _id: registrationId,
    tournamentId: oid(),
    userId: oid(),
    teamName: 'Legacy Team',
    status: 'pending'
  });

  const dryRun = await runBackfill({ db, dryRun: true });
  assert.equal(dryRun.claims.holderType.matched, 1);
  assert.equal(await db.collection('tournamentregistrationclaims').countDocuments({ holderType: 'registration' }), 0);

  const firstRun = await runBackfill({ db, dryRun: false });
  assert.equal(firstRun.beforeClaimIndex.status, 'legacy_unique_authoritative');
  assert.equal(firstRun.afterClaimIndex.status, 'legacy_unique_authoritative');

  const claim = await db.collection('tournamentregistrationclaims').findOne({ registrationId });
  assert.equal(claim.holderType, 'registration');
  assert.equal(claim.status, 'active');
  assert.equal(claim.intentId, null);
  assert.equal(claim.releasedAt, null);

  const tournament = await db.collection('tournaments').findOne({ name: 'Legacy Free Cup' });
  assert.equal(tournament.entryFeeAmountMinor, 0);
  assert.equal(tournament.entryFeeCurrency, 'INR');
  assert.equal(tournament.entryFeeScope, 'team');
  assert.equal(tournament.feeVersion, 1);

  const registration = await db.collection('tournamentregistrations').findOne({ _id: registrationId });
  assert.equal(registration.payment.status, 'not_required');
  assert.equal(registration.payment.amountMinor, 0);

  const secondRun = await runBackfill({ db, dryRun: false });
  assert.equal(secondRun.claims.holderType.matched, 0);
  assert.equal(secondRun.tournaments.entryFeeCurrency.matched, 0);
  assert.equal(secondRun.registrations.paymentDefaults.matched, 0);

  const claimIndex = await getClaimIndexState(db);
  assert.equal(claimIndex.status, 'legacy_unique_authoritative');
  assert.equal(claimIndex.index.unique, true);
  assert.equal(claimIndex.index.partialFilterExpression, undefined);
});

test('payment schema backfill skips missing optional collections without creating claim ownership sources', async () => {
  await connectFreshDb();

  const result = await runBackfill({ db, dryRun: false });
  assert.equal(result.claims.skipped, true);
  assert.equal(result.supportIndexes.skipped, true);
  assert.equal(result.beforeClaimIndex.status, 'missing_collection');
  assert.equal(await db.listCollections({ name: 'registrationclaims' }).hasNext(), false);
});

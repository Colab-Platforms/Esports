const test = require('node:test');
const assert = require('node:assert/strict');
require('../game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { audit, provision, definitions } = require('../../scripts/valorant-payment-indexes.cjs');
let replica;
let client;
test.before(async () => {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('payment_index_disposable');
  assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  client = await new mongoose.mongo.MongoClient(uri).connect();
});
test.after(async () => {
  await mongoose.disconnect();
  if (client) await client.close();
  if (replica) await replica.stop();
});

test('audit is read-only; additive provisioning satisfies the real payment guard and is repeatable', async () => {
  const db = client.db('payment_index_disposable');
  const first = await audit(db);
  assert.equal(first.rows.length, definitions.length);
  assert.ok(first.rows.every(row => row.status === 'missing'));
  assert.equal((await db.listCollections().toArray()).length, 0);
  const provisioned = await provision(db, first);
  assert.ok(provisioned.rows.every(row => row.status === 'ok'));
  await db.collection('paymentorders').insertOne({ marker: 'preserve-existing-data' });
  await db.collection('paymentorders').createIndex({ marker: 1 }, { name: 'existing_custom_index' });
  await provision(db, await audit(db));
  assert.equal(await db.collection('paymentorders').countDocuments(), 1);
  assert.ok((await db.collection('paymentorders').listIndexes().toArray()).some(index => index.name === 'existing_custom_index'));
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  await mongoose.connect(replica.getUri('payment_index_disposable'), { autoIndex: false, autoCreate: false });
  await require('./payment.service').assertIndexes();
});

test('incompatible named indexes stop all provisioning and remain unchanged', async () => {
  const db = client.db('payment_index_conflict');
  await db.collection('paymentorders').createIndex({ wrongField: 1 }, { name: 'uniq_gateway_order_id' });
  const report = await audit(db);
  assert.ok(report.rows.some(row => row.index === 'uniq_gateway_order_id' && row.status === 'conflict'));
  await assert.rejects(provision(db, report), /INDEX_CONFLICT_REQUIRES_REVIEW/);
  assert.equal((await db.listCollections().toArray()).length, 1);
});

test('payment guard blocks checkout when the legacy unique owner index exists', async () => {
  await mongoose.connection.db.collection('tournamentregistrations').createIndex(
    { tournamentId: 1, userId: 1 }, { unique: true });
  await assert.rejects(require('./payment.service').assertIndexes(), { code: 'PAYMENT_INDEX_REQUIRED' });
  const db = mongoose.connection.db;
  await provision(db, await audit(db), { migrateLegacyOwner: true, checkoutPaused: true });
  await require('./payment.service').assertIndexes();
});

test('same key under a different name is reported for review without replacement', async () => {
  const db = client.db('payment_index_other_name');
  await db.collection('paymentorders').createIndex({ gateway: 1, gatewayOrderId: 1 }, {
    name: 'legacy_order', unique: true, partialFilterExpression: { gatewayOrderId: { $type: 'string' } }
  });
  const report = await audit(db);
  assert.ok(report.rows.some(row => row.index === 'uniq_gateway_order_id' && row.existingIndex === 'legacy_order'));
  await assert.rejects(provision(db, report), /INDEX_CONFLICT_REQUIRES_REVIEW/);
});

test('legacy unique owner index blocks provisioning without dropping it', async () => {
  const db = client.db('payment_index_legacy_owner');
  await db.collection('tournamentregistrations').createIndex({ tournamentId: 1, userId: 1 }, { unique: true });
  const report = await audit(db);
  assert.equal(report.legacyOwnerUnique, true);
  await assert.rejects(provision(db, report), /INDEX_CONFLICT_REQUIRES_REVIEW/);
  assert.equal((await db.listCollections().toArray()).length, 1);
});

test('permission errors are not mistaken for missing collections', async () => {
  await assert.rejects(audit({ collection: () => ({ listIndexes: () => ({ toArray: async () => {
    throw Object.assign(new Error('not authorized'), { code: 13 });
  } }) }) }), { code: 13 });
});

test('duplicate records fail unique index creation without deleting data', async () => {
  const db = client.db('payment_index_duplicates');
  await db.collection('registrationintents').insertMany([
    { captainUserId: 'captain', idempotencyKey: 'same' },
    { captainUserId: 'captain', idempotencyKey: 'same' }
  ]);
  await assert.rejects(provision(db, await audit(db)), { code: 11000 });
  assert.equal(await db.collection('registrationintents').countDocuments(), 2);
});

test('explicit paused migration preserves legacy uniqueness and permits Valorant rejected history', async () => {
  const db = client.db('payment_index_migration');
  const collection = db.collection('tournamentregistrations');
  await collection.createIndex({ tournamentId: 1, userId: 1 }, { unique: true });
  await collection.insertOne({ tournamentId: 'legacy', userId: 'captain', status: 'rejected', marker: 'keep' });
  const before = await collection.findOne({ tournamentId: 'legacy' });
  await assert.rejects(provision(db, await audit(db), { migrateLegacyOwner: true }), /CHECKOUT_MUST_BE_PAUSED/);
  assert.equal((await db.listCollections().toArray()).length, 1);
  const report = await provision(db, await audit(db), { migrateLegacyOwner: true, checkoutPaused: true });
  assert.equal(report.legacyOwnerUnique, false);
  assert.ok(report.rows.every(row => row.status === 'ok'));
  assert.deepEqual(await collection.findOne({ _id: before._id }), before);
  await assert.rejects(collection.insertOne({ tournamentId: 'legacy', userId: 'captain', status: 'pending' }), { code: 11000 });
  await assert.rejects(collection.insertOne({ tournamentId: 'legacy', userId: 'captain', registrationFlow: null }), { code: 11000 });
  await collection.insertOne({ tournamentId: 'valorant', userId: 'captain', registrationFlow: 'valorant_v1', status: 'rejected' });
  const active = { tournamentId: 'valorant', userId: 'captain', registrationFlow: 'valorant_v1', status: 'pending' };
  await collection.insertOne({ ...active });
  await assert.rejects(collection.insertOne({ ...active, status: 'verified' }), { code: 11000 });
  await collection.updateOne({ tournamentId: 'valorant', status: 'pending' }, { $set: { status: 'rejected' } });
  await collection.insertOne({ ...active });
  assert.equal(await collection.countDocuments(), 4);
  await provision(db, await audit(db), { migrateLegacyOwner: true, checkoutPaused: true });
});

test('unknown unique owner indexes are preserved and stop explicit migration before writes', async () => {
  const db = client.db('payment_index_unknown_owner');
  await db.collection('tournamentregistrations').createIndex({ tournamentId: 1, userId: 1 }, { unique: true, name: 'custom_owner' });
  await assert.rejects(provision(db, await audit(db), { migrateLegacyOwner: true, checkoutPaused: true }), /INDEX_CONFLICT_REQUIRES_REVIEW/);
  assert.equal((await db.listCollections().toArray()).length, 1);
});

// Uses the native driver only: importing application models could auto-create indexes.
const { MongoClient } = require('mongoose').mongo;
const manifest = require('../../release/valorant-free-registration/indexes.json');
const ownerPolicy = require('../features/valorant-registration/owner-index-policy');

const definitions = [
  ...manifest.collections.flatMap(({ name, indexes }) => indexes.map(index => ({ collection: name, ...index }))),
  ...manifest.existingCollectionAdditions
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const compatible = (actual, expected) => same(actual.key, expected.key) &&
  Boolean(actual.unique) === Boolean(expected.unique) && !actual.sparse &&
  !actual.collation && !actual.hidden && actual.expireAfterSeconds === undefined &&
  same(actual.partialFilterExpression || null, expected.partialFilterExpression || null);

async function audit(db) {
  const rows = [];
  const physical = new Map();
  for (const collection of new Set(definitions.map(index => index.collection))) {
    try { physical.set(collection, await db.collection(collection).listIndexes().toArray()); }
    catch (error) {
      // A missing namespace is provisionable; permission/network errors must stop the audit.
      if (error.code !== 26) throw error;
      physical.set(collection, []);
    }
  }
  for (const expected of definitions) {
    const indexes = physical.get(expected.collection);
    const named = indexes.find(index => index.name === expected.name);
    const sameKey = indexes.find(index => same(index.key, expected.key) &&
      same(index.partialFilterExpression || null, expected.partialFilterExpression || null));
    const status = named ? (compatible(named, expected) ? 'ok' : 'conflict') : sameKey ? 'conflict' : 'missing';
    rows.push({ collection: expected.collection, index: expected.name, status,
      ...(status === 'conflict' ? { existingIndex: (named || sameKey).name } : {}) });
  }
  const legacyOwnerIndexes = physical.get('tournamentregistrations').filter(ownerPolicy.isUnconditionalOwnerIndex);
  return { database: db.databaseName, rows, legacyOwnerUnique: legacyOwnerIndexes.length > 0,
    legacyOwnerIndexes: legacyOwnerIndexes.map(index => index.name) };
}

async function provision(db, report, { migrateLegacyOwner = false, checkoutPaused = false } = {}) {
  if (report.database !== db.databaseName) throw new Error('DATABASE_MISMATCH');
  if (migrateLegacyOwner && !checkoutPaused) throw new Error('CHECKOUT_MUST_BE_PAUSED');
  if ((!migrateLegacyOwner && report.legacyOwnerUnique) || report.rows.some(row => row.status === 'conflict')) {
    throw new Error('INDEX_CONFLICT_REQUIRES_REVIEW');
  }
  // Re-audit immediately before writes; never synchronize indexes. The optional
  // owner migration below is the only permitted removal.
  const fresh = await audit(db);
  if ((!migrateLegacyOwner && fresh.legacyOwnerUnique) || fresh.rows.some(row => row.status === 'conflict')) {
    throw new Error('INDEX_CONFLICT_REQUIRES_REVIEW');
  }
  if (migrateLegacyOwner && fresh.legacyOwnerIndexes.some(name => name !== 'tournamentId_1_userId_1')) {
    throw new Error('INDEX_CONFLICT_REQUIRES_REVIEW');
  }
  for (const row of fresh.rows.filter(row => row.status === 'missing')) {
    const expected = definitions.find(index => index.collection === row.collection && index.name === row.index);
    const { collection, key, ...options } = expected;
    await db.collection(collection).createIndex(key, options);
  }
  if (migrateLegacyOwner && fresh.legacyOwnerUnique) {
    const collection = db.collection('tournamentregistrations');
    const physical = await collection.listIndexes().toArray();
    for (const expected of [ownerPolicy.legacy, ownerPolicy.active]) {
      if (!compatible(physical.find(index => index.name === expected.name) || {}, expected)) {
        throw new Error('REPLACEMENT_INDEX_NOT_READY');
      }
    }
    const old = physical.find(index => index.name === 'tournamentId_1_userId_1');
    if (old && (!ownerPolicy.isUnconditionalOwnerIndex(old) || old.sparse || old.collation || old.hidden)) {
      throw new Error('INDEX_CONFLICT_REQUIRES_REVIEW');
    }
    // The only destructive step: explicitly requested, after verified replacements.
    if (old) await collection.dropIndex(old.name);
  }
  return audit(db);
}

async function main(args) {
  if (args.includes('--help')) {
    console.log('Usage: node server/scripts/valorant-payment-indexes.cjs --database NAME [--env-file PATH] [--apply [--migrate-legacy-owner]]');
    console.log('Default: read-only audit. --apply creates missing indexes. Explicit owner migration requires paused checkout and deployed new owner policy.');
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--migrate-legacy-owner') options.migrateLegacyOwner = true;
    else if (['--database', '--env-file'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) options[arg] = args[++i];
    else throw new Error('INVALID_ARGUMENTS_USE_HELP');
  }
  if (!options['--database']) throw new Error('EXPLICIT_DATABASE_REQUIRED');
  if (options.migrateLegacyOwner && !options.apply) throw new Error('MIGRATION_REQUIRES_APPLY');
  if (options['--env-file']) {
    const loaded = require('dotenv').config({ path: options['--env-file'], override: false });
    if (loaded.error) throw new Error('ENV_FILE_UNREADABLE');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI_REQUIRED');
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    // Do not silently redirect a URI for another database to the requested target.
    const db = client.db();
    if (db.databaseName !== options['--database']) throw new Error('DATABASE_MISMATCH');
    const report = await audit(db);
    console.log(JSON.stringify(report, null, 2));
    if (options.apply) {
      const result = await provision(db, report, { migrateLegacyOwner: options.migrateLegacyOwner,
        checkoutPaused: process.env.VALORANT_CHECKOUT_PAUSED === 'true' });
      console.log(JSON.stringify({ after: result }, null, 2));
      if (result.legacyOwnerUnique || result.rows.some(row => row.status !== 'ok')) process.exitCode = 2;
    } else if (report.legacyOwnerUnique || report.rows.some(row => row.status !== 'ok')) process.exitCode = 2;
  } finally { await client.close(); }
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {
  // Driver messages can contain credentials, hosts or duplicate financial values.
  const ownCodes = ['DATABASE_MISMATCH', 'INDEX_CONFLICT_REQUIRES_REVIEW', 'INVALID_ARGUMENTS_USE_HELP',
    'CHECKOUT_MUST_BE_PAUSED', 'REPLACEMENT_INDEX_NOT_READY', 'MIGRATION_REQUIRES_APPLY',
    'EXPLICIT_DATABASE_REQUIRED', 'ENV_FILE_UNREADABLE', 'MONGODB_URI_REQUIRED'];
  console.error(JSON.stringify({ error: ownCodes.includes(error.message) ? error.message : 'DATABASE_OPERATION_FAILED',
    ...(Number.isInteger(error.code) ? { mongoCode: error.code } : {}) }));
  process.exitCode = 1;
});

module.exports = { definitions, compatible, audit, provision };

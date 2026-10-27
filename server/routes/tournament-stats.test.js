const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.REDIS_DISABLED = 'true';
const User = require('../models/User');
const Tournament = require('../models/Tournament');
const Transaction = require('../models/Transaction');
const redis = require('../services/redisService');
const router = require('./tournaments');
const handler = router.stack.find(layer => layer.route?.path === '/stats').route.stack.at(-1).handle;

const invoke = async () => {
  let response;
  await handler({}, {
    json(body) { response = body; },
    status(code) { assert.fail(`Unexpected HTTP ${code}`); }
  });
  return response;
};

const mockCounts = (t, { users = 0, completed = 0, transactions = 0, prizes = 0 } = {}) => {
  t.mock.method(User, 'countDocuments', async () => users);
  t.mock.method(Tournament, 'countDocuments', async filter => filter.status === 'completed' ? completed : 1);
  t.mock.method(Tournament, 'aggregate', async () => [{ total: prizes }]);
  t.mock.method(Transaction, 'countDocuments', async () => transactions);
};

test('replaces approximate cached stats and formats zero without a plus sign', async t => {
  mockCounts(t);
  t.mock.method(redis, 'get', async () => ({ totalPlayers: '0+', totalPrizes: '₹0+' }));
  let cached;
  t.mock.method(redis, 'set', async (key, value) => { cached = value; });
  const response = await invoke();
  assert.equal(response.data.totalPlayers, '0');
  assert.equal(response.data.totalPrizes, '₹0');
  assert.equal(response.data.completedTournaments, '0');
  assert.equal(cached.numberFormatVersion, 1);
});

test('keeps tournament counts separate from payments and preserves exact amounts on cache hits', async t => {
  mockCounts(t, { users: 3885, completed: 3, transactions: 42, prizes: 71234.5 });
  t.mock.method(redis, 'get', async () => null);
  t.mock.method(redis, 'set', async () => {});
  const response = await invoke();
  assert.equal(response.data.totalPlayers, '3,885');
  assert.equal(response.data.completedTournaments, '3');
  assert.equal(response.data.totalTransactions, '42');
  assert.equal(response.data.totalPrizes, '₹71,234.5');
  assert.equal(response.data.activeTournaments, '1');
  t.mock.method(redis, 'get', async () => response.data);
  t.mock.method(Tournament, 'aggregate', async () => { assert.fail('Fresh cache should be reused'); });
  const cached = await invoke();
  assert.equal(cached.cached, true);
  assert.deepEqual(cached.data, response.data);
});

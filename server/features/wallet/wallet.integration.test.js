const test = require('node:test');
const assert = require('node:assert/strict');
require('../game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const { CoinConfig } = require('../../models/CoinConfig');
let replica, server, base, serial = 0;
const secret = 'synthetic-wallet-refactor-secret';
const models = [User, Wallet, Transaction, CoinConfig];
async function player() {
  const row = { _id: new mongoose.Types.ObjectId(), username: `wallet-${++serial}`, email: `wallet-${serial}@example.com`, isActive: true, role: 'user', activityStreak: 9 };
  await User.collection.insertOne(row); return row;
}
const request = (path, method = 'GET', body, user) => fetch(base + '/api/wallet' + path, {
  method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, secret)}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});
test.before(async () => {
  process.env.JWT_SECRET = secret;
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('wallet_refactor_disposable'); assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  for (const Model of models) await Model.createCollection();
  const app = express(); app.use(express.json()); app.use('/api/wallet', require('../../routes/wallet'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => { assert.equal(mongoose.connection.name, 'wallet_refactor_disposable'); for (const Model of models) await Model.deleteMany({}); });
test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (replica) await replica.stop(); });

test('wallet model and service aliases retain identity and authenticated reads cannot select another wallet', async () => {
  assert.equal(Wallet, require('./wallet.model')); assert.equal(Transaction, require('./transaction.model'));
  assert.equal(require('../../services/walletService'), require('./wallet.service'));
  assert.equal(Wallet.collection.name, 'wallets'); assert.equal(Transaction.collection.name, 'transactions');
  const own = await player(), other = await player();
  await Wallet.create({ userId: own._id, balance: 35 }); await Wallet.create({ userId: other._id, balance: 999 });
  assert.equal((await request('')).status, 401);
  const response = await request('?userId=' + other._id, 'GET', null, own);
  const data = (await response.json()).data;
  assert.equal(data.balance, 35); assert.equal(data.days.length, 9); assert.equal(data.last7Days.length, 7);
  assert.ok(Array.isArray(data.recentTransactions));
});
test('seventh-day reward adds the existing bonus once and preserves activity streaks', async () => {
  const own = await player(); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  await Wallet.create({ userId: own._id, balance: 0, streak: 6, lastDailyLogin: yesterday });
  const response = await request('/daily-login', 'POST', {}, own);
  assert.equal(response.status, 200); const data = (await response.json()).data;
  assert.equal(data.streak, 7); assert.equal(data.streakBonusCoins, 30); assert.equal(data.newBalance, 40);
  assert.equal((await request('/daily-login', 'POST', {}, own)).status, 400);
  assert.equal((await Wallet.findOne({ userId: own._id })).balance, 40);
  assert.equal((await User.findById(own._id)).activityStreak, 9);
});
test('coin deductions and embedded transaction history preserve balances and validation', async () => {
  const own = await player(); await Wallet.create({ userId: own._id, balance: 50 });
  assert.equal((await request('/deduct-coins', 'POST', { amount: -10 }, own)).status, 400);
  assert.equal((await request('/deduct-coins', 'POST', { amount: 51 }, own)).status, 400);
  const response = await request('/deduct-coins', 'POST', { amount: 20, description: 'Test purchase' }, own);
  assert.equal((await response.json()).data.newBalance, 30);
  const history = await (await request('/transactions?type=spend', 'GET', null, own)).json();
  assert.equal(history.data.transactions.length, 1); assert.equal(history.data.transactions[0].amount, -20);
  assert.equal((await Wallet.findOne({ userId: own._id })).totalSpent, 20);
});

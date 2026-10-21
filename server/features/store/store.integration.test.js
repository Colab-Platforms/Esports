const test = require('node:test');
const assert = require('node:assert/strict');
require('../game-results/test-support/local-startup.cjs');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../../models/User');
const Item = require('../../models/StoreItem');
const Order = require('../../models/Order');
const Wallet = require('../../models/Wallet');
const Notification = require('../../models/Notification');
let replica, server, base, serial = 0;
const secret = 'synthetic-store-refactor-secret';
const models = [User, Item, Order, Wallet, Notification];
async function player(role = 'user') {
  const row = { _id: new mongoose.Types.ObjectId(), username: `store-${++serial}`, email: `store-${serial}@example.com`, isActive: true, role };
  await User.collection.insertOne(row); return row;
}
const request = (path, method = 'GET', body, user) => fetch(base + '/api/store' + path, {
  method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, secret)}` } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {})
});
async function purchase(user) {
  await Wallet.create({ userId: user._id, balance: 100 });
  const item = await Item.create({ name: 'Test Reward', description: 'Synthetic reward', price: 30, stock: 2 });
  const response = await request('/buy/' + item._id, 'POST', { playerID: 'synthetic-game-id' }, user);
  assert.equal(response.status, 200);
  const data = (await response.json()).data;
  assert.equal(data.newBalance, 70); assert.equal((await Item.findById(item._id)).stock, 1);
  return { item, order: data.order };
}
test.before(async () => {
  process.env.JWT_SECRET = secret;
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('store_refactor_disposable'); assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  for (const Model of models) await Model.createCollection();
  const app = express(); app.use(express.json()); app.use('/api/store', require('../../routes/store'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => { assert.equal(mongoose.connection.name, 'store_refactor_disposable'); for (const Model of models) await Model.deleteMany({}); });
test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (replica) await replica.stop(); });

test('model aliases retain the existing collections and user order queries cannot override ownership', async () => {
  assert.equal(Item, require('./store-item.model')); assert.equal(Order, require('./order.model'));
  assert.equal(Item.collection.name, 'storeitems'); assert.equal(Order.collection.name, 'orders');
  const own = await player(), other = await player();
  const { order } = await purchase(own);
  const response = await request('/orders?userId=' + own._id, 'GET', null, other);
  assert.equal(response.status, 200); assert.equal((await response.json()).data.orders.length, 0);
  assert.equal((await request('/orders/' + order._id + '/cancel', 'POST', {}, other)).status, 403);
  assert.equal((await request('/orders')).status, 401);
});
test('store administration rejects ordinary users and supports fulfillment by an admin', async () => {
  const own = await player(), admin = await player('admin');
  const { order } = await purchase(own);
  for (const [path, method] of [['/admin/claims', 'GET'], ['/admin/claims/' + order._id + '/fulfill', 'PUT'], ['/admin/claims/' + order._id + '/fail', 'PUT']]) {
    assert.equal((await request(path, method, method === 'PUT' ? {} : null, own)).status, 403);
  }
  assert.equal((await request('/admin/claims/' + order._id + '/fulfill', 'PUT', {}, admin)).status, 200);
  assert.equal((await Order.findById(order._id)).claimStatus, 'fulfilled');
  assert.equal((await request('/orders/' + order._id + '/cancel', 'POST', {}, own)).status, 400);
});
test('cancellation restores stock and coins once and cannot later be refunded as a failed claim', async () => {
  const own = await player(), admin = await player('admin');
  const { item, order } = await purchase(own);
  assert.equal((await request('/orders/' + order._id + '/cancel', 'POST', {}, own)).status, 200);
  assert.equal((await request('/orders/' + order._id + '/cancel', 'POST', {}, own)).status, 400);
  assert.equal((await request('/admin/claims/' + order._id + '/fail', 'PUT', {}, admin)).status, 400);
  assert.equal((await Wallet.findOne({ userId: own._id })).balance, 100);
  assert.equal((await Item.findById(item._id)).stock, 2);
});

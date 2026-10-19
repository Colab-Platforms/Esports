const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
require('../game-results/test-support/local-startup.cjs');
const User = require('../../models/User');
const Team = require('../../models/Team');
const Tournament = require('../../models/Tournament');
const Registration = require('../../models/TournamentRegistration');
const Claim = require('../valorant-registration/registration-claim.model');
const registration = require('../valorant-registration/registration.service');
const service = require('./payment.service');
const { RazorpayAdapter } = require('./razorpay.adapter');
const { Intent, Order, Event, Receipt, Notification, Review } = service.models;
const Result = require('../valorant-results/valorant-match-result.model');
const Final = require('../tournament-final-results/tournament-final-result.model');
let replica, server, base, sequence = 0, admin, adapter;
const orders = new Map(), payments = new Map(), refunds = new Map();
const secret = 'disposable-payment-tests-only';
const options = () => ({ adapter });
const signature = body => crypto.createHmac('sha256', secret).update(body).digest('hex');
async function fixture(fee = 500) {
  const n = ++sequence;
  const users = await User.create(Array.from({ length: 6 }, (_, i) => ({ username: `pay-${n}-${i}`, email: `pay-${n}-${i}@example.com`,
    fullName: `Fiction Player ${n} ${i}`, authProvider: 'google', ...(i === 0 ? { phone: `9${String(n).padStart(8, '0')}0` } : {}), gameIds: { valorant: `Player ${n} ${i}#TEST` } })));
  const team = await Team.create({ name: `Payment Team ${n}`, game: 'valorant', captain: users[0]._id, maxMembers: 6,
    members: users.map((u, i) => ({ userId: u._id, role: i === 0 ? 'captain' : 'member', isSubstitute: i === 5 })) });
  const tournament = await Tournament.create({ name: `Payment Cup ${n}`, gameType: 'valorant', mode: 'team', prizePool: 0, entryFee: fee,
    maxParticipants: 2, status: 'registration_open', registrationDeadline: new Date(Date.now() + 3600000), createdBy: admin._id });
  return { users, team, tournament, args: { userId: users[0]._id, teamId: team._id, tournamentId: tournament._id, idempotencyKey: `intent-key-${n}` } };
}
async function payable(f) {
  const intent = await service.createIntent(f.args);
  const checkout = await service.createOrder({ userId: f.users[0]._id, intentId: intent._id, idempotencyKey: 'order-key-1234' }, options());
  return { intent, checkout };
}
function paymentFor(checkout, status = 'captured', extra = {}) {
  const payment = { id: `pay_${++sequence}`, order_id: checkout.razorpayOrderId, amount: checkout.amountMinor, currency: 'INR', status, ...extra };
  payments.set(payment.id, payment); return payment;
}
const verify = (f, checkout, payment, extra = {}) => service.verify({ userId: f.users[0]._id, paymentOrderId: checkout.paymentOrderId,
  razorpay_order_id: checkout.razorpayOrderId, razorpay_payment_id: payment.id,
  razorpay_signature: signature(`${checkout.razorpayOrderId}|${payment.id}`), ...extra }, options());
const eventBody = (payment, type = 'payment.captured') => Buffer.from(JSON.stringify({ event: type, payload: { payment: { entity: payment } } }));
async function event(payment, eventId = `evt_${++sequence}`, type) {
  const rawBody = eventBody(payment, type);
  return service.webhook({ rawBody, signature: signature(rawBody), eventId }, options());
}
async function request(path, method, body, user) {
  return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user._id }, secret)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test.before(async () => {
  process.env.JWT_SECRET = secret; process.env.REDIS_DISABLED = 'true'; process.env.VALORANT_PAYMENTS_ENABLED = 'true'; process.env.VALORANT_PAYMENT_WORKER_ENABLED = 'true'; process.env.RAZORPAY_MODE = 'test';
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.6' }, replSet: { count: 1 } });
  const uri = replica.getUri('valorant_payments_disposable'); assert.match(uri, /^mongodb:\/\/127\.0\.0\.1:/);
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  for (const Model of [User, Team, Tournament, Registration, Claim, Result, Final, ...Object.values(service.models)]) await Model.createCollection();
  for (const Model of [Claim, Result, Final, ...Object.values(service.models)]) await Model.createIndexes();
  await Registration.collection.createIndex({ tournamentId: 1, userId: 1 });
  for (const [fields, opts] of Registration.schema.indexes().filter(([, opts]) => opts.unique && opts.name)) await Registration.collection.createIndex(fields, opts);
  const app = express();
  app.use('/api/valorant-payments/webhook', express.raw({ type: 'application/json' }), require('./payment-webhook.routes'));
  app.use(express.json()); app.use('/api/valorant-payments', require('./payment.routes'));
  app.use('/api/valorant-registration', require('../valorant-registration/registration.routes'));
  app.use('/api/tournaments', require('../../routes/tournaments'));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}`;
});
test.beforeEach(async () => {
  assert.equal(mongoose.connection.name, 'valorant_payments_disposable');
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  orders.clear(); payments.clear(); refunds.clear(); process.env.VALORANT_PAYMENTS_ENABLED = 'true'; process.env.RAZORPAY_MODE = 'test';
  process.env.VALORANT_PAYMENT_WORKER_ENABLED = 'true';
  delete process.env.VALORANT_CHECKOUT_PAUSED;
  admin = await User.create({ username: `pay-admin-${++sequence}`, fullName: 'Fiction Administrator', email: `admin-${sequence}@example.com`, authProvider: 'google', role: 'admin' });
  adapter = new RazorpayAdapter({ keyId: 'rzp_test_disposable', keySecret: secret, webhookSecret: secret, client: {
    orders: { create: async data => { const row = { ...data, id: `order_${++sequence}`, status: 'created', amount_paid: 0 }; orders.set(row.id, row); return row; },
      fetch: async id => orders.get(id), all: async ({ receipt }) => ({ items: [...orders.values()].filter(o => o.receipt === receipt) }),
      fetchPayments: async id => { const items = [...payments.values()].filter(p => p.order_id === id); return { items, count: items.length }; } },
    payments: { fetch: async id => payments.get(id) }, refunds: { fetch: async id => refunds.get(id) }
  } });
});
test.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (replica) await replica.stop(); });

test('configurable INR fee is validated without enabling paid BGMI or Free Fire', async () => {
  assert.equal(service.amountFor({ gameType: 'valorant', entryFee: 500 }), 50000);
  for (const fee of [NaN, -1, Infinity, '500', 10001, 0.001]) assert.throws(() => service.amountFor({ gameType: 'valorant', entryFee: fee }));
  for (const gameType of ['bgmi', 'freefire']) {
    const row = new Tournament({ gameType, entryFee: 500 }); assert.ok(row.validateSync().errors.entryFee);
  }
});
test('feature gating, mode mismatch and malformed signature fail closed', async () => {
  const f = await fixture(); process.env.VALORANT_PAYMENTS_ENABLED = 'false';
  await assert.rejects(service.createIntent(f.args), { code: 'PAYMENTS_DISABLED' });
  assert.throws(() => new RazorpayAdapter({ keyId: 'rzp_live_disposable', keySecret: secret }), { code: 'RAZORPAY_MODE_MISMATCH' });
  assert.equal(adapter.verifyWebhookSignature(Buffer.from('x'), signature('x') + 'junk'), false);
  assert.equal(await Registration.countDocuments(), 0);
});
test('reservation snapshots authoritative roster/fee and reserves exactly thirteen claims for ten minutes', async () => {
  const f = await fixture(); const start = Date.now(); const intent = await service.createIntent({ ...f.args, amountMinor: 1, rosterSnapshot: [] });
  assert.equal(intent.feeSnapshot.amountMinor, 50000); assert.equal(intent.rosterSnapshot.roster.length, 6);
  assert.ok(intent.reservation.expiresAt.getTime() >= start + 599000); assert.ok(intent.reservation.expiresAt.getTime() <= Date.now() + 600000);
  assert.equal(await Claim.countDocuments({ intentId: intent._id }), 13); assert.equal(await Registration.countDocuments(), 0);
  const cup = await Tournament.findById(f.tournament._id); assert.equal(cup.currentParticipants, 1); assert.equal(cup.participants.length, 0);
  await assert.rejects(registration.register(f.args), { code: 'PAID_REGISTRATION_UNAVAILABLE' });
});
test('same idempotency key reuses reservation while different selection conflicts', async () => {
  const f = await fixture(); const attempts = await Promise.all(Array.from({ length: 4 }, () => service.createIntent(f.args)));
  assert.equal(new Set(attempts.map(a => String(a._id))).size, 1); assert.equal(await Claim.countDocuments(), 13);
  await assert.rejects(service.createIntent({ ...f.args, teamId: new mongoose.Types.ObjectId() }), { code: 'IDEMPOTENCY_CONFLICT' });
});
test('different keys cannot reserve same team/roster twice', async () => {
  const f = await fixture(); const attempts = await Promise.allSettled(['request-key-one', 'request-key-two'].map(idempotencyKey => service.createIntent({ ...f.args, idempotencyKey })));
  assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1); assert.equal(await Intent.countDocuments(), 1);
});
test('last-slot reservation races cannot overbook and preserve other teams', async () => {
  const a = await fixture(), b = await fixture(); b.args.tournamentId = a.tournament._id;
  await Tournament.updateOne({ _id: a.tournament._id }, { $set: { currentParticipants: 0, maxParticipants: 1 } });
  const attempts = await Promise.allSettled([service.createIntent(a.args), service.createIntent(b.args)]);
  assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1); assert.equal((await Tournament.findById(a.tournament._id)).currentParticipants, 1); assert.equal(await Claim.countDocuments(), 13);
});
test('captured payment creates one paid pending registration/receipt and transfers claims without double capacity', async () => {
  const f = await fixture(); const { checkout, intent } = await payable(f); const payment = paymentFor(checkout);
  const output = await verify(f, checkout, payment); assert.equal(output.registrationStatus, 'pending');
  const row = await Registration.findById(output.registrationId); assert.equal(row.payment.amountMinor, 50000); assert.equal(row.roster.length, 6);
  assert.equal(await Claim.countDocuments({ registrationId: row._id }), 13); assert.equal(await Claim.countDocuments({ intentId: intent._id }), 0);
  assert.equal(await Receipt.countDocuments(), 1); assert.equal(await Notification.countDocuments({ status: 'pending' }), 1);
  const cup = await Tournament.findById(f.tournament._id); assert.equal(cup.currentParticipants, 1); assert.equal(cup.participants.length, 1);
  assert.equal((await Intent.findById(intent._id)).status, 'fulfilled');
});
for (const [name, patch] of [['amount', { amount: 1 }], ['currency', { currency: 'USD' }], ['order', { order_id: 'order_other' }]]) test(`verification rejects mismatched ${name}`, async () => {
  const f = await fixture(); const { checkout } = await payable(f); const payment = paymentFor(checkout, 'captured', patch);
  await assert.rejects(verify(f, checkout, payment), { code: 'PAYMENT_MISMATCH' }); assert.equal(await Registration.countDocuments(), 0);
});
test('invalid signature and wrong owner never create registrations', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const payment = paymentFor(checkout);
  await assert.rejects(verify(f, checkout, payment, { razorpay_signature: '0'.repeat(64) }), { code: 'INVALID_PAYMENT_SIGNATURE' });
  await assert.rejects(verify(f, checkout, payment, { userId: admin._id }), { code: 'FORBIDDEN' }); assert.equal(await Registration.countDocuments(), 0);
});
test('authorized and failed attempts cannot confirm; later capture can recover the same order', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const payment = paymentFor(checkout, 'authorized');
  await verify(f, checkout, payment); assert.equal(await Registration.countDocuments(), 0);
  payment.status = 'failed'; await verify(f, checkout, payment); assert.equal(await Registration.countDocuments(), 0);
  payment.status = 'captured'; await verify(f, checkout, payment); assert.equal(await Registration.countDocuments(), 1);
});
test('concurrent callbacks, webhook replay and reconciliation create exactly one registration', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const payment = paymentFor(checkout);
  await Promise.all([verify(f, checkout, payment), verify(f, checkout, payment), event(payment, 'evt_same'), event(payment, 'evt_same')]);
  await service.reconcile(options()); assert.equal(await Registration.countDocuments(), 1); assert.equal(await Receipt.countDocuments(), 1);
  assert.equal((await Tournament.findById(f.tournament._id)).participants.length, 1);
});
test('older authorized/failed events cannot downgrade a captured payment', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const payment = paymentFor(checkout);
  await verify(f, checkout, payment); await event(payment, 'evt_old_auth', 'payment.authorized'); await event(payment, 'evt_old_failed', 'payment.failed');
  assert.equal((await Order.findById(checkout.paymentOrderId)).status, 'captured'); assert.equal(await Registration.countDocuments(), 1);
});
test('missed callback and webhook recover through provider order payments without a stored payment ID', async () => {
  const f = await fixture(); const { checkout } = await payable(f); paymentFor(checkout);
  assert.equal((await Order.findById(checkout.paymentOrderId)).gatewayPaymentId, null);
  await service.reconcile(options()); assert.equal(await Registration.countDocuments(), 1);
});
test('fulfillment failure retains captured evidence and rolls back registration, claim transfer and receipt', async () => {
  const f = await fixture(); const { checkout, intent } = await payable(f); const payment = paymentFor(checkout);
  await assert.rejects(service.verify({ userId: f.users[0]._id, paymentOrderId: checkout.paymentOrderId, razorpay_order_id: checkout.razorpayOrderId,
    razorpay_payment_id: payment.id, razorpay_signature: signature(`${checkout.razorpayOrderId}|${payment.id}`) }, { ...options(), failDuringFulfillment: true }), { code: 'SIMULATED_FAILURE' });
  assert.equal(await Registration.countDocuments(), 0); assert.equal(await Receipt.countDocuments(), 0); assert.equal(await Claim.countDocuments({ intentId: intent._id }), 13);
  assert.equal((await Order.findById(checkout.paymentOrderId)).fulfillmentStatus, 'captured_unfulfilled');
  await service.reconcile(options()); assert.equal(await Registration.countDocuments(), 1);
});
test('expired unpaid reservations release exactly once; retry preserves rejected history policy', async () => {
  const f = await fixture(); const intent = await service.createIntent(f.args);
  await Intent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': new Date(0) } });
  await Promise.all([service.reconcile(options()), service.reconcile(options())]);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0); assert.equal(await Claim.countDocuments(), 0);
  await service.createIntent({ ...f.args, idempotencyKey: 'retry-key-1234' }); assert.equal(await Intent.countDocuments(), 2);
});
test('late captured payment never registers and opens one manual review', async () => {
  const f = await fixture(); const { checkout, intent } = await payable(f);
  await Intent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': new Date(0) } });
  const payment = paymentFor(checkout); const result = await verify(f, checkout, payment); assert.equal(result.reviewRequired, true);
  await event(payment); assert.equal(await Review.countDocuments(), 1); assert.equal(await Registration.countDocuments(), 0);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0); assert.equal(await Claim.countDocuments(), 0);
});
test('payment order reuse and uncertain provider creation never create another charge opportunity', async () => {
  const f = await fixture(); const { intent, checkout } = await payable(f);
  const reused = await service.createOrder({ userId: f.users[0]._id, intentId: intent._id, idempotencyKey: 'order-key-other' }, options()); assert.equal(reused.razorpayOrderId, checkout.razorpayOrderId);
  const g = await fixture(); const reserve = await service.createIntent(g.args); const create = adapter.createOrder.bind(adapter);
  adapter.createOrder = async data => { await create(data); throw new Error('secret-provider-error'); };
  await assert.rejects(service.createOrder({ userId: g.users[0]._id, intentId: reserve._id, idempotencyKey: 'uncertain-key-123' }, options()), { code: 'PAYMENT_REQUIRES_RECONCILIATION' });
  await assert.rejects(service.createOrder({ userId: g.users[0]._id, intentId: reserve._id, idempotencyKey: 'uncertain-key-456' }, options()), { code: 'PAYMENT_REQUIRES_RECONCILIATION' });
  assert.equal(orders.size, 2); await service.reconcile(options()); assert.ok((await Order.findOne({ intentId: reserve._id })).gatewayOrderId);
});
test('failed webhook processing retries the same event and invalid signatures create no event', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const payment = paymentFor(checkout); const rawBody = eventBody(payment);
  await assert.rejects(service.webhook({ rawBody, signature: '0'.repeat(64), eventId: 'evt_bad' }, options()), { code: 'INVALID_WEBHOOK_SIGNATURE' });
  assert.equal(await Event.countDocuments(), 0);
  const fetch = adapter.fetchPayment.bind(adapter); adapter.fetchPayment = async () => { throw Error('secret-network-error'); };
  await assert.rejects(event(payment, 'evt_retry'), { code: 'EVENT_RETRY_REQUIRED' });
  adapter.fetchPayment = fetch; await event(payment, 'evt_retry'); assert.equal(await Event.countDocuments(), 1); assert.equal(await Registration.countDocuments(), 1);
});
test('paid cancellation preserves history, releases capacity and opens refund review without issuing a refund', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const output = await verify(f, checkout, paymentFor(checkout));
  await registration.transition({ registrationId: output.registrationId, actor: { userId: f.users[0]._id, role: 'user' }, action: 'cancel' });
  assert.equal((await Registration.findById(output.registrationId)).status, 'rejected'); assert.equal(await Review.countDocuments({ reason: 'captain_cancelled' }), 1);
  assert.equal(await Claim.countDocuments(), 0); assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0); assert.equal(refunds.size, 0);
});
test('refund approval is admin-only; supplied ID alone cannot mark refunded', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const output = await verify(f, checkout, paymentFor(checkout));
  await registration.transition({ registrationId: output.registrationId, actor: { userId: admin._id, role: 'admin' }, action: 'reject', reason: 'Invalid roster' });
  const review = await Review.findOne();
  for (const role of ['user', 'designer', 'moderator']) await assert.rejects(service.reviewRefund({ reviewId: review._id, actor: { userId: admin._id, role }, decision: 'approve', reason: 'Review' }), { code: 'FORBIDDEN' });
  const args = { reviewId: review._id, actor: { userId: admin._id, role: 'admin' } };
  await service.reviewRefund({ ...args, decision: 'approve', reason: 'Full refund approved' });
  refunds.set('rfnd_fiction', { id: 'rfnd_fiction', payment_id: 'pay_wrong', amount: 50000, currency: 'INR', status: 'processed' });
  await assert.rejects(service.reviewRefund({ ...args, decision: 'check_refund', refundId: 'rfnd_fiction' }, options()), { code: 'REFUND_MISMATCH' });
  refunds.get('rfnd_fiction').payment_id = (await Order.findById(checkout.paymentOrderId)).gatewayPaymentId;
  refunds.get('rfnd_fiction').status = 'pending'; await service.reviewRefund({ ...args, decision: 'check_refund', refundId: 'rfnd_fiction' }, options()); assert.equal((await Review.findById(review._id)).status, 'approved');
  refunds.get('rfnd_fiction').status = 'processed'; await service.reviewRefund({ ...args, decision: 'check_refund', refundId: 'rfnd_fiction' }, options()); assert.equal((await Review.findById(review._id)).status, 'processed');
});
test('fee edits serialize with reservations and cannot modify an existing fee snapshot', async () => {
  const f = await fixture(); await service.changeFee(f.tournament._id, 750); const intent = await service.createIntent(f.args);
  assert.equal(intent.feeSnapshot.amountMinor, 75000); await assert.rejects(service.changeFee(f.tournament._id, 500), { code: 'TOURNAMENT_FEE_LOCKED' });
});
test('API authorization, private status reads, public privacy and sanitized failures', async () => {
  const f = await fixture(); const { intent } = await payable(f);
  assert.equal((await request('/api/valorant-payments/intents', 'POST', f.args)).status, 401);
  assert.equal((await request(`/api/valorant-payments/intents/${intent._id}`, 'GET', null, admin)).status, 404);
  for (const role of ['user', 'designer', 'moderator']) {
    const actor = await User.create({ username: `role-${role}`, fullName: 'Fiction Role', email: `${role}@example.com`, authProvider: 'google', role });
    assert.equal((await request('/api/valorant-payments/refund-reviews', 'GET', null, actor)).status, 403);
    assert.equal((await request(`/api/valorant-payments/refund-reviews/${new mongoose.Types.ObjectId()}`, 'POST', { decision: 'approve' }, actor)).status, 403);
  }
  const response = await request('/api/valorant-payments/verify', 'POST', { paymentOrderId: intent.paymentOrderId, razorpay_signature: 'secret' }, f.users[0]);
  assert.ok(response.status >= 400); assert.doesNotMatch(await response.text(), /secret|stack|password|key_secret/);
  const publicResponse = await request(`/api/valorant-registration/tournament/${f.tournament._id}/teams`, 'GET'); assert.doesNotMatch(await publicResponse.text(), /paymentOrderId|riotId|email/);
});

test('expiry releases authorized or uncertain orders without deleting financial evidence', async () => {
  const f = await fixture(); const { checkout, intent } = await payable(f); const payment = paymentFor(checkout, 'authorized');
  await Intent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': new Date(0) } });
  await service.reconcile(options()); assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0);
  assert.equal(await Claim.countDocuments(), 0); assert.equal(await Order.countDocuments(), 1); assert.equal(await Registration.countDocuments(), 0);
  payment.status = 'captured'; await service.reconcile(options()); assert.equal(await Registration.countDocuments(), 0); assert.equal(await Review.countDocuments(), 1);
});
test('provider outage cannot prolong an expired reservation and does not erase the order', async () => {
  const f = await fixture(); const { intent } = await payable(f);
  await Intent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': new Date(0) } });
  adapter.fetchOrder = async () => { throw Error('secret-provider-outage'); };
  await service.reconcile(options()); assert.equal(await Claim.countDocuments(), 0); assert.equal(await Order.countDocuments(), 1);
  assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 0);
});
test('missing required unique index blocks checkout before any reservation writes', async () => {
  const f = await fixture(); await Receipt.collection.dropIndex('uniq_receipt_payment_order');
  try { await assert.rejects(service.createIntent(f.args), { code: 'PAYMENT_INDEX_REQUIRED' }); assert.equal(await Intent.countDocuments(), 0); assert.equal(await Claim.countDocuments(), 0); }
  finally { await Receipt.collection.createIndex({ paymentOrderId: 1 }, { unique: true, name: 'uniq_receipt_payment_order' }); }
});
test('roster overlap with an unpaid reservation is blocked across different teams', async () => {
  const a = await fixture(), b = await fixture(); b.args.tournamentId = a.tournament._id;
  await Team.updateOne({ _id: b.team._id }, { $set: { 'members.1.userId': a.users[1]._id } });
  await service.createIntent(a.args); await assert.rejects(service.createIntent(b.args), { code: 'REGISTRATION_CONFLICT' });
  assert.equal(await Intent.countDocuments(), 1); assert.equal(await Claim.countDocuments(), 13);
});
test('tampered claim transfer rolls back and retains captured money for recovery', async () => {
  const f = await fixture(); const { checkout, intent } = await payable(f); const payment = paymentFor(checkout);
  await Claim.updateOne({ intentId: intent._id, type: 'team' }, { $set: { value: 'wrong-team' } });
  await assert.rejects(verify(f, checkout, payment), { code: 'CLAIM_STATE_MISMATCH' }); assert.equal(await Registration.countDocuments(), 0);
  assert.equal((await Order.findById(checkout.paymentOrderId)).status, 'captured'); assert.equal(await Receipt.countDocuments(), 0);
});
test('financial activity prevents tournament deletion and paid rejection permits a fresh attempt', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const output = await verify(f, checkout, paymentFor(checkout));
  await assert.rejects(service.deleteUnusedTournament(f.tournament._id), { code: 'PAYMENT_ACTIVITY_EXISTS' });
  await registration.transition({ registrationId: output.registrationId, actor: { userId: admin._id, role: 'admin' }, action: 'reject', reason: 'Fictional roster rejection' });
  const nextIntent = await service.createIntent({ ...f.args, idempotencyKey: 'new-paid-attempt-key' }); assert.equal(await Registration.countDocuments({ status: 'rejected' }), 1);
  assert.equal(await Review.countDocuments(), 1); assert.equal(await Intent.countDocuments(), 2); assert.equal((await Tournament.findById(f.tournament._id)).currentParticipants, 1);
  const nextCheckout = await service.createOrder({ userId: f.args.userId, intentId: nextIntent._id, idempotencyKey: 'new-paid-order-key' }, options());
  const next = await verify(f, nextCheckout, paymentFor(nextCheckout));
  assert.notEqual(String(next.registrationId), String(output.registrationId));
  assert.equal(await Registration.countDocuments(), 2);
  assert.equal(await Receipt.countDocuments(), 2);
  assert.equal((await Registration.findById(next.registrationId)).registrationFlow, 'valorant_v1');
});

test('real SDK transport is bounded and disables inherited proxies and redirects without connecting', () => {
  const real = new RazorpayAdapter({ keyId: 'rzp_test_disposable', keySecret: secret, webhookSecret: secret });
  assert.equal(real.client.api.rq.defaults.timeout, 10000); assert.equal(real.client.api.rq.defaults.maxRedirects, 0); assert.equal(real.client.api.rq.defaults.proxy, false);
});

test('captured paid registration remains compatible with roster verification and competitive results', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const output = await verify(f, checkout, paymentFor(checkout));
  const row = await registration.transition({ registrationId: output.registrationId, actor: { userId: admin._id, role: 'moderator' }, action: 'verify' });
  assert.equal(row.status, 'verified'); assert.equal(row.payment.status, 'paid');
  await require('../game-results/registration-team').validateRegistrationTeam(row, 'valorant');
  const other = await fixture(); other.args.tournamentId = f.tournament._id;
  const second = await payable(other); const secondRow = await verify(other, second.checkout, paymentFor(second.checkout));
  await registration.transition({ registrationId: secondRow.registrationId, actor: { userId: admin._id, role: 'admin' }, action: 'verify' });
  const match = await require('../valorant-results/valorant-results.service').createValorantResult({ actorId: admin._id, payload: {
    tournamentId: f.tournament._id, matchNumber: 1, status: 'verified', teamA: { registrationId: row._id, score: 13 }, teamB: { registrationId: secondRow.registrationId, score: 4 }
  } });
  assert.equal(match.teamA.rosterSnapshot.length, 6);
  const stats = await require('../statistics/statistics.service').getPlayerStatistics(f.users[1].username);
  assert.equal(stats.overview.tournamentsJoined, 1); assert.equal(stats.games.valorant.performance.matchesParticipated, 1);
  assert.equal(await Review.countDocuments(), 0);
});

test('checkout-only pause preserves settlement of already captured money', async () => {
  const f = await fixture(); const { checkout } = await payable(f); const payment = paymentFor(checkout);
  process.env.VALORANT_CHECKOUT_PAUSED = 'true';
  await assert.rejects(service.createIntent({ ...f.args, idempotencyKey: 'paused-request-key' }), { code: 'CHECKOUT_PAUSED' });
  await verify(f, checkout, payment); assert.equal(await Registration.countDocuments(), 1);
});

test('existing admin tournament API rejects fee changes, game conversion and force-deletion after checkout', async () => {
  const f = await fixture(); await payable(f);
  const path = `/api/tournaments/${f.tournament._id}`;
  assert.equal((await request(path, 'PUT', { entryFee: 750 }, admin)).status, 409);
  assert.equal((await request(path, 'PUT', { gameType: 'bgmi' }, admin)).status, 409);
  assert.equal((await request(path + '?force=true', 'DELETE', null, admin)).status, 409);
  assert.equal((await Tournament.findById(f.tournament._id)).entryFee, 500);
});

test('payment acceptance requires reconciliation and importing the worker starts no job', async () => {
  const f = await fixture(); delete process.env.VALORANT_PAYMENT_WORKER_ENABLED;
  await assert.rejects(service.createIntent(f.args), { code: 'PAYMENT_RECOVERY_DISABLED' }); assert.equal(await Intent.countDocuments(), 0);
  const set = global.setInterval; let scheduled = false;
  try { global.setInterval = () => { scheduled = true; throw Error('Unexpected worker timer'); }; require('./payment-worker').start(); assert.equal(scheduled, false); }
  finally { global.setInterval = set; }
});

test('admin fee and other tournament edits commit together or roll back together', async () => {
  const f = await fixture(); const path = `/api/tournaments/${f.tournament._id}`;
  assert.equal((await request(path, 'PUT', { entryFee: 750, mode: 'invalid-mode' }, admin)).status, 400);
  assert.equal((await Tournament.findById(f.tournament._id)).entryFee, 500);
  assert.equal((await request(path, 'PUT', { entryFee: 750 }, admin)).status, 200);
  assert.equal((await Tournament.findById(f.tournament._id)).entryFee, 750);
});

test('stale tournament edits cannot restore a prior fee after checkout has reserved', async () => {
  const f = await fixture(); const stale = await Tournament.findById(f.tournament._id); stale.name = 'Changed tournament name';
  await service.changeFee(f.tournament._id, 750); await service.createIntent(f.args);
  await service.saveTournamentUpdate(stale);
  assert.equal((await Tournament.findById(f.tournament._id)).entryFee, 750);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
const Team = require('../teams/team.model');
const TournamentRegistration = require('../../models/TournamentRegistration');
const TournamentRegistrationClaim = require('../../models/TournamentRegistrationClaim');
const RegistrationIntent = require('../registration-intents/registration-intent.model');
const PaymentOrder = require('./payment-order.model');
const PaymentEvent = require('./payment-event.model');
const PaymentReceipt = require('./payment-receipt.model');
const PaymentNotificationIntent = require('./payment-notification-intent.model');
const {
  createRegistrationIntent,
  expireDueUnpaidIntents
} = require('../registration-intents/registration-intent.service');
const {
  createPaymentOrder,
  handleRazorpayWebhook,
  reconcilePayments,
  verifyRazorpayCheckout
} = require('./payment.service');
const { RazorpayAdapter } = require('./razorpay.adapter');

let replSet;
let userSeq = 0;
let teamSeq = 0;
let tournamentSeq = 0;

const futureDate = (minutes = 60) => new Date(Date.now() + minutes * 60 * 1000);
const secret = 'test_secret';
const webhookSecret = 'webhook_secret';

const models = {
  Tournament,
  Team,
  User,
  TournamentRegistration,
  RegistrationIntent,
  PaymentOrder,
  PaymentEvent,
  PaymentReceipt,
  PaymentNotificationIntent,
  ClaimModel: TournamentRegistrationClaim
};

class MockRazorpayAdapter {
  constructor() {
    this.keyId = 'rzp_test_mock';
    this.orders = new Map();
    this.payments = new Map();
    this.createOrderCalls = 0;
    this.createOrderError = null;
    this.omitCreatedOrder = false;
  }

  getPublicConfig() {
    return { keyId: this.keyId };
  }

  async createOrder({ amountMinor, currency, receipt, notes }) {
    this.createOrderCalls += 1;
    if (this.createOrderError) {
      throw this.createOrderError;
    }
    const order = {
      id: `order_mock_${this.createOrderCalls}`,
      entity: 'order',
      amount: amountMinor,
      amount_paid: 0,
      amount_due: amountMinor,
      currency,
      receipt,
      status: 'created',
      attempts: 0,
      created_at: Math.floor(Date.now() / 1000),
      notes
    };
    if (!this.omitCreatedOrder) {
      this.orders.set(order.id, order);
    }
    return order;
  }

  async fetchOrder(orderId) {
    return this.orders.get(orderId);
  }

  async findOrdersByReceipt(receipt) {
    const items = Array.from(this.orders.values()).filter((order) => order.receipt === receipt);
    return { entity: 'collection', count: items.length, items };
  }

  async fetchOrderPayments(orderId) {
    const items = Array.from(this.payments.values()).filter((payment) => payment.order_id === orderId);
    return { entity: 'collection', count: items.length, items };
  }

  async fetchPayment(paymentId) {
    return this.payments.get(paymentId);
  }

  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    return expected === signature;
  }

  verifyWebhookSignature(rawBody, signature) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    return expected === signature;
  }

  addPayment({ id, orderId, amount = 50000, currency = 'INR', status = 'captured' }) {
    const payment = {
      id,
      entity: 'payment',
      amount,
      currency,
      status,
      order_id: orderId,
      method: 'upi',
      captured: status === 'captured',
      created_at: Math.floor(Date.now() / 1000)
    };
    this.payments.set(id, payment);
    return payment;
  }
}

const checkoutSignature = (orderId, paymentId) => (
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
);

const webhookBody = ({ id = 'evt_1', event = 'payment.captured', payment, order = null }) => Buffer.from(JSON.stringify({
  id,
  event,
  created_at: Math.floor(Date.now() / 1000),
  account_id: 'acc_test',
  payload: {
    payment: { entity: payment },
    ...(order ? { order: { entity: order } } : {})
  }
}));

const webhookSignature = (body) => crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

const createUser = async ({ riotId, phone } = {}) => {
  userSeq += 1;
  return User.create({
    username: `pay_user_${userSeq}`,
    fullName: `Payment User ${userSeq}`,
    email: `pay_user_${userSeq}@example.com`,
    phone,
    authProvider: 'google',
    gameIds: { valorant: riotId || `Pay${userSeq}#TAG${userSeq}` }
  });
};

const createUsers = async () => Promise.all(Array.from({ length: 6 }, (_, index) => createUser({
  phone: index === 0 ? `98767${String(userSeq + index).padStart(5, '0')}` : undefined
})));

const createAdmin = async () => {
  userSeq += 1;
  return User.create({
    username: `pay_admin_${userSeq}`,
    fullName: `Payment Admin ${userSeq}`,
    email: `pay_admin_${userSeq}@example.com`,
    phone: `97656${String(userSeq).padStart(5, '0')}`,
    authProvider: 'google',
    role: 'admin'
  });
};

const createValorantTournament = async () => {
  const creator = await createAdmin();
  tournamentSeq += 1;
  const tournament = await Tournament.create({
    name: `Payment Valorant Cup ${tournamentSeq}`,
    description: 'Payment integration test tournament',
    gameType: 'valorant',
    mode: 'team',
    prizePool: 1000,
    maxParticipants: 16,
    currentParticipants: 0,
    startDate: futureDate(120),
    endDate: futureDate(180),
    registrationDeadline: futureDate(60),
    status: 'registration_open',
    rules: 'Payment test rules',
    format: 'elimination',
    createdBy: creator._id
  });
  await Tournament.collection.updateOne({ _id: tournament._id }, {
    $set: {
      entryFeeAmountMinor: 50000,
      entryFeeCurrency: 'INR',
      entryFeeScope: 'team',
      feeVersion: 1
    }
  });
  return Tournament.findById(tournament._id);
};

const createValorantTeam = async ({ users }) => {
  teamSeq += 1;
  return Team.create({
    name: `PayTeam${teamSeq}`,
    tag: `P${teamSeq}`.slice(0, 5),
    game: 'valorant',
    captain: users[0]._id,
    members: users.map((user, index) => ({
      userId: user._id,
      role: index === 0 ? 'captain' : 'member',
      isSubstitute: index === 5
    })),
    maxMembers: 6,
    privacy: 'private',
    isActive: true
  });
};

const createPaidIntent = async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const result = await createRegistrationIntent({
    requesterUserId: users[0]._id,
    gameType: 'valorant',
    tournamentId: tournament._id,
    teamId: team._id,
    idempotencyKey: `intent-${Date.now()}-${Math.random()}`,
    models,
    options: { ignoreCheckoutFeatureFlag: true, ttlMinutes: 15 }
  });
  return { tournament, users, team, intent: result.intent };
};

const createOrderForIntent = async ({ intent, captain, adapter, idempotencyKey = `order-${Date.now()}-${Math.random()}`, options = {} }) => (
  createPaymentOrder({
    intentId: intent._id,
    requesterUserId: captain._id,
    idempotencyKey,
    gatewayAdapter: adapter,
    models,
    options: { ignoreFeatureFlag: true, ...options }
  })
);

test.before(async () => {
  mongoose.set('autoIndex', false);
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri(), {
    dbName: 'payment_checkpoint_3',
    autoIndex: false
  });
  await Promise.all([
    Tournament.createCollection(),
    User.createCollection(),
    Team.createCollection(),
    TournamentRegistration.createCollection(),
    TournamentRegistrationClaim.createCollection(),
    RegistrationIntent.createCollection(),
    PaymentOrder.createCollection(),
    PaymentEvent.createCollection(),
    PaymentReceipt.createCollection(),
    PaymentNotificationIntent.createCollection()
  ]);
  await TournamentRegistration.collection.createIndex({ tournamentId: 1, userId: 1 }, { name: 'tournamentId_1_userId_1' });
  await TournamentRegistrationClaim.collection.createIndex(
    { tournamentId: 1, type: 1, value: 1 },
    { unique: true, name: 'uniq_tournament_registration_claim' }
  );
  await RegistrationIntent.syncIndexes();
  await PaymentOrder.syncIndexes();
  await PaymentEvent.syncIndexes();
  await PaymentReceipt.syncIndexes();
  await PaymentNotificationIntent.syncIndexes();
});

test.beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

test.after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test('Razorpay adapter rejects live credentials and accepts test credentials', () => {
  assert.throws(
    () => new RazorpayAdapter({ keyId: 'rzp_live_bad', keySecret: 'secret', client: {} }),
    /test-mode/
  );
  assert.ok(new RazorpayAdapter({ keyId: 'rzp_test_ok', keySecret: 'secret', client: { orders: {}, payments: {} } }));
});

test('payment order creation is disabled by default', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  await assert.rejects(
    () => createPaymentOrder({
      intentId: intent._id,
      requesterUserId: users[0]._id,
      idempotencyKey: 'disabled-order',
      gatewayAdapter: adapter,
      models
    }),
    (error) => error.code === 'PAYMENT_ORDER_CREATE_DISABLED'
  );
});

test('successful mocked order creation reuses existing live order on retry', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const first = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'order-key-1' });
  const second = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'order-key-2' });

  assert.equal(first.checkout.amountMinor, 50000);
  assert.equal(first.checkout.currency, 'INR');
  assert.equal(second.reused, true);
  assert.equal(adapter.createOrderCalls, 1);
  assert.equal(await PaymentOrder.countDocuments({ intentId: intent._id }), 1);
});

test('invalid captain cannot create payment order', async () => {
  const { intent } = await createPaidIntent();
  const other = await createUser({ phone: '9876799999' });
  const adapter = new MockRazorpayAdapter();
  await assert.rejects(
    () => createOrderForIntent({ intent, captain: other, adapter, idempotencyKey: 'wrong-captain' }),
    (error) => error.code === 'ACCESS_DENIED'
  );
});

test('provider success followed by database failure marks local order unknown and blocks checkout until recovery', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  await assert.rejects(
    () => createOrderForIntent({
      intent,
      captain: users[0],
      adapter,
      idempotencyKey: 'db-fail-order',
      options: { failAfterProviderOrderCreate: true }
    }),
    (error) => error.code === 'SIMULATED_DB_FAILURE_AFTER_PROVIDER_ORDER'
  );
  const order = await PaymentOrder.findOne({ intentId: intent._id });
  assert.equal(order.status, 'provider_create_unknown');
  assert.equal(order.gatewayOrderId, null);
  assert.equal(order.isLiveOrder, true);
  assert.equal(adapter.createOrderCalls, 1);
});

test('provider timeout with unknown outcome blocks repeated checkout and does not create duplicates', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const timeout = new Error('socket timeout');
  timeout.code = 'ETIMEDOUT';
  adapter.createOrderError = timeout;

  await assert.rejects(
    () => createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'timeout-order' }),
    /socket timeout/
  );
  assert.equal((await PaymentOrder.findOne({ intentId: intent._id })).status, 'provider_create_unknown');

  adapter.createOrderError = null;
  await assert.rejects(
    () => createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'timeout-order-retry' }),
    (error) => error.code === 'PAYMENT_PROVIDER_CREATE_UNKNOWN'
  );
  assert.equal(adapter.createOrderCalls, 1);
  assert.equal(await PaymentOrder.countDocuments({ intentId: intent._id }), 1);
  assert.equal((await Tournament.findById(intent.tournamentId)).currentParticipants, 1);
});

test('unknown provider order can be recovered by exact receipt and provider notes match', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  await assert.rejects(
    () => createOrderForIntent({
      intent,
      captain: users[0],
      adapter,
      idempotencyKey: 'recover-db-fail',
      options: { failAfterProviderOrderCreate: true }
    }),
    (error) => error.code === 'SIMULATED_DB_FAILURE_AFTER_PROVIDER_ORDER'
  );

  const recovered = await createOrderForIntent({
    intent,
    captain: users[0],
    adapter,
    idempotencyKey: 'recover-db-fail-retry'
  });
  assert.equal(recovered.reused, true);
  assert.equal(recovered.checkout.razorpayOrderId, 'order_mock_1');
  assert.equal(adapter.createOrderCalls, 1);
  const order = await PaymentOrder.findOne({ intentId: intent._id });
  assert.equal(order.status, 'created');
  assert.equal(order.gatewayOrderId, 'order_mock_1');
});

test('reconciliation recovers unknown provider create attempt when provider receipt lookup is exact', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  await assert.rejects(
    () => createOrderForIntent({
      intent,
      captain: users[0],
      adapter,
      idempotencyKey: 'reconcile-unknown-order',
      options: { failAfterProviderOrderCreate: true }
    }),
    (error) => error.code === 'SIMULATED_DB_FAILURE_AFTER_PROVIDER_ORDER'
  );

  const results = await reconcilePayments({ gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });
  assert.ok(results.some((result) => result.action === 'provider_order_recovered' && result.gatewayOrderId === 'order_mock_1'));
  const order = await PaymentOrder.findOne({ intentId: intent._id });
  assert.equal(order.status, 'created');
  assert.equal(order.gatewayOrderId, 'order_mock_1');
});

test('existing valid provider order is validated before checkout reuse', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const first = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'reuse-valid-provider' });
  adapter.orders.get(first.checkout.razorpayOrderId).status = 'attempted';

  const second = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'reuse-valid-provider-2' });
  assert.equal(second.reused, true);
  assert.equal(second.checkout.razorpayOrderId, first.checkout.razorpayOrderId);
  assert.equal(adapter.createOrderCalls, 1);
});

test('safe replacement is allowed only after provider reports create failure before order creation', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const validationError = new Error('provider validation failed before order creation');
  adapter.createOrderError = validationError;

  await assert.rejects(
    () => createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'safe-fail-before-create' }),
    /provider validation failed/
  );
  const failed = await PaymentOrder.findOne({ intentId: intent._id });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.isLiveOrder, false);

  adapter.createOrderError = null;
  const replacement = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'safe-replacement' });
  assert.equal(replacement.checkout.razorpayOrderId, 'order_mock_2');
  assert.equal(await PaymentOrder.countDocuments({ intentId: intent._id }), 2);
  assert.equal((await Tournament.findById(intent.tournamentId)).currentParticipants, 1);
});

test('checkout verification rejects invalid signature, wrong amount, wrong currency and authorized status', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const { paymentOrder } = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'verify-rejects' });

  adapter.addPayment({ id: 'pay_bad_sig', orderId: paymentOrder.gatewayOrderId });
  await assert.rejects(
    () => verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: 'pay_bad_sig',
      razorpay_signature: 'bad',
      gatewayAdapter: adapter,
      models,
      options: { ignoreFeatureFlag: true }
    }),
    (error) => error.code === 'INVALID_PAYMENT_SIGNATURE'
  );

  adapter.addPayment({ id: 'pay_wrong_amount', orderId: paymentOrder.gatewayOrderId, amount: 40000 });
  await assert.rejects(
    () => verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: 'pay_wrong_amount',
      razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_wrong_amount'),
      gatewayAdapter: adapter,
      models,
      options: { ignoreFeatureFlag: true }
    }),
    (error) => error.code === 'PAYMENT_AMOUNT_MISMATCH'
  );

  adapter.addPayment({ id: 'pay_wrong_currency', orderId: paymentOrder.gatewayOrderId, currency: 'USD' });
  await assert.rejects(
    () => verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: 'pay_wrong_currency',
      razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_wrong_currency'),
      gatewayAdapter: adapter,
      models,
      options: { ignoreFeatureFlag: true }
    }),
    (error) => error.code === 'PAYMENT_CURRENCY_MISMATCH'
  );

  adapter.addPayment({ id: 'pay_authorized', orderId: paymentOrder.gatewayOrderId, status: 'authorized' });
  await assert.rejects(
    () => verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: 'pay_authorized',
      razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_authorized'),
      gatewayAdapter: adapter,
      models,
      options: { ignoreFeatureFlag: true }
    }),
    (error) => error.code === 'PAYMENT_NOT_CAPTURED'
  );
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 0);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 0);
});

test('captured payment fulfills registration exactly once and duplicate verification is safe', async () => {
  const { tournament, users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const { paymentOrder } = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'capture-once' });
  adapter.addPayment({ id: 'pay_capture_once', orderId: paymentOrder.gatewayOrderId });

  const first = await verifyRazorpayCheckout({
    requesterUserId: users[0]._id,
    paymentOrderId: paymentOrder._id,
    razorpay_order_id: paymentOrder.gatewayOrderId,
    razorpay_payment_id: 'pay_capture_once',
    razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_capture_once'),
    gatewayAdapter: adapter,
    models,
    options: { ignoreFeatureFlag: true }
  });
  const second = await verifyRazorpayCheckout({
    requesterUserId: users[0]._id,
    paymentOrderId: paymentOrder._id,
    razorpay_order_id: paymentOrder.gatewayOrderId,
    razorpay_payment_id: 'pay_capture_once',
    razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_capture_once'),
    gatewayAdapter: adapter,
    models,
    options: { ignoreFeatureFlag: true }
  });

  assert.equal(first.registration.status, 'pending');
  assert.equal(second.alreadyProcessed, true);
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ registrationId: first.registration._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 1);

  const receipt = await PaymentReceipt.findOne({ paymentOrderId: paymentOrder._id });
  assert.match(receipt.receiptNumber, /^COLAB-VAL-/);
  assert.equal(receipt.amountMinor, paymentOrder.amountMinor);
  assert.equal(receipt.gatewayPaymentId, 'pay_capture_once');
  assert.equal(receipt.tournamentRegistrationId.toString(), first.registration._id.toString());

  const notificationIntent = await PaymentNotificationIntent.findOne({ paymentOrderId: paymentOrder._id });
  assert.equal(notificationIntent.type, 'payment_receipt_email');
  assert.equal(notificationIntent.status, 'pending');
  assert.equal(notificationIntent.recipientUserId.toString(), users[0]._id.toString());
  assert.equal(notificationIntent.recipientEmail, users[0].email);
});

test('duplicate webhook and callback/webhook concurrency do not double fulfill', async () => {
  const { tournament, users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const { paymentOrder } = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'webhook-once' });
  const payment = adapter.addPayment({ id: 'pay_webhook_once', orderId: paymentOrder.gatewayOrderId });
  const body = webhookBody({ id: 'evt_webhook_once', payment });
  const signature = webhookSignature(body);

  const results = await Promise.allSettled([
    handleRazorpayWebhook({ rawBody: body, signature, gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } }),
    verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: payment.id,
      razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, payment.id),
      gatewayAdapter: adapter,
      models,
      options: { ignoreFeatureFlag: true }
    })
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);

  const duplicate = await handleRazorpayWebhook({ rawBody: body, signature, gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });
  assert.equal(duplicate.duplicate, true);
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal(await PaymentEvent.countDocuments({ gatewayEventId: 'evt_webhook_once' }), 1);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
});

test('late webhook from recovered previous provider attempt associates original local order and fulfills once', async () => {
  const { tournament, users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  await assert.rejects(
    () => createOrderForIntent({
      intent,
      captain: users[0],
      adapter,
      idempotencyKey: 'late-webhook-db-fail',
      options: { failAfterProviderOrderCreate: true }
    }),
    (error) => error.code === 'SIMULATED_DB_FAILURE_AFTER_PROVIDER_ORDER'
  );

  const localOrder = await PaymentOrder.findOne({ intentId: intent._id });
  const providerOrder = adapter.orders.get('order_mock_1');
  const payment = adapter.addPayment({ id: 'pay_late_previous_attempt', orderId: providerOrder.id });
  const body = webhookBody({
    id: 'evt_late_previous_attempt',
    payment,
    order: providerOrder
  });
  await handleRazorpayWebhook({ rawBody: body, signature: webhookSignature(body), gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });

  const recoveredOrder = await PaymentOrder.findById(localOrder._id);
  assert.equal(recoveredOrder.gatewayOrderId, providerOrder.id);
  assert.equal(recoveredOrder.status, 'captured');
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ tournamentId: tournament._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: recoveredOrder._id }), 1);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: recoveredOrder._id }), 1);
});

test('out-of-order authorized webhook then captured webhook fulfills once', async () => {
  const { tournament, users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const { paymentOrder } = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'authorized-then-captured' });
  const authorized = adapter.addPayment({ id: 'pay_auth_then_capture', orderId: paymentOrder.gatewayOrderId, status: 'authorized' });
  const authBody = webhookBody({ id: 'evt_authorized', event: 'payment.authorized', payment: authorized });
  await handleRazorpayWebhook({ rawBody: authBody, signature: webhookSignature(authBody), gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });

  const captured = adapter.addPayment({ id: 'pay_auth_then_capture', orderId: paymentOrder.gatewayOrderId, status: 'captured' });
  const captureBody = webhookBody({ id: 'evt_captured_after_auth', event: 'payment.captured', payment: captured });
  await handleRazorpayWebhook({ rawBody: captureBody, signature: webhookSignature(captureBody), gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });

  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal((await PaymentOrder.findById(paymentOrder._id)).status, 'captured');
});

test('database failure after capture leaves captured-unfulfilled and reconciliation recovers', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const { paymentOrder } = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'reconcile-captured' });
  adapter.addPayment({ id: 'pay_reconcile', orderId: paymentOrder.gatewayOrderId });

  await assert.rejects(
    () => verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: 'pay_reconcile',
      razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_reconcile'),
      gatewayAdapter: adapter,
      models,
      options: { ignoreFeatureFlag: true, failDuringFulfillment: true }
    }),
    (error) => error.code === 'SIMULATED_FULFILLMENT_FAILURE'
  );

  assert.equal((await PaymentOrder.findById(paymentOrder._id)).fulfillmentStatus, 'captured_unfulfilled');
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 0);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 0);
  const results = await reconcilePayments({ gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });
  assert.equal(results[0].action, 'fulfillment_retry');
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: intent.tournamentId }), 1);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
});

test('receipt persistence failure rolls back registration and leaves captured payment recoverable', async () => {
  const { users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const { paymentOrder } = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'receipt-fails' });
  adapter.addPayment({ id: 'pay_receipt_fails', orderId: paymentOrder.gatewayOrderId });

  const failingReceiptModel = {
    findOneAndUpdate() {
      throw new Error('simulated receipt write failure');
    }
  };

  await assert.rejects(
    () => verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: 'pay_receipt_fails',
      razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_receipt_fails'),
      gatewayAdapter: adapter,
      models: { ...models, PaymentReceipt: failingReceiptModel },
      options: { ignoreFeatureFlag: true }
    }),
    /simulated receipt write failure/
  );

  assert.equal((await PaymentOrder.findById(paymentOrder._id)).status, 'captured');
  assert.equal((await PaymentOrder.findById(paymentOrder._id)).fulfillmentStatus, 'captured_unfulfilled');
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: intent.tournamentId }), 0);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 0);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 0);

  const results = await reconcilePayments({ gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });
  assert.equal(results[0].action, 'fulfillment_retry');
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: intent.tournamentId }), 1);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
});

test('reconciliation retries received webhook events durably', async () => {
  const { tournament, users, intent } = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  const { paymentOrder } = await createOrderForIntent({ intent, captain: users[0], adapter, idempotencyKey: 'retry-event' });
  const payment = adapter.addPayment({ id: 'pay_event_retry', orderId: paymentOrder.gatewayOrderId });

  const event = await PaymentEvent.create({
    gateway: 'razorpay',
    gatewayEventId: 'evt_retry_from_reconciliation',
    eventType: 'payment.captured',
    gatewayOrderId: payment.order_id,
    gatewayPaymentId: payment.id,
    signatureVerified: true,
    payloadHash: crypto.createHash('sha256').update('retry-event').digest('hex'),
    sanitizedPayload: {
      event: 'payment.captured',
      created_at: Math.floor(Date.now() / 1000),
      account_id: 'acc_test',
      entity: payment
    },
    processingStatus: 'received'
  });

  const results = await reconcilePayments({ gatewayAdapter: adapter, models, options: { ignoreFeatureFlag: true } });
  assert.ok(results.some((result) => result.paymentEventId?.toString() === event._id.toString() && result.action === 'event_retry_processed'));
  assert.equal((await PaymentEvent.findById(event._id)).processingStatus, 'processed');
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 1);
});

test('late captured payment after released reservation enters review without registration', async () => {
  const { users, intent } = await createPaidIntent();
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': new Date(Date.now() - 1000) } });
  await expireDueUnpaidIntents({ models, now: new Date() });

  const paymentOrder = await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: intent.tournamentId,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    gatewayOrderId: 'order_late_capture',
    amountMinor: intent.feeSnapshot.amountMinor,
    currency: intent.feeSnapshot.currency,
    providerReceipt: `late_${intent._id}`,
    idempotencyKey: 'late-capture-order',
    status: 'created',
    fulfillmentStatus: 'not_started',
    isLiveOrder: true
  });
  const adapter = new MockRazorpayAdapter();
  adapter.addPayment({ id: 'pay_late_capture', orderId: paymentOrder.gatewayOrderId });

  await assert.rejects(
    () => verifyRazorpayCheckout({
      requesterUserId: users[0]._id,
      paymentOrderId: paymentOrder._id,
      razorpay_order_id: paymentOrder.gatewayOrderId,
      razorpay_payment_id: 'pay_late_capture',
      razorpay_signature: checkoutSignature(paymentOrder.gatewayOrderId, 'pay_late_capture'),
      gatewayAdapter: adapter,
      models,
      options: { ignoreFeatureFlag: true }
    }),
    (error) => error.code === 'LATE_CAPTURE_REQUIRES_REVIEW'
  );

  const reviewedOrder = await PaymentOrder.findById(paymentOrder._id);
  assert.equal(reviewedOrder.status, 'capture_late_review');
  assert.equal(reviewedOrder.fulfillmentStatus, 'captured_unfulfilled');
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: intent.tournamentId }), 0);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 0);
  assert.equal(await PaymentNotificationIntent.countDocuments({ paymentOrderId: paymentOrder._id }), 0);
});

test('expired unpaid reservation releases; provider-order reservation is retained for reconciliation', async () => {
  const { intent } = await createPaidIntent();
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': new Date(Date.now() - 1000) } });
  const expired = await expireDueUnpaidIntents({ models, now: new Date() });
  assert.equal(expired[0].expired, true);

  const second = await createPaidIntent();
  const adapter = new MockRazorpayAdapter();
  await createOrderForIntent({ intent: second.intent, captain: second.users[0], adapter, idempotencyKey: 'retain-order' });
  await RegistrationIntent.updateOne({ _id: second.intent._id }, { $set: { 'reservation.expiresAt': new Date(Date.now() - 1000) } });
  const retained = await expireDueUnpaidIntents({ models, now: new Date() });
  assert.equal(retained.some((entry) => entry.reason === 'payment_order_requires_reconciliation'), true);
  assert.equal((await RegistrationIntent.findById(second.intent._id)).reservation.capacityReleased, false);
});

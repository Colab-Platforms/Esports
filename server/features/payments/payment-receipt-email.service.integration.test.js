const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const User = require('../../models/User');
const Tournament = require('../../models/Tournament');
const TournamentRegistration = require('../../models/TournamentRegistration');
const PaymentOrder = require('./payment-order.model');
const PaymentReceipt = require('./payment-receipt.model');
const PaymentNotificationIntent = require('./payment-notification-intent.model');
const {
  claimNextReceiptNotification,
  preflightReceiptNotification,
  processReceiptNotificationBatch,
  processTargetedReceiptNotification,
  receiptNotificationIdempotencyKey
} = require('./payment-receipt-email.service');

let replSet;
let seq = 0;

class MockReceiptEmailSender {
  constructor({ mode = 'success', delayMs = 0 } = {}) {
    this.mode = mode;
    this.delayMs = delayMs;
    this.calls = [];
  }

  async send(payload) {
    this.calls.push(payload);
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.mode === 'transient') {
      return { data: null, error: { name: 'rate_limit_exceeded', statusCode: 429, message: 'Slow down' } };
    }
    if (this.mode === 'concurrent') {
      return { data: null, error: { name: 'concurrent_idempotent_requests', statusCode: 409, message: 'Request already in progress' } };
    }
    if (this.mode === 'invalid_idempotent') {
      return { data: null, error: { name: 'invalid_idempotent_request', statusCode: 409, message: 'Idempotency key payload conflict' } };
    }
    if (this.mode === 'permanent') {
      return { data: null, error: { name: 'invalid_from_address', statusCode: 400, message: 'Invalid sender' } };
    }
    if (this.mode === 'unknown') {
      return { data: null, error: null };
    }
    return { data: { id: `email_${this.calls.length}` }, error: null };
  }
}

const createReceiptFixture = async ({
  email = `captain${seq + 1}@colabesports.in`,
  isEmailVerified = true,
  notificationOverrides = {}
} = {}) => {
  seq += 1;
  const captain = await User.create({
    username: `receipt_captain_${seq}`,
    fullName: `Receipt Captain ${seq}`,
    email,
    phone: `98765${String(seq).padStart(5, '0')}`,
    authProvider: 'google',
    isEmailVerified,
    gameIds: { valorant: `Receipt${seq}#TAG${seq}` }
  });
  const admin = await User.create({
    username: `receipt_admin_${seq}`,
    fullName: `Receipt Admin ${seq}`,
    email: `receipt_admin_${seq}@colabesports.in`,
    phone: `97654${String(seq).padStart(5, '0')}`,
    authProvider: 'google',
    isEmailVerified: true,
    role: 'admin'
  });
  const tournament = await Tournament.create({
    name: `Receipt Valorant ${seq}`,
    description: 'Receipt delivery test',
    gameType: 'valorant',
    mode: 'team',
    prizePool: 1000,
    maxParticipants: 16,
    currentParticipants: 1,
    startDate: new Date(Date.now() + 60 * 60 * 1000),
    endDate: new Date(Date.now() + 120 * 60 * 1000),
    registrationDeadline: new Date(Date.now() + 30 * 60 * 1000),
    status: 'registration_open',
    rules: 'Receipt rules',
    format: 'elimination',
    createdBy: admin._id
  });
  const paymentOrder = await PaymentOrder.create({
    intentId: new mongoose.Types.ObjectId(),
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: captain._id,
    gateway: 'razorpay',
    gatewayOrderId: `order_receipt_${seq}`,
    gatewayPaymentId: `pay_receipt_${seq}`,
    amountMinor: 55000,
    currency: 'INR',
    status: 'captured',
    fulfillmentStatus: 'fulfilled',
    isLiveOrder: true,
    providerReceipt: `receipt_provider_${seq}`,
    idempotencyKey: `receipt_order_${seq}`,
    capturedAt: new Date()
  });
  const registration = await TournamentRegistration.create({
    tournamentId: tournament._id,
    userId: captain._id,
    teamName: `Receipt Team ${seq}`,
    teamLeader: {
      name: captain.fullName,
      riotId: { name: 'Receipt', tag: `T${seq}` },
      phone: captain.phone
    },
    teamMembers: [1, 2, 3, 4].map((number) => ({
      name: `Member ${number}`,
      riotId: { name: `Member${number}`, tag: `T${seq}` }
    })),
    substitutePlayer: {
      name: 'Substitute',
      riotId: { name: 'Substitute', tag: `T${seq}` }
    },
    roster: [
      captain._id,
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId()
    ].map((userId, index) => ({
      userId,
      username: `roster_${seq}_${index}`,
      riotId: `Roster${index}#T${seq}`,
      normalizedRiotId: `roster${index}#t${seq}`,
      role: index === 5 ? 'substitute' : 'starter'
    })),
    whatsappNumber: captain.phone,
    status: 'pending',
    payment: {
      status: 'paid',
      amountMinor: paymentOrder.amountMinor,
      currency: 'INR',
      feeScope: 'team',
      intentId: paymentOrder.intentId,
      paymentOrderId: paymentOrder._id,
      paidAt: paymentOrder.capturedAt,
      refundStatus: 'not_applicable'
    }
  });
  const receipt = await PaymentReceipt.create({
    receiptNumber: `COLAB-VAL-${String(seq).padStart(6, '0')}`,
    paymentOrderId: paymentOrder._id,
    registrationIntentId: paymentOrder.intentId,
    tournamentRegistrationId: registration._id,
    tournamentId: tournament._id,
    captainUserId: captain._id,
    teamName: registration.teamName,
    amountMinor: paymentOrder.amountMinor,
    currency: paymentOrder.currency,
    gateway: paymentOrder.gateway,
    gatewayPaymentId: paymentOrder.gatewayPaymentId,
    capturedAt: paymentOrder.capturedAt
  });
  const notificationIntent = await PaymentNotificationIntent.create({
    type: 'payment_receipt_email',
    paymentOrderId: paymentOrder._id,
    receiptId: receipt._id,
    recipientUserId: captain._id,
    recipientEmail: email,
    ...notificationOverrides
  });

  return { captain, tournament, paymentOrder, registration, receipt, notificationIntent };
};

test.before(async () => {
  mongoose.set('autoIndex', false);
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri(), {
    dbName: 'receipt_email_delivery',
    autoIndex: false
  });
  await Promise.all([
    User.createCollection(),
    Tournament.createCollection(),
    TournamentRegistration.createCollection(),
    PaymentOrder.createCollection(),
    PaymentReceipt.createCollection(),
    PaymentNotificationIntent.createCollection()
  ]);
  await PaymentOrder.syncIndexes();
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

test('one eligible receipt notification is processed successfully', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'sent');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'sent');
  assert.equal(updated.providerMessageId, 'email_1');
  assert.equal(sender.calls[0].idempotencyKey, receiptNotificationIdempotencyKey(notificationIntent._id));
  assert.match(sender.calls[0].payload.text, /Pending Admin Review/);
});

test('concurrent workers do not claim the same active notification', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const [first, second] = await Promise.all([
    claimNextReceiptNotification({ claimToken: 'worker-a' }),
    claimNextReceiptNotification({ claimToken: 'worker-b' })
  ]);

  assert.equal([first, second].filter(Boolean).length, 1);
  assert.equal((first || second)._id.toString(), notificationIntent._id.toString());
});

test('provider failure triggers a bounded retry without changing payment status', async () => {
  const { paymentOrder, notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender({ mode: 'transient' });

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'retry_scheduled');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'failed');
  assert.equal(updated.attempts, 1);
  assert.ok(updated.nextAttemptAt > updated.lastAttemptAt);
  assert.equal((await PaymentOrder.findById(paymentOrder._id)).status, 'captured');
  assert.equal((await PaymentOrder.findById(paymentOrder._id)).fulfillmentStatus, 'fulfilled');
});

test('concurrent idempotent Resend response is retryable and remains uncertain', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender({ mode: 'concurrent' });

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'delivery_uncertain');
  assert.equal(results[0].code, 'concurrent_idempotent_requests');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'delivery_uncertain');
  assert.equal(updated.providerIdempotencyKey, receiptNotificationIdempotencyKey(notificationIntent._id));
  assert.ok(updated.nextAttemptAt > updated.lastAttemptAt);
});

test('invalid idempotent Resend response requires manual attention', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender({ mode: 'invalid_idempotent' });

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'needs_attention');
  assert.equal(results[0].code, 'invalid_idempotent_request');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'needs_attention');
  assert.equal(updated.nextAttemptAt, null);
});

test('slow provider request times out before lease expiry and preserves uncertainty', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender({ delayMs: 1200 });

  const results = await processReceiptNotificationBatch({
    sender,
    options: {
      ignoreFeatureFlag: true,
      batchSize: 1,
      leaseSeconds: 2,
      sendTimeoutSeconds: 1
    }
  });

  assert.equal(results[0].action, 'delivery_uncertain');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'delivery_uncertain');
  assert.ok(updated.firstProviderSubmittedAt);
  assert.equal(updated.providerRequestSnapshot.subject.includes('Payment received'), true);
});

test('permanent failure enters needs_attention and does not retry forever', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender({ mode: 'permanent' });

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'needs_attention');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'needs_attention');
  assert.equal(updated.nextAttemptAt, null);
});

test('an expired processing lease can be recovered', async () => {
  const { notificationIntent } = await createReceiptFixture({
    notificationOverrides: {
      status: 'processing',
      attempts: 1,
      claimToken: 'stale-worker',
      lockedUntil: new Date(Date.now() - 60_000)
    }
  });
  const sender = new MockReceiptEmailSender();

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'sent');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'sent');
  assert.equal(updated.attempts, 2);
});

test('repeated processing does not create another receipt or paid registration', async () => {
  const { paymentOrder, registration, receipt } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  await processReceiptNotificationBatch({ sender, options: { ignoreFeatureFlag: true, batchSize: 1 } });
  const second = await processReceiptNotificationBatch({ sender, options: { ignoreFeatureFlag: true, batchSize: 1 } });

  assert.deepEqual(second, []);
  assert.equal(await PaymentReceipt.countDocuments({ paymentOrderId: paymentOrder._id }), 1);
  assert.equal(await TournamentRegistration.countDocuments({ _id: registration._id }), 1);
  assert.equal((await PaymentReceipt.findById(receipt._id)).receiptNumber, receipt.receiptNumber);
  assert.equal(sender.calls.length, 1);
});

test('unverified or invalid recipient addresses are held for attention', async () => {
  const { notificationIntent } = await createReceiptFixture({
    email: 'unverified@colabesports.in',
    isEmailVerified: false
  });
  const sender = new MockReceiptEmailSender();

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'needs_attention');
  assert.equal(sender.calls.length, 0);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).status, 'needs_attention');
});

test('provider success followed by local persistence failure is retried with the same idempotency key', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  const first = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1, failAfterProviderAccept: true }
  });
  assert.equal(first[0].action, 'delivery_uncertain');
  const uncertain = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(uncertain.status, 'delivery_uncertain');
  assert.equal(uncertain.providerMessageId, 'email_1');

  await PaymentNotificationIntent.updateOne(
    { _id: notificationIntent._id },
    { $set: { nextAttemptAt: new Date(Date.now() - 1000) } }
  );
  const second = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });
  assert.equal(second[0].action, 'sent');
  assert.equal(sender.calls[0].idempotencyKey, sender.calls[1].idempotencyKey);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).status, 'sent');
});

test('stale worker cannot overwrite current owner status after losing claim', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const claimed = await claimNextReceiptNotification({ claimToken: 'stale-owner' });
  await PaymentNotificationIntent.updateOne(
    { _id: claimed._id },
    {
      $set: {
        claimToken: 'fresh-owner',
        lockedUntil: new Date(Date.now() + 60_000)
      }
    }
  );

  const sender = new MockReceiptEmailSender();
  const result = await require('./payment-receipt-email.service').processClaimedReceiptNotification({
    notificationIntent: claimed,
    claimToken: 'stale-owner',
    sender,
    options: { ignoreFeatureFlag: true, leaseSeconds: 120 }
  });

  assert.equal(result.action, 'claim_lost');
  assert.equal(sender.calls.length, 0);
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'processing');
  assert.equal(updated.claimToken, 'fresh-owner');
});

test('uncertain delivery after Resend idempotency window is held for manual review', async () => {
  const oldSubmission = new Date(Date.now() - (25 * 60 * 60 * 1000));
  const { notificationIntent } = await createReceiptFixture({
    notificationOverrides: {
      status: 'delivery_uncertain',
      attempts: 1,
      firstProviderSubmittedAt: oldSubmission,
      providerIdempotencyKey: 'payment-receipt-email-old',
      nextAttemptAt: new Date(Date.now() - 1000)
    }
  });
  const sender = new MockReceiptEmailSender();

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'needs_attention');
  assert.equal(results[0].code, 'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED');
  assert.equal(sender.calls.length, 0);
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'needs_attention');
  assert.equal(updated.firstProviderSubmittedAt.getTime(), oldSubmission.getTime());
});

test('repeated transient failures eventually exhaust retry budget', async () => {
  const { notificationIntent } = await createReceiptFixture({
    notificationOverrides: {
      maxAttempts: 1
    }
  });
  const sender = new MockReceiptEmailSender({ mode: 'transient' });

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'needs_attention');
  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(updated.status, 'needs_attention');
  assert.equal(updated.attempts, 1);
  assert.equal(updated.nextAttemptAt, null);
});

test('targeted processing sends exactly the intended notification', async () => {
  const first = await createReceiptFixture();
  const second = await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  const results = await processTargetedReceiptNotification({
    notificationIntentId: second.notificationIntent._id.toString(),
    sender,
    options: { ignoreFeatureFlag: true }
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].action, 'sent');
  assert.equal(results[0].notificationIntentId.toString(), second.notificationIntent._id.toString());
  assert.equal(sender.calls.length, 1);
  assert.equal(sender.calls[0].idempotencyKey, receiptNotificationIdempotencyKey(second.notificationIntent._id));
  assert.equal((await PaymentNotificationIntent.findById(first.notificationIntent._id)).status, 'pending');
  assert.equal((await PaymentNotificationIntent.findById(second.notificationIntent._id)).status, 'sent');
});

test('targeted processing rejects invalid ObjectId without sending', async () => {
  await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  const results = await processTargetedReceiptNotification({
    notificationIntentId: 'not-an-object-id',
    sender,
    options: { ignoreFeatureFlag: true }
  });

  assert.equal(results[0].action, 'target_invalid');
  assert.equal(sender.calls.length, 0);
  assert.equal(await PaymentNotificationIntent.countDocuments({ status: 'pending' }), 1);
});

test('missing targeted notification does not fall back to another eligible notification', async () => {
  await createReceiptFixture();
  const sender = new MockReceiptEmailSender();
  const missingId = new mongoose.Types.ObjectId().toString();

  const results = await processTargetedReceiptNotification({
    notificationIntentId: missingId,
    sender,
    options: { ignoreFeatureFlag: true }
  });

  assert.equal(results[0].action, 'target_not_eligible');
  assert.equal(sender.calls.length, 0);
  assert.equal(await PaymentNotificationIntent.countDocuments({ status: 'pending' }), 1);
});

test('targeted processing does not resend an already sent notification', async () => {
  const { notificationIntent } = await createReceiptFixture({
    notificationOverrides: {
      status: 'sent',
      sentAt: new Date(),
      providerMessageId: 'email_already_sent',
      nextAttemptAt: null
    }
  });
  const sender = new MockReceiptEmailSender();

  const results = await processTargetedReceiptNotification({
    notificationIntentId: notificationIntent._id.toString(),
    sender,
    options: { ignoreFeatureFlag: true }
  });

  assert.equal(results[0].action, 'target_not_eligible');
  assert.equal(sender.calls.length, 0);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).status, 'sent');
});

test('targeted processing does not process a currently leased notification', async () => {
  const { notificationIntent } = await createReceiptFixture({
    notificationOverrides: {
      status: 'processing',
      attempts: 1,
      claimToken: 'active-worker',
      lockedUntil: new Date(Date.now() + 60_000)
    }
  });
  const sender = new MockReceiptEmailSender();

  const results = await processTargetedReceiptNotification({
    notificationIntentId: notificationIntent._id.toString(),
    sender,
    options: { ignoreFeatureFlag: true }
  });

  assert.equal(results[0].action, 'target_not_eligible');
  assert.equal(sender.calls.length, 0);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).claimToken, 'active-worker');
});

test('targeted processing respects delivery feature flag', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  const results = await processTargetedReceiptNotification({
    notificationIntentId: notificationIntent._id.toString(),
    sender
  });

  assert.equal(results[0].action, 'skipped_disabled');
  assert.equal(sender.calls.length, 0);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).status, 'pending');
});

test('targeted processing cannot bypass retry timing', async () => {
  const { notificationIntent } = await createReceiptFixture({
    notificationOverrides: {
      status: 'failed',
      attempts: 1,
      nextAttemptAt: new Date(Date.now() + 60_000)
    }
  });
  const sender = new MockReceiptEmailSender();

  const results = await processTargetedReceiptNotification({
    notificationIntentId: notificationIntent._id.toString(),
    sender,
    options: { ignoreFeatureFlag: true }
  });

  assert.equal(results[0].action, 'target_not_eligible');
  assert.equal(sender.calls.length, 0);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).status, 'failed');
});

test('concurrent targeted executions preserve atomic claim ownership', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const senderA = new MockReceiptEmailSender({ delayMs: 50 });
  const senderB = new MockReceiptEmailSender();

  const [first, second] = await Promise.all([
    processTargetedReceiptNotification({
      notificationIntentId: notificationIntent._id.toString(),
      sender: senderA,
      options: { ignoreFeatureFlag: true, leaseSeconds: 120 }
    }),
    processTargetedReceiptNotification({
      notificationIntentId: notificationIntent._id.toString(),
      sender: senderB,
      options: { ignoreFeatureFlag: true, leaseSeconds: 120 }
    })
  ]);

  const actions = [first[0].action, second[0].action].sort();
  assert.deepEqual(actions, ['sent', 'target_not_eligible']);
  assert.equal(senderA.calls.length + senderB.calls.length, 1);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).status, 'sent');
});

test('normal batch behavior remains unchanged without target', async () => {
  const first = await createReceiptFixture();
  const second = await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  const results = await processReceiptNotificationBatch({
    sender,
    options: { ignoreFeatureFlag: true, batchSize: 1 }
  });

  assert.equal(results[0].action, 'sent');
  assert.equal(results[0].notificationIntentId.toString(), first.notificationIntent._id.toString());
  assert.equal((await PaymentNotificationIntent.findById(first.notificationIntent._id)).status, 'sent');
  assert.equal((await PaymentNotificationIntent.findById(second.notificationIntent._id)).status, 'pending');
});

test('targeted preflight returns safe metadata without claiming or sending', async () => {
  const { notificationIntent, receipt } = await createReceiptFixture();
  const result = await preflightReceiptNotification({
    notificationIntentId: notificationIntent._id.toString()
  });

  assert.equal(result.exists, true);
  assert.equal(result.eligible, true);
  assert.equal(result.status, 'pending');
  assert.equal(result.receiptNumber, receipt.receiptNumber);
  assert.match(result.recipientEmailMasked, /^\w\*\*\*@/);
  assert.equal(result.idempotencyWindowSafe, true);
  assert.equal((await PaymentNotificationIntent.findById(notificationIntent._id)).status, 'pending');
});

test('worker rejects targeted execution in production before connecting to MongoDB', async () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED: process.env.PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED,
    PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID: process.env.PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID,
    MONGODB_URI: process.env.MONGODB_URI
  };
  process.env.NODE_ENV = 'production';
  process.env.PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED = 'true';
  process.env.PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID = new mongoose.Types.ObjectId().toString();
  delete process.env.MONGODB_URI;

  const configPath = require.resolve('../../config/paymentFeatures');
  const workerPath = require.resolve('../../workers/payment-receipt-email.worker');
  delete require.cache[configPath];
  delete require.cache[workerPath];
  const { runOnce } = require('../../workers/payment-receipt-email.worker');

  await assert.rejects(
    () => runOnce(),
    /Targeted receipt email worker mode is disabled in production/
  );

  Object.entries(previous).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  delete require.cache[configPath];
  delete require.cache[workerPath];
});

const withWorkerEnv = async (overrides, fn) => {
  const keys = [
    'NODE_ENV',
    'PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED',
    'PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED',
    'PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME',
    'PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID',
    'PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY',
    'MONGODB_URI'
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const value = overrides[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const configPath = require.resolve('../../config/paymentFeatures');
  const workerPath = require.resolve('../../workers/payment-receipt-email.worker');
  delete require.cache[configPath];
  delete require.cache[workerPath];

  try {
    return await fn(require('../../workers/payment-receipt-email.worker'));
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    delete require.cache[configPath];
    delete require.cache[workerPath];
  }
};

test('worker refuses batch processing when expected DB name is missing', async () => {
  const { notificationIntent } = await createReceiptFixture();
  let processBatchCalls = 0;

  await assert.rejects(
    () => withWorkerEnv({
      NODE_ENV: 'development',
      PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED: 'true',
      PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED: 'true',
      PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME: undefined,
      PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID: undefined,
      PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY: undefined,
      MONGODB_URI: replSet.getUri()
    }, ({ runOnce }) => runOnce({
      services: {
        processReceiptNotificationBatch: async () => {
          processBatchCalls += 1;
          return [{ action: 'sent' }];
        }
      }
    })),
    /PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME is required/
  );

  const unchanged = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(processBatchCalls, 0);
  assert.equal(unchanged.status, 'pending');
  assert.equal(unchanged.attempts, 0);
});

test('worker refuses batch processing when connected DB name does not match expected DB name', async () => {
  const { notificationIntent } = await createReceiptFixture();
  let processBatchCalls = 0;

  await assert.rejects(
    () => withWorkerEnv({
      NODE_ENV: 'development',
      PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED: 'true',
      PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED: 'true',
      PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME: 'wrong-db',
      PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID: undefined,
      PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY: undefined,
      MONGODB_URI: replSet.getUri()
    }, ({ runOnce }) => runOnce({
      services: {
        processReceiptNotificationBatch: async () => {
          processBatchCalls += 1;
          return [{ action: 'sent' }];
        }
      }
    })),
    /unexpected database "receipt_email_delivery"/
  );

  const unchanged = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(processBatchCalls, 0);
  assert.equal(unchanged.status, 'pending');
  assert.equal(unchanged.attempts, 0);
});

test('worker permits batch processing when connected DB name matches expected DB name', async () => {
  const { notificationIntent } = await createReceiptFixture();
  const sender = new MockReceiptEmailSender();

  await withWorkerEnv({
    NODE_ENV: 'development',
    PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED: 'true',
    PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED: 'true',
    PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME: 'receipt_email_delivery',
    PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID: undefined,
    PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY: undefined,
    MONGODB_URI: replSet.getUri()
  }, ({ runOnce }) => runOnce({
    services: {
      processReceiptNotificationBatch: () => processReceiptNotificationBatch({
        sender,
        options: { ignoreFeatureFlag: true, batchSize: 1 }
      })
    }
  }));

  const updated = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(sender.calls.length, 1);
  assert.equal(updated.status, 'sent');
});

test('worker targeted read-only preflight remains compatible without expected DB name', async () => {
  const { notificationIntent } = await createReceiptFixture();
  let preflightCalls = 0;
  let batchCalls = 0;

  await withWorkerEnv({
    NODE_ENV: 'development',
    PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED: 'true',
    PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED: 'false',
    PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME: undefined,
    PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID: notificationIntent._id.toString(),
    PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY: 'true',
    MONGODB_URI: replSet.getUri()
  }, ({ runOnce }) => runOnce({
    services: {
      preflightReceiptNotification: async ({ notificationIntentId }) => {
        preflightCalls += 1;
        return preflightReceiptNotification({ notificationIntentId });
      },
      processReceiptNotificationBatch: async () => {
        batchCalls += 1;
        return [{ action: 'unexpected_batch' }];
      }
    }
  }));

  const unchanged = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(preflightCalls, 1);
  assert.equal(batchCalls, 0);
  assert.equal(unchanged.status, 'pending');
  assert.equal(unchanged.attempts, 0);
});

test('worker batch processing excludes already-sent notifications', async () => {
  const { notificationIntent } = await createReceiptFixture({
    notificationOverrides: {
      status: 'sent',
      sentAt: new Date(),
      providerMessageId: 'email_already_sent'
    }
  });
  const sender = new MockReceiptEmailSender();

  await withWorkerEnv({
    NODE_ENV: 'development',
    PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED: 'true',
    PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED: 'true',
    PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME: 'receipt_email_delivery',
    PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID: undefined,
    PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY: undefined,
    MONGODB_URI: replSet.getUri()
  }, ({ runOnce }) => runOnce({
    services: {
      processReceiptNotificationBatch: () => processReceiptNotificationBatch({
        sender,
        options: { ignoreFeatureFlag: true, batchSize: 1 }
      })
    }
  }));

  const unchanged = await PaymentNotificationIntent.findById(notificationIntent._id);
  assert.equal(sender.calls.length, 0);
  assert.equal(unchanged.status, 'sent');
  assert.equal(unchanged.providerMessageId, 'email_already_sent');
});

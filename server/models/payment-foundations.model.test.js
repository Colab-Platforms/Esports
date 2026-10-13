const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const Tournament = require('./Tournament');
const TournamentRegistration = require('./TournamentRegistration');
const TournamentRegistrationClaim = require('./TournamentRegistrationClaim');
const RegistrationIntent = require('../features/registration-intents/registration-intent.model');
const PaymentOrder = require('../features/payments/payment-order.model');
const PaymentEvent = require('../features/payments/payment-event.model');
const PaymentReceipt = require('../features/payments/payment-receipt.model');
const PaymentNotificationIntent = require('../features/payments/payment-notification-intent.model');
const Refund = require('../features/payments/refund.model');
const paymentFeatures = require('../config/paymentFeatures');

const oid = () => new mongoose.Types.ObjectId();

const indexByName = (schema, name) => schema.indexes().find(([, options]) => options?.name === name);
const hasIndexKey = (schema, key) => schema.indexes().some(([indexKey]) => (
  JSON.stringify(indexKey) === JSON.stringify(key)
));

const makeTournamentRegistration = ({ game = 'bgmi' } = {}) => new TournamentRegistration({
  tournamentId: oid(),
  userId: oid(),
  teamName: `${game} team`,
  teamLeader: {
    name: 'Leader',
    bgmiId: game === 'bgmi' ? 'bg-leader' : undefined,
    freeFireId: game === 'freefire' ? 'ff-leader' : undefined,
    phone: '9876543210'
  },
  teamMembers: [1, 2, 3].map((index) => ({
    name: `Member ${index}`,
    bgmiId: game === 'bgmi' ? `bg-${index}` : undefined,
    freeFireId: game === 'freefire' ? `ff-${index}` : undefined
  })),
  whatsappNumber: '9876543210'
});

test('payment feature flags default to disabled and do not enable checkout', () => {
  assert.equal(paymentFeatures.valorantPaidCheckoutCreateEnabled, false);
  assert.equal(paymentFeatures.valorantPaymentVerifyEnabled, false);
  assert.equal(paymentFeatures.razorpayWebhookProcessingEnabled, false);
  assert.equal(paymentFeatures.paymentReconciliationEnabled, false);
  assert.equal(paymentFeatures.paymentRefundsEnabled, false);
});

test('tournament fee metadata defaults to zero-fee INR team scope and supports normalized paid fees', () => {
  const tournament = new Tournament({
    name: 'Free Valorant Cup',
    gameType: 'valorant',
    maxParticipants: 16,
    prizePool: 0,
    createdBy: oid()
  });

  assert.equal(tournament.entryFee, 0);
  assert.equal(tournament.entryFeeAmountMinor, 0);
  assert.equal(tournament.entryFeeCurrency, 'INR');
  assert.equal(tournament.entryFeeScope, 'team');
  assert.equal(tournament.feeVersion, 1);
  assert.equal(tournament.validateSync(), undefined);

  const paidTournament = new Tournament({
    name: 'Paid Valorant Cup',
    gameType: 'valorant',
    entryFee: 10,
    entryFeeAmountMinor: 1000,
    maxParticipants: 16,
    prizePool: 0,
    createdBy: oid()
  });

  assert.equal(paidTournament.validateSync(), undefined);

  const inconsistentFeeTournament = new Tournament({
    name: 'Broken Paid Valorant Cup',
    gameType: 'valorant',
    entryFee: 10,
    entryFeeAmountMinor: 999,
    maxParticipants: 16,
    prizePool: 0,
    createdBy: oid()
  });

  assert.match(inconsistentFeeTournament.validateSync().message, /must match the rupee entry fee/);
});

test('TournamentRegistrationClaim evolves in place while preserving registration-owned defaults', () => {
  const claim = new TournamentRegistrationClaim({
    tournamentId: oid(),
    type: 'team',
    value: oid().toString(),
    registrationId: oid()
  });

  assert.equal(claim.holderType, 'registration');
  assert.equal(claim.status, 'active');
  assert.equal(claim.intentId, null);
  assert.equal(claim.validateSync(), undefined);

  const invalidIntentClaim = new TournamentRegistrationClaim({
    tournamentId: oid(),
    type: 'team',
    value: oid().toString(),
    holderType: 'intent'
  });

  assert.match(invalidIntentClaim.validateSync().message, /intentId/);
  assert.ok(indexByName(TournamentRegistrationClaim.schema, 'uniq_tournament_registration_claim'));
  assert.equal(indexByName(TournamentRegistrationClaim.schema, 'uniq_tournament_registration_claim')[1].unique, true);
  assert.equal(indexByName(TournamentRegistrationClaim.schema, 'uniq_tournament_registration_claim')[1].partialFilterExpression, undefined);
});

test('registration payment metadata is optional and does not change registration status enum', () => {
  const bgmiRegistration = makeTournamentRegistration({ game: 'bgmi' });
  const freeFireRegistration = makeTournamentRegistration({ game: 'freefire' });

  assert.equal(bgmiRegistration.payment.status, 'not_required');
  assert.equal(bgmiRegistration.payment.amountMinor, 0);
  assert.equal(bgmiRegistration.validateSync(), undefined);
  assert.equal(freeFireRegistration.validateSync(), undefined);
  assert.deepEqual(TournamentRegistration.schema.path('status').enumValues, [
    'pending',
    'images_uploaded',
    'verified',
    'rejected'
  ]);
});

test('new payment foundation models expose planned partial unique indexes', () => {
  assert.ok(indexByName(RegistrationIntent.schema, 'uniq_live_intent_per_team_captain_tournament'));
  assert.deepEqual(
    indexByName(RegistrationIntent.schema, 'uniq_live_intent_per_team_captain_tournament')[1].partialFilterExpression,
    { blocksNewIntent: true }
  );

  assert.ok(indexByName(PaymentOrder.schema, 'uniq_gateway_order_id'));
  assert.deepEqual(
    indexByName(PaymentOrder.schema, 'uniq_live_payment_order_per_intent')[1].partialFilterExpression,
    { isLiveOrder: true }
  );

  assert.ok(indexByName(Refund.schema, 'uniq_live_refund_reason_per_payment'));
  assert.deepEqual(
    indexByName(Refund.schema, 'uniq_live_refund_reason_per_payment')[1].partialFilterExpression,
    { isLiveRefund: true }
  );

  assert.ok(hasIndexKey(PaymentEvent.schema, { gateway: 1, gatewayEventId: 1 }));
  assert.ok(indexByName(PaymentReceipt.schema, 'uniq_receipt_payment_order'));
  assert.ok(indexByName(PaymentReceipt.schema, 'uniq_payment_receipt_number'));
  assert.ok(indexByName(PaymentNotificationIntent.schema, 'uniq_payment_notification_intent'));
  assert.ok(hasIndexKey(Tournament.schema, { gameType: 1, status: 1, entryFeeAmountMinor: 1 }));
  assert.ok(indexByName(TournamentRegistration.schema, 'uniq_registration_payment_intent'));
});

test('payment foundation models validate integer paise and INR team scope', () => {
  const intent = new RegistrationIntent({
    gameType: 'valorant',
    tournamentId: oid(),
    captainUserId: oid(),
    teamId: oid(),
    feeSnapshot: {
      amountMinor: 50000,
      currency: 'INR',
      feeScope: 'team',
      tournamentFeeVersion: 1
    },
    reservation: {
      expiresAt: new Date(Date.now() + 60_000)
    },
    idempotencyKey: 'intent-key',
    requestHash: 'request-hash'
  });
  assert.equal(intent.validateSync(), undefined);

  const invalidOrder = new PaymentOrder({
    intentId: oid(),
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: oid(),
    captainUserId: oid(),
    gateway: 'razorpay',
    amountMinor: 10.5,
    currency: 'INR',
    providerReceipt: 'receipt-1',
    idempotencyKey: 'order-key'
  });
  assert.match(invalidOrder.validateSync().message, /integer number of paise/);
});

test('payment receipt and notification intent models validate minimal receipt persistence fields', () => {
  const paymentOrderId = oid();
  const userId = oid();
  const receipt = new PaymentReceipt({
    receiptNumber: 'COLAB-VAL-ABC123',
    paymentOrderId,
    registrationIntentId: oid(),
    tournamentRegistrationId: oid(),
    tournamentId: oid(),
    captainUserId: userId,
    teamName: 'Valorant Team',
    amountMinor: 55000,
    currency: 'INR',
    gateway: 'razorpay',
    gatewayPaymentId: 'pay_test_123',
    capturedAt: new Date()
  });

  assert.equal(receipt.validateSync(), undefined);

  const notificationIntent = new PaymentNotificationIntent({
    type: 'payment_receipt_email',
    paymentOrderId,
    receiptId: receipt._id,
    recipientUserId: userId,
    recipientEmail: 'captain@example.com'
  });

  assert.equal(notificationIntent.status, 'pending');
  assert.equal(notificationIntent.attempts, 0);
  assert.equal(notificationIntent.validateSync(), undefined);

  const invalidReceipt = new PaymentReceipt({
    ...receipt.toObject(),
    _id: oid(),
    amountMinor: 550.5
  });
  assert.match(invalidReceipt.validateSync().message, /integer number of paise/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
const Team = require('../teams/team.model');
const TournamentRegistration = require('../../models/TournamentRegistration');
const TournamentRegistrationClaim = require('../../models/TournamentRegistrationClaim');
const RegistrationIntent = require('./registration-intent.model');
const PaymentOrder = require('../payments/payment-order.model');
const PaymentEvent = require('../payments/payment-event.model');
const registrationIntentRoutes = require('./registration-intent.routes');
const {
  cancelRegistrationIntent,
  createRegistrationIntent,
  expireDueUnpaidIntents,
  expireIntentIfSafelyUnpaid
} = require('./registration-intent.service');
const {
  registerValorantTeam
} = require('../../services/valorant-registration.service');

let replSet;
let userSeq = 0;
let teamSeq = 0;
let tournamentSeq = 0;

const futureDate = (minutes = 60) => new Date(Date.now() + minutes * 60 * 1000);
const pastDate = () => new Date(Date.now() - 60 * 1000);

const models = {
  Tournament,
  Team,
  User,
  TournamentRegistration,
  RegistrationIntent,
  PaymentOrder,
  PaymentEvent,
  ClaimModel: TournamentRegistrationClaim
};

const createUser = async ({ riotId, phone } = {}) => {
  userSeq += 1;
  return User.create({
    username: `intent_user_${userSeq}`,
    fullName: `Intent User ${userSeq}`,
    email: `intent_user_${userSeq}@example.com`,
    phone,
    authProvider: 'google',
    gameIds: {
      valorant: riotId === null ? '' : (riotId || `Intent${userSeq}#TAG${userSeq}`)
    }
  });
};

const createUsers = async (riotIds = []) => Promise.all(
  Array.from({ length: 6 }, (_, index) => createUser({
    riotId: riotIds[index],
    phone: index === 0 ? `98766${String(userSeq + index).padStart(5, '0')}` : undefined
  }))
);

const createAdmin = async () => {
  userSeq += 1;
  return User.create({
    username: `intent_admin_${userSeq}`,
    fullName: `Intent Admin ${userSeq}`,
    email: `intent_admin_${userSeq}@example.com`,
    phone: `97655${String(userSeq).padStart(5, '0')}`,
    authProvider: 'google',
    role: 'admin'
  });
};

const createValorantTournament = async ({ paid = true, ...overrides } = {}) => {
  const creator = overrides.createdBy || await createAdmin();
  tournamentSeq += 1;
  const tournament = await Tournament.create({
    name: `Intent Valorant Cup ${tournamentSeq}`,
    description: 'Intent integration test tournament',
    gameType: 'valorant',
    mode: 'team',
    prizePool: 1000,
    maxParticipants: 16,
    currentParticipants: 0,
    startDate: futureDate(120),
    endDate: futureDate(180),
    registrationDeadline: futureDate(60),
    status: 'registration_open',
    rules: 'Intent integration test rules',
    format: 'elimination',
    createdBy: creator._id,
    ...overrides
  });

  if (paid) {
    await Tournament.collection.updateOne(
      { _id: tournament._id },
      {
        $set: {
          entryFeeAmountMinor: 50000,
          entryFeeCurrency: 'INR',
          entryFeeScope: 'team',
          feeVersion: 1
        }
      }
    );
  }

  return Tournament.findById(tournament._id);
};

const createValorantTeam = async ({ users, name, captainIndex = 0, invalidSubstitute = false }) => {
  teamSeq += 1;
  const captain = users[captainIndex];
  const members = users.map((user, index) => ({
    userId: user._id,
    role: index === captainIndex ? 'captain' : 'member',
    isSubstitute: invalidSubstitute ? false : index === 5
  }));

  return Team.create({
    name: name || `IntentTeam${teamSeq}`,
    tag: `I${teamSeq}`.slice(0, 5),
    game: 'valorant',
    captain: captain._id,
    members,
    maxMembers: 6,
    privacy: 'private',
    isActive: true
  });
};

const createIntent = ({ tournament, team, captain, idempotencyKey = `idem-${Date.now()}-${Math.random()}`, ttlMinutes = 15 }) => (
  createRegistrationIntent({
    requesterUserId: captain._id,
    gameType: 'valorant',
    tournamentId: tournament._id,
    teamId: team._id,
    idempotencyKey,
    models,
    options: {
      ignoreCheckoutFeatureFlag: true,
      ttlMinutes
    }
  })
);

test.before(async () => {
  mongoose.set('autoIndex', false);
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' }
  });
  await mongoose.connect(replSet.getUri(), {
    dbName: 'registration_intent_checkpoint_2',
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
    PaymentEvent.createCollection()
  ]);
  await TournamentRegistration.collection.createIndex(
    { tournamentId: 1, userId: 1 },
    { name: 'tournamentId_1_userId_1' }
  );
  await TournamentRegistrationClaim.collection.createIndex(
    { tournamentId: 1, type: 1, value: 1 },
    { unique: true, name: 'uniq_tournament_registration_claim' }
  );
  await RegistrationIntent.syncIndexes();
  await PaymentOrder.syncIndexes();
  await PaymentEvent.syncIndexes();
});

test.beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({}))
  );
});

test.after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

test('paid intent creation is feature-flag disabled by default', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  await assert.rejects(
    () => createRegistrationIntent({
      requesterUserId: users[0]._id,
      gameType: 'valorant',
      tournamentId: tournament._id,
      teamId: team._id,
      idempotencyKey: 'disabled-intent-key',
      models
    }),
    (error) => error.code === 'PAID_CHECKOUT_DISABLED'
  );
});

test('paid Valorant direct registration is blocked before registration creation', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  await assert.rejects(
    () => registerValorantTeam({
      tournamentId: tournament._id,
      requesterUserId: users[0]._id,
      teamId: team._id,
      models
    }),
    (error) => error.code === 'PAYMENT_REQUIRED'
  );

  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 0);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ tournamentId: tournament._id }), 0);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);
});

test('free Valorant direct registration remains unchanged', async () => {
  const tournament = await createValorantTournament({ paid: false });
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  const result = await registerValorantTeam({
    tournamentId: tournament._id,
    requesterUserId: users[0]._id,
    teamId: team._id,
    models
  });

  assert.equal(result.registration.status, 'pending');
  assert.equal(await TournamentRegistrationClaim.countDocuments({ registrationId: result.registration._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('valid paid intent reserves capacity and intent-owned claims without creating registration', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'valid-intent-key' });

  assert.equal(intent.status, 'reserved');
  assert.equal(intent.feeSnapshot.amountMinor, 50000);
  assert.equal(await TournamentRegistration.countDocuments({ tournamentId: tournament._id }), 0);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id, holderType: 'intent' }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('captain authorization, invalid roster, and missing Riot ID are rejected', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  await assert.rejects(
    () => createIntent({ tournament, team, captain: users[1], idempotencyKey: 'not-captain-key' }),
    (error) => error.code === 'NOT_TEAM_CAPTAIN'
  );

  const invalidUsers = await createUsers();
  const invalidTeam = await createValorantTeam({
    users: invalidUsers,
    name: 'Invalid Roster',
    invalidSubstitute: true
  });
  await assert.rejects(
    () => createIntent({ tournament, team: invalidTeam, captain: invalidUsers[0], idempotencyKey: 'invalid-roster-key' }),
    (error) => error.code === 'INVALID_VALORANT_ROSTER' || error.code === 'SUBSTITUTE_REQUIRED'
  );

  const missingRiotUsers = await createUsers([null, null, null, null, null, null]);
  missingRiotUsers[2].gameIds.valorant = '';
  await missingRiotUsers[2].save();
  const missingRiotTeam = await createValorantTeam({ users: missingRiotUsers, name: 'Missing Riot' });
  await assert.rejects(
    () => createIntent({ tournament, team: missingRiotTeam, captain: missingRiotUsers[0], idempotencyKey: 'missing-riot-key' }),
    (error) => error.code === 'MISSING_RIOT_ID'
  );
});

test('idempotent duplicate returns existing intent and payload mismatch is rejected', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const otherUsers = await createUsers();
  const team = await createValorantTeam({ users });
  const otherTeam = await createValorantTeam({ users: [users[0], ...otherUsers.slice(1)], name: 'Other Idem Team' });

  const first = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'same-idem-key' });
  const second = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'same-idem-key' });

  assert.equal(second.reused, true);
  assert.equal(second.intent._id.toString(), first.intent._id.toString());
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);

  await assert.rejects(
    () => createIntent({ tournament, team: otherTeam, captain: users[0], idempotencyKey: 'same-idem-key' }),
    (error) => error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH'
  );
});

test('duplicate team, user, and Riot claims block competing paid intents', async () => {
  const tournament = await createValorantTournament();
  const usersA = await createUsers(['SharedRiot#1111']);
  const teamA = await createValorantTeam({ users: usersA, name: 'Claim Alpha' });
  await createIntent({ tournament, team: teamA, captain: usersA[0], idempotencyKey: 'claim-alpha-key' });

  await assert.rejects(
    () => createIntent({ tournament, team: teamA, captain: usersA[0], idempotencyKey: 'claim-same-team-key' }),
    (error) => error.code === 'REGISTRATION_CLAIM_CONFLICT' || error.code === 11000
  );

  const bravoCaptain = await createUser({ riotId: 'BravoCap#2222', phone: '9876609999' });
  const bravoOnly = await Promise.all(Array.from({ length: 4 }, (_, index) => createUser({ riotId: `BravoOnly${index}#2222` })));
  const teamB = await createValorantTeam({
    users: [bravoCaptain, usersA[1], ...bravoOnly],
    name: 'Claim Bravo'
  });
  await assert.rejects(
    () => createIntent({ tournament, team: teamB, captain: bravoCaptain, idempotencyKey: 'claim-same-user-key' }),
    (error) => error.code === 'REGISTRATION_CLAIM_CONFLICT'
  );

  const usersC = await createUsers(['sharedriot#1111']);
  const teamC = await createValorantTeam({ users: usersC, name: 'Claim Charlie' });
  await assert.rejects(
    () => createIntent({ tournament, team: teamC, captain: usersC[0], idempotencyKey: 'claim-same-riot-key' }),
    (error) => error.code === 'REGISTRATION_CLAIM_CONFLICT'
  );
});

test('concurrent paid intents for final slot allow exactly one reservation', async () => {
  const tournament = await createValorantTournament({ maxParticipants: 2, currentParticipants: 1 });
  const usersA = await createUsers();
  const usersB = await createUsers();
  const teamA = await createValorantTeam({ users: usersA, name: 'Final Slot A' });
  const teamB = await createValorantTeam({ users: usersB, name: 'Final Slot B' });

  const results = await Promise.allSettled([
    createIntent({ tournament, team: teamA, captain: usersA[0], idempotencyKey: 'final-slot-a' }),
    createIntent({ tournament, team: teamB, captain: usersB[0], idempotencyKey: 'final-slot-b' })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(await RegistrationIntent.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 2);
});

test('concurrent paid intents for same team allow one live intent', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });

  const results = await Promise.allSettled([
    createIntent({ tournament, team, captain: users[0], idempotencyKey: 'same-team-a' }),
    createIntent({ tournament, team, captain: users[0], idempotencyKey: 'same-team-b' })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(await RegistrationIntent.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ tournamentId: tournament._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('intent cancellation is idempotent and cannot double release capacity', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'cancel-key' });

  await cancelRegistrationIntent({ intentId: intent._id, requesterUserId: users[0]._id, models });
  await cancelRegistrationIntent({ intentId: intent._id, requesterUserId: users[0]._id, models });

  const cancelled = await RegistrationIntent.findById(intent._id);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.reservation.capacityReleased, true);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 0);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);
});

test('expiry versus cancellation race releases capacity at most once', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'race-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': pastDate() } });

  const results = await Promise.allSettled([
    expireDueUnpaidIntents({ now: new Date(), models }),
    cancelRegistrationIntent({ intentId: intent._id, requesterUserId: users[0]._id, models })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 0);
  const finalIntent = await RegistrationIntent.findById(intent._id);
  assert.equal(finalIntent.reservation.capacityReleased, true);
});

test('expiry retains capacity when a provider order exists and reconciliation is required', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'reconcile-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': pastDate() } });
  await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-reconcile-key',
    idempotencyKey: 'payment-order-key'
  });

  const result = await expireDueUnpaidIntents({ now: new Date(), models });
  assert.equal(result[0].expired, false);
  assert.equal(result[0].reason, 'payment_order_requires_reconciliation');
  assert.equal((await RegistrationIntent.findById(intent._id)).status, 'reserved');
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 13);
});

test('safe recovery expires stale reserved intent with no provider order and allows a fresh intent', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'stale-no-order-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': pastDate() } });

  const recovery = await expireIntentIfSafelyUnpaid({
    intentId: intent._id,
    requesterUserId: users[0]._id,
    models
  });

  assert.equal(recovery.expired, true);
  assert.equal(recovery.reason, 'expired_unpaid');
  assert.equal((await RegistrationIntent.findById(intent._id)).status, 'expired_unpaid');
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 0);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);

  const fresh = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'fresh-after-expiry-key' });
  assert.equal(fresh.intent.status, 'reserved');
  assert.notEqual(fresh.intent._id.toString(), intent._id.toString());
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: fresh.intent._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('safe recovery does not release expired intent with unknown provider order', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'unknown-order-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': pastDate() } });
  await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-unknown-order-key',
    idempotencyKey: 'unknown-payment-order-key',
    status: 'provider_create_unknown',
    isLiveOrder: true
  });

  const recovery = await expireIntentIfSafelyUnpaid({
    intentId: intent._id,
    requesterUserId: users[0]._id,
    models
  });

  assert.equal(recovery.expired, false);
  assert.equal(recovery.reason, 'payment_order_requires_reconciliation');
  assert.equal(recovery.paymentOrder.status, 'provider_create_unknown');
  assert.equal((await RegistrationIntent.findById(intent._id)).status, 'reserved');
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('safe recovery expires stale reserved intent with only terminal failed pre-checkout orders', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'failed-orders-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': pastDate() } });
  const failedOrder = await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-failed-orders-key',
    providerCreateAttemptId: 'attempt_failed_orders_key',
    idempotencyKey: 'failed-payment-order-key',
    status: 'failed',
    fulfillmentStatus: 'not_started',
    isLiveOrder: false,
    lastError: 'Razorpay rejected order creation before checkout'
  });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { paymentOrderId: failedOrder._id } });

  const recovery = await expireIntentIfSafelyUnpaid({
    intentId: intent._id,
    requesterUserId: users[0]._id,
    models
  });

  assert.equal(recovery.expired, true);
  assert.equal(recovery.reason, 'expired_unpaid');
  assert.equal((await RegistrationIntent.findById(intent._id)).status, 'expired_unpaid');
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 0);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);
});

test('safe recovery blocks terminal failed order when provider event exists', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'failed-event-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': pastDate() } });
  const failedOrder = await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-failed-event-key',
    providerCreateAttemptId: 'attempt_failed_event_key',
    idempotencyKey: 'failed-event-payment-order-key',
    status: 'failed',
    fulfillmentStatus: 'not_started',
    isLiveOrder: false
  });
  await PaymentEvent.create({
    gateway: 'razorpay',
    gatewayEventId: 'evt_failed_event_key',
    eventType: 'payment.captured',
    gatewayPaymentId: 'pay_failed_event_key',
    paymentOrderId: failedOrder._id,
    intentId: intent._id,
    signatureVerified: true,
    payloadHash: 'hash_failed_event_key',
    processingStatus: 'received',
    sanitizedPayload: {
      event: 'payment.captured',
      payment: { status: 'captured' }
    }
  });

  const recovery = await expireIntentIfSafelyUnpaid({
    intentId: intent._id,
    requesterUserId: users[0]._id,
    models
  });

  assert.equal(recovery.expired, false);
  assert.equal(recovery.reason, 'captured_payment_event_requires_reconciliation');
  assert.equal((await RegistrationIntent.findById(intent._id)).status, 'reserved');
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('safe recovery preserves expired intent with captured payment for fulfillment reconciliation', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'captured-order-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, {
    $set: {
      status: 'payment_captured',
      'reservation.expiresAt': pastDate()
    }
  });
  await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    gatewayOrderId: 'order_captured_recovery',
    gatewayPaymentId: 'pay_captured_recovery',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-captured-order-key',
    idempotencyKey: 'captured-payment-order-key',
    status: 'captured',
    fulfillmentStatus: 'captured_unfulfilled',
    isLiveOrder: true
  });

  const recovery = await expireIntentIfSafelyUnpaid({
    intentId: intent._id,
    requesterUserId: users[0]._id,
    models
  });

  assert.equal(recovery.expired, false);
  assert.equal(recovery.reason, 'payment_order_requires_reconciliation');
  assert.equal((await RegistrationIntent.findById(intent._id)).status, 'payment_captured');
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 13);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('concurrent stale intent recovery releases capacity once before new intent creation', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'concurrent-stale-key' });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { 'reservation.expiresAt': pastDate() } });

  const results = await Promise.allSettled([
    expireIntentIfSafelyUnpaid({ intentId: intent._id, requesterUserId: users[0]._id, models }),
    expireIntentIfSafelyUnpaid({ intentId: intent._id, requesterUserId: users[0]._id, models })
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 2);
  assert.equal(results.filter((result) => result.value.expired).length, 1);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ intentId: intent._id }), 0);

  const fresh = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'after-concurrent-stale-key' });
  assert.equal(fresh.intent.status, 'reserved');
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 1);
});

test('status payload prefers intent-linked order over historical failed orders', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'status-linked-order-key' });
  const historical = await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-status-history',
    providerCreateAttemptId: 'attempt_status_history',
    idempotencyKey: 'status-history-order-key',
    status: 'failed',
    fulfillmentStatus: 'not_started',
    isLiveOrder: false
  });
  const linked = await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    gatewayOrderId: 'order_status_linked',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-status-linked',
    providerCreateAttemptId: 'attempt_status_linked',
    idempotencyKey: 'status-linked-order-key',
    status: 'created',
    fulfillmentStatus: 'not_started',
    isLiveOrder: true
  });
  await RegistrationIntent.updateOne({ _id: intent._id }, { $set: { paymentOrderId: linked._id } });

  const freshIntent = await RegistrationIntent.findById(intent._id);
  const payload = await registrationIntentRoutes._buildIntentStatusPayload(freshIntent);

  assert.equal(payload.paymentOrder.paymentOrderId.toString(), linked._id.toString());
  assert.notEqual(payload.paymentOrder.paymentOrderId.toString(), historical._id.toString());
  assert.equal(payload.paymentOrderConsistency.selectedBy, 'intent.paymentOrderId');
  assert.equal(payload.paymentOrderConsistency.orderCount, 2);
});

test('status payload reports missing linked order instead of selecting arbitrary historical order', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  const { intent } = await createIntent({ tournament, team, captain: users[0], idempotencyKey: 'status-missing-linked-key' });
  await PaymentOrder.create({
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: tournament._id,
    captainUserId: users[0]._id,
    gateway: 'razorpay',
    amountMinor: 50000,
    currency: 'INR',
    providerReceipt: 'receipt-status-missing-history',
    providerCreateAttemptId: 'attempt_status_missing_history',
    idempotencyKey: 'status-missing-history-order-key',
    status: 'failed',
    fulfillmentStatus: 'not_started',
    isLiveOrder: false
  });
  await RegistrationIntent.updateOne(
    { _id: intent._id },
    { $set: { paymentOrderId: new mongoose.Types.ObjectId() } }
  );

  const freshIntent = await RegistrationIntent.findById(intent._id);
  const payload = await registrationIntentRoutes._buildIntentStatusPayload(freshIntent);

  assert.equal(payload.paymentOrder, null);
  assert.equal(payload.paymentOrderConsistency.linkedOrderMissing, true);
  assert.equal(payload.paymentOrderConsistency.orderCount, 1);
});

test('transaction rollback after claim conflict leaves no intent or capacity increment', async () => {
  const tournament = await createValorantTournament();
  const users = await createUsers();
  const team = await createValorantTeam({ users });
  await TournamentRegistrationClaim.create({
    tournamentId: tournament._id,
    type: 'team',
    value: team._id.toString(),
    registrationId: new mongoose.Types.ObjectId()
  });

  await assert.rejects(
    () => createIntent({ tournament, team, captain: users[0], idempotencyKey: 'rollback-key' }),
    (error) => error.code === 'REGISTRATION_CLAIM_CONFLICT'
  );

  assert.equal(await RegistrationIntent.countDocuments({ tournamentId: tournament._id }), 0);
  assert.equal(await TournamentRegistrationClaim.countDocuments({ tournamentId: tournament._id }), 1);
  assert.equal((await Tournament.findById(tournament._id)).currentParticipants, 0);
});

test('old claim index remains authoritative and compatible', async () => {
  const indexes = await TournamentRegistrationClaim.collection.indexes();
  const claimIndex = indexes.find((index) => index.name === 'uniq_tournament_registration_claim');
  assert.ok(claimIndex);
  assert.equal(claimIndex.unique, true);
  assert.equal(claimIndex.partialFilterExpression, undefined);
  assert.deepEqual(claimIndex.key, { tournamentId: 1, type: 1, value: 1 });
});

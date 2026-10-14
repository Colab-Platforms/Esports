const crypto = require('crypto');
const mongoose = require('mongoose');

const RegistrationIntent = require('./registration-intent.model');
const PaymentOrder = require('../payments/payment-order.model');
const PaymentEvent = require('../payments/payment-event.model');
const TournamentRegistrationClaim = require('../../models/TournamentRegistrationClaim');
const paymentFeatures = require('../../config/paymentFeatures');
const {
  CAPACITY_HOLDING_INTENT_STATUSES
} = require('./registration-intent.constants');
const {
  buildRegistrationClaims,
  createClaims,
  createRegistrationError,
  prepareValorantRegistration,
  reserveTournamentCapacity
} = require('../../services/valorant-registration.service');
const { getTournamentFeeAmountMinor } = require('../../services/valorant-payment-guard.service');

const DEFAULT_MODELS = {
  RegistrationIntent,
  PaymentOrder,
  PaymentEvent,
  ClaimModel: TournamentRegistrationClaim
};

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const hashRequestPayload = ({ gameType, tournamentId, teamId }) => crypto
  .createHash('sha256')
  .update(stableStringify({
    gameType,
    tournamentId: tournamentId?.toString(),
    teamId: teamId?.toString()
  }))
  .digest('hex');

const getTtlMinutes = (options = {}) => {
  const value = options.ttlMinutes ?? paymentFeatures.registrationIntentTtlMinutes;
  return Number.isInteger(value) && value > 0 ? value : null;
};

const assertCheckoutCreationEnabled = (options = {}) => {
  if (options.ignoreCheckoutFeatureFlag === true) return;
  if (!paymentFeatures.valorantPaidCheckoutCreateEnabled) {
    throw createRegistrationError(
      'PAID_CHECKOUT_DISABLED',
      'Paid Valorant checkout creation is disabled',
      503
    );
  }
};

const normalizeIntentPayload = ({ gameType, tournamentId, teamId, idempotencyKey }) => {
  if (gameType !== 'valorant') {
    throw createRegistrationError('INVALID_GAME_TYPE', 'Registration intents are currently supported for Valorant only');
  }
  if (!mongoose.Types.ObjectId.isValid(tournamentId)) {
    throw createRegistrationError('INVALID_TOURNAMENT_ID', 'Invalid tournament ID');
  }
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw createRegistrationError('INVALID_TEAM_ID', 'Invalid team ID');
  }
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
    throw createRegistrationError('INVALID_IDEMPOTENCY_KEY', 'A stable idempotency key is required');
  }

  return {
    gameType,
    tournamentId: tournamentId.toString(),
    teamId: teamId.toString(),
    idempotencyKey: idempotencyKey.trim()
  };
};

const assertSameIdempotentRequest = (intent, requestHash) => {
  if (intent.requestHash !== requestHash) {
    throw createRegistrationError(
      'IDEMPOTENCY_PAYLOAD_MISMATCH',
      'This idempotency key was already used with a different registration intent request',
      409
    );
  }
};

const isDuplicateKeyError = (error) => error?.code === 11000;

const toIntentResponse = (intent, { reused = false } = {}) => ({
  intent,
  reused,
  requiresPayment: true
});

const createRegistrationIntent = async ({
  requesterUserId,
  gameType,
  tournamentId,
  teamId,
  idempotencyKey,
  createdByIp = '',
  userAgent = '',
  models,
  options = {}
}) => {
  assertCheckoutCreationEnabled(options);

  const ttlMinutes = getTtlMinutes(options);
  if (!ttlMinutes) {
    throw createRegistrationError(
      'RESERVATION_TTL_NOT_CONFIGURED',
      'Registration intent TTL is not configured',
      503
    );
  }

  const normalized = normalizeIntentPayload({ gameType, tournamentId, teamId, idempotencyKey });
  const requestHash = hashRequestPayload(normalized);
  const {
    Tournament,
    Team,
    User,
    TournamentRegistration,
    RegistrationIntent: IntentModel = DEFAULT_MODELS.RegistrationIntent,
    ClaimModel = DEFAULT_MODELS.ClaimModel
  } = models;

  const existingIntent = await IntentModel.findOne({
    captainUserId: requesterUserId,
    idempotencyKey: normalized.idempotencyKey
  });
  if (existingIntent) {
    assertSameIdempotentRequest(existingIntent, requestHash);
    return toIntentResponse(existingIntent, { reused: true });
  }

  const session = await mongoose.startSession();
  try {
    let createdIntent;
    await session.withTransaction(async () => {
      const duplicateIntent = await IntentModel.findOne({
        captainUserId: requesterUserId,
        idempotencyKey: normalized.idempotencyKey
      }).session(session);
      if (duplicateIntent) {
        assertSameIdempotentRequest(duplicateIntent, requestHash);
        createdIntent = duplicateIntent;
        return;
      }

      const prepared = await prepareValorantRegistration({
        tournamentId: normalized.tournamentId,
        requesterUserId,
        teamId: normalized.teamId,
        models: { Tournament, Team, User, TournamentRegistration },
        session,
        enforceDirectRegistrationGuard: false
      });

      const amountMinor = getTournamentFeeAmountMinor(prepared.tournament);
      if (amountMinor <= 0) {
        throw createRegistrationError(
          'PAYMENT_NOT_REQUIRED',
          'Free Valorant tournaments should use the existing direct registration flow'
        );
      }

      await reserveTournamentCapacity({
        Tournament,
        tournamentId: prepared.tournament._id,
        session
      });

      const intentId = new mongoose.Types.ObjectId();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
      const intent = new IntentModel({
        _id: intentId,
        gameType: 'valorant',
        tournamentId: prepared.tournament._id,
        captainUserId: requesterUserId,
        teamId: prepared.team._id,
        status: 'reserved',
        blocksNewIntent: true,
        rosterSnapshot: {
          ...prepared.snapshot,
          rosterUserIds: prepared.rosterUserIds,
          normalizedRiotIds: prepared.snapshot.roster.map((entry) => entry.normalizedRiotId)
        },
        feeSnapshot: {
          amountMinor,
          currency: prepared.tournament.entryFeeCurrency || 'INR',
          feeScope: prepared.tournament.entryFeeScope || 'team',
          tournamentFeeVersion: prepared.tournament.feeVersion || 1
        },
        reservation: {
          capacityReserved: true,
          capacityReleased: false,
          reservedAt: now,
          expiresAt
        },
        idempotencyKey: normalized.idempotencyKey,
        requestHash,
        createdByIp,
        userAgent
      });

      const claims = buildRegistrationClaims({
        tournamentId: prepared.tournament._id,
        teamId: prepared.team._id,
        intentId,
        holderType: 'intent',
        roster: prepared.snapshot.roster
      });
      await createClaims({ ClaimModel, claims, session });
      await intent.save({ session });
      createdIntent = intent;
    });

    return toIntentResponse(createdIntent, { reused: false });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await IntentModel.findOne({
        captainUserId: requesterUserId,
        idempotencyKey: normalized.idempotencyKey
      });
      if (existing) {
        assertSameIdempotentRequest(existing, requestHash);
        return toIntentResponse(existing, { reused: true });
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }
};

const releaseReservedIntent = async ({
  intentId,
  requesterUserId = null,
  releaseReason,
  terminalStatus,
  allowedStatuses = ['reserved'],
  models,
  session
}) => {
  const {
    Tournament,
    RegistrationIntent: IntentModel = DEFAULT_MODELS.RegistrationIntent,
    ClaimModel = DEFAULT_MODELS.ClaimModel
  } = models;

  const criteria = {
    _id: intentId,
    status: { $in: allowedStatuses },
    'reservation.capacityReserved': true,
    'reservation.capacityReleased': false
  };
  if (requesterUserId) criteria.captainUserId = requesterUserId;

  const intent = await IntentModel.findOneAndUpdate(
    criteria,
    {
      $set: {
        status: terminalStatus,
        blocksNewIntent: false,
        'reservation.capacityReleased': true,
        'reservation.releasedAt': new Date(),
        'reservation.releaseReason': releaseReason
      }
    },
    { new: true, session }
  );

  if (!intent) return null;

  // Until the production claim index is migrated to partial-active uniqueness,
  // released intent claims must be deleted so the old unique index allows retry.
  await ClaimModel.deleteMany({ intentId: intent._id }).session(session);
  await Tournament.updateOne(
    { _id: intent.tournamentId, currentParticipants: { $gt: 0 } },
    { $inc: { currentParticipants: -1 } },
    { session }
  );

  return intent;
};

const cancelRegistrationIntent = async ({ intentId, requesterUserId, models }) => {
  const {
    RegistrationIntent: IntentModel = DEFAULT_MODELS.RegistrationIntent
  } = models;

  const session = await mongoose.startSession();
  try {
    let released;
    await session.withTransaction(async () => {
      released = await releaseReservedIntent({
        intentId,
        requesterUserId,
        releaseReason: 'captain_cancelled',
        terminalStatus: 'cancelled',
        models,
        session
      });

      if (!released) {
        const intent = await IntentModel.findOne({ _id: intentId, captainUserId: requesterUserId }).session(session);
        if (!intent) {
          throw createRegistrationError('INTENT_NOT_FOUND', 'Registration intent not found', 404);
        }
        if (intent.reservation?.capacityReleased && intent.status === 'cancelled') {
          released = intent;
          return;
        }
        throw createRegistrationError(
          'INTENT_CANCELLATION_NOT_ALLOWED',
          'This registration intent cannot be cancelled without payment reconciliation',
          409
        );
      }
    });
    return released;
  } finally {
    await session.endSession();
  }
};

const expireDueUnpaidIntents = async ({ now = new Date(), limit = 50, models }) => {
  const {
    RegistrationIntent: IntentModel = DEFAULT_MODELS.RegistrationIntent,
    PaymentOrder: PaymentOrderModel = DEFAULT_MODELS.PaymentOrder,
    PaymentEvent: PaymentEventModel = DEFAULT_MODELS.PaymentEvent
  } = models;

  const candidates = await IntentModel.find({
    status: { $in: ['reserved', 'payment_order_created'] },
    'reservation.capacityReserved': true,
    'reservation.capacityReleased': false,
    'reservation.expiresAt': { $lte: now }
  }).sort({ 'reservation.expiresAt': 1 }).limit(limit);

  const results = [];
  for (const candidate of candidates) {
    const safety = await classifyIntentExpirySafety({
      intent: candidate,
      PaymentOrderModel,
      PaymentEventModel
    });
    if (!safety.canExpire) {
      results.push({ intentId: candidate._id, expired: false, reason: safety.reason });
      continue;
    }
    if (candidate.status !== 'reserved') {
      results.push({ intentId: candidate._id, expired: false, reason: 'intent_state_requires_reconciliation' });
      continue;
    }

    const session = await mongoose.startSession();
    try {
      let released;
      await session.withTransaction(async () => {
        released = await releaseReservedIntent({
          intentId: candidate._id,
          releaseReason: 'expired_unpaid',
          terminalStatus: 'expired_unpaid',
          models,
          session
        });
      });
      results.push({ intentId: candidate._id, expired: Boolean(released) });
    } finally {
      await session.endSession();
    }
  }

  return results;
};

const isTerminalFailedPreCheckoutOrder = (order) => (
  ['failed', 'cancelled'].includes(order.status) &&
  order.isLiveOrder === false &&
  !order.gatewayOrderId &&
  !order.gatewayPaymentId &&
  !['fulfilling', 'fulfilled', 'captured_unfulfilled'].includes(order.fulfillmentStatus)
);

const hasCapturedPaymentEvidence = (event) => {
  const eventType = String(event.eventType || '').toLowerCase();
  const paymentStatus = String(
    event.sanitizedPayload?.payment?.status ||
    event.sanitizedPayload?.entity?.status ||
    ''
  ).toLowerCase();

  return (
    eventType.includes('captured') ||
    paymentStatus === 'captured' ||
    Boolean(event.gatewayPaymentId)
  );
};

const classifyIntentExpirySafety = async ({
  intent,
  PaymentOrderModel = PaymentOrder,
  PaymentEventModel = PaymentEvent
}) => {
  const paymentOrders = await PaymentOrderModel.find({ intentId: intent._id }).sort({ createdAt: 1 });
  const paymentOrderIds = paymentOrders.map((order) => order._id);
  const paymentEvents = await PaymentEventModel.find({
    $or: [
      { intentId: intent._id },
      { paymentOrderId: { $in: paymentOrderIds } }
    ]
  }).sort({ createdAt: 1 });

  if (paymentEvents.some(hasCapturedPaymentEvidence)) {
    return {
      canExpire: false,
      reason: 'captured_payment_event_requires_reconciliation',
      paymentOrders,
      paymentEvents
    };
  }

  if (paymentEvents.length > 0) {
    return {
      canExpire: false,
      reason: 'payment_event_requires_reconciliation',
      paymentOrders,
      paymentEvents
    };
  }

  if (paymentOrders.length === 0) {
    return { canExpire: true, reason: 'no_payment_order', paymentOrders, paymentEvents };
  }

  const unsafeOrder = paymentOrders.find((order) => !isTerminalFailedPreCheckoutOrder(order));
  if (unsafeOrder) {
    return {
      canExpire: false,
      reason: 'payment_order_requires_reconciliation',
      paymentOrder: unsafeOrder,
      paymentOrders,
      paymentEvents
    };
  }

  return {
    canExpire: true,
    reason: 'only_terminal_failed_pre_checkout_orders',
    paymentOrders,
    paymentEvents
  };
};

const expireIntentIfSafelyUnpaid = async ({
  intentId,
  requesterUserId = null,
  now = new Date(),
  models
}) => {
  const {
    RegistrationIntent: IntentModel = DEFAULT_MODELS.RegistrationIntent,
    PaymentOrder: PaymentOrderModel = DEFAULT_MODELS.PaymentOrder,
    PaymentEvent: PaymentEventModel = DEFAULT_MODELS.PaymentEvent
  } = models;

  const criteria = { _id: intentId };
  if (requesterUserId) criteria.captainUserId = requesterUserId;

  const intent = await IntentModel.findOne(criteria);
  if (!intent) {
    throw createRegistrationError('INTENT_NOT_FOUND', 'Registration intent not found', 404);
  }

  if (!intent.reservation?.capacityReserved || intent.reservation?.capacityReleased) {
    return { intent, expired: false, reason: 'reservation_not_live' };
  }

  if (intent.reservation.expiresAt > now) {
    return { intent, expired: false, reason: 'reservation_not_expired' };
  }

  const safety = await classifyIntentExpirySafety({
    intent,
    PaymentOrderModel,
    PaymentEventModel
  });
  if (!safety.canExpire) {
    return {
      intent,
      paymentOrder: safety.paymentOrder || safety.paymentOrders?.[0] || null,
      paymentOrders: safety.paymentOrders,
      paymentEvents: safety.paymentEvents,
      expired: false,
      reason: safety.reason
    };
  }

  if (intent.status !== 'reserved') {
    return { intent, expired: false, reason: 'intent_state_requires_reconciliation' };
  }

  const session = await mongoose.startSession();
  try {
    let released;
    await session.withTransaction(async () => {
      released = await releaseReservedIntent({
        intentId: intent._id,
        requesterUserId,
        releaseReason: 'expired_unpaid_recovery',
        terminalStatus: 'expired_unpaid',
        models,
        session
      });
    });

    if (released) {
      return { intent: released, expired: true, reason: 'expired_unpaid', paymentOrders: safety.paymentOrders };
    }

    const latest = await IntentModel.findById(intent._id);
    return { intent: latest || intent, expired: false, reason: 'already_transitioned' };
  } finally {
    await session.endSession();
  }
};

const countLiveReservedIntents = async ({ tournamentId, RegistrationIntent: IntentModel = RegistrationIntent }) => (
  IntentModel.countDocuments({
    tournamentId,
    status: { $in: CAPACITY_HOLDING_INTENT_STATUSES },
    'reservation.capacityReserved': true,
    'reservation.capacityReleased': false
  })
);

module.exports = {
  CAPACITY_HOLDING_INTENT_STATUSES,
  cancelRegistrationIntent,
  countLiveReservedIntents,
  createRegistrationIntent,
  expireDueUnpaidIntents,
  expireIntentIfSafelyUnpaid,
  classifyIntentExpirySafety,
  hashRequestPayload,
  releaseReservedIntent
};

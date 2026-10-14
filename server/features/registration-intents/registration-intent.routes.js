const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const auth = require('../../middleware/auth');
const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
const TournamentRegistration = require('../../models/TournamentRegistration');
const Team = require('../teams/team.model');
const RegistrationIntent = require('./registration-intent.model');
const PaymentOrder = require('../payments/payment-order.model');
const PaymentEvent = require('../payments/payment-event.model');
const TournamentRegistrationClaim = require('../../models/TournamentRegistrationClaim');
const {
  cancelRegistrationIntent,
  createRegistrationIntent,
  expireIntentIfSafelyUnpaid
} = require('./registration-intent.service');
const {
  createPaymentOrder,
  recoverExpiredAbandonedCheckout
} = require('../payments/payment.service');

const router = express.Router();

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

const safeErrorCode = (error, fallbackCode) => error?.code || error?.error?.code || fallbackCode;
const safeErrorMessage = (error) => (
  error?.message ||
  error?.error?.description ||
  error?.description ||
  'Registration intent operation failed'
);

const logIntentError = ({ error, code, status }) => {
  if (process.env.NODE_ENV === 'test') return;
  console.error('Registration intent API error', {
    code,
    status,
    name: error?.name,
    message: safeErrorMessage(error),
    stack: error?.stack
  });
};

const sendIntentError = (res, error, fallbackCode = 'REGISTRATION_INTENT_FAILED') => {
  const status = error?.status || error?.statusCode || 500;
  const code = safeErrorCode(error, fallbackCode);
  const message = safeErrorMessage(error);
  logIntentError({ error, code, status });

  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString()
    }
  });
};

const sendReservationExpiredError = async ({ req, res, error }) => {
  try {
    const recovery = await expireIntentIfSafelyUnpaid({
      intentId: req.params.intentId,
      requesterUserId: req.user.userId,
      models
    });

    if (recovery.expired) {
      return res.status(409).json({
        success: false,
        error: {
          code: error.code,
          message: 'Previous registration reservation expired safely. Please start a new payment attempt.',
          timestamp: new Date().toISOString()
        },
        recovery: {
          canCreateNewIntent: true,
          reason: recovery.reason,
          intentId: recovery.intent?._id,
          status: recovery.intent?.status
        }
      });
    }

    if (
      recovery.reason === 'payment_order_requires_reconciliation' ||
      recovery.reason === 'payment_event_requires_reconciliation' ||
      recovery.reason === 'captured_payment_event_requires_reconciliation'
    ) {
      if (recovery.reason === 'payment_order_requires_reconciliation' && recovery.paymentOrder?._id) {
        const abandonedRecovery = await recoverExpiredAbandonedCheckout({
          intentId: req.params.intentId,
          requesterUserId: req.user.userId,
          paymentOrderId: recovery.paymentOrder._id,
          models
        });

        if (abandonedRecovery.expired) {
          return res.status(409).json({
            success: false,
            error: {
              code: error.code,
              message: 'Previous payment attempt expired safely. Please start a new payment attempt.',
              timestamp: new Date().toISOString()
            },
            recovery: {
              canCreateNewIntent: true,
              reason: abandonedRecovery.reason,
              intentId: abandonedRecovery.intent?._id,
              paymentOrderId: abandonedRecovery.paymentOrder?._id,
              paymentOrderStatus: abandonedRecovery.paymentOrder?.status,
              status: abandonedRecovery.intent?.status
            }
          });
        }

        if (abandonedRecovery.fulfilled) {
          return res.status(409).json({
            success: false,
            error: {
              code: 'PAYMENT_CAPTURE_RECOVERED',
              message: 'Payment was recovered and registration is pending admin review. Please refresh registration status.',
              timestamp: new Date().toISOString()
            },
            recovery: {
              canCreateNewIntent: false,
              reason: abandonedRecovery.reason,
              intentId: abandonedRecovery.intent?._id,
              paymentOrderId: abandonedRecovery.paymentOrder?._id,
              registrationId: abandonedRecovery.registration?._id
            }
          });
        }

        recovery.reason = abandonedRecovery.reason || recovery.reason;
        recovery.paymentOrder = abandonedRecovery.paymentOrder || recovery.paymentOrder;
      }

      return res.status(409).json({
        success: false,
        error: {
          code: 'PAYMENT_ATTEMPT_REQUIRES_RECONCILIATION',
          message: 'This expired reservation has a payment order and must be reconciled before retrying checkout.',
          timestamp: new Date().toISOString()
        },
        recovery: {
          canCreateNewIntent: false,
          reason: recovery.reason,
          intentId: recovery.intent?._id,
          paymentOrderId: recovery.paymentOrder?._id,
          paymentOrderStatus: recovery.paymentOrder?.status,
          paymentOrderCount: recovery.paymentOrders?.length || 0,
          paymentEventCount: recovery.paymentEvents?.length || 0
        }
      });
    }

    return sendIntentError(res, error, 'PAYMENT_ORDER_FAILED');
  } catch (recoveryError) {
    return sendIntentError(res, recoveryError, 'PAYMENT_ORDER_RECOVERY_FAILED');
  }
};

const buildIntentStatusPayload = async (intent) => {
  if (!intent) {
    return {
      intent: null,
      paymentOrder: null,
      registration: null
    };
  }

  const orderSelect = 'status fulfillmentStatus gateway gatewayOrderId gatewayPaymentId amountMinor currency capturedAt lastVerifiedAt lastError';
  const [linkedPaymentOrder, latestPaymentOrder, orderCount, registration] = await Promise.all([
    intent.paymentOrderId ? PaymentOrder.findOne({
      _id: intent.paymentOrderId,
      intentId: intent._id
    }).select(orderSelect) : null,
    PaymentOrder.findOne({ intentId: intent._id }).sort({ createdAt: -1 }).select(orderSelect),
    PaymentOrder.countDocuments({ intentId: intent._id }),
    TournamentRegistration.findOne({ 'payment.intentId': intent._id }).select(
      'status payment registeredAt teamName tournamentId'
    )
  ]);
  const paymentOrder = linkedPaymentOrder || (!intent.paymentOrderId ? latestPaymentOrder : null);
  const paymentOrderConsistency = {
    orderCount,
    selectedBy: linkedPaymentOrder ? 'intent.paymentOrderId' : (!intent.paymentOrderId && latestPaymentOrder ? 'latest_for_intent' : 'none'),
    linkedOrderMissing: Boolean(intent.paymentOrderId && !linkedPaymentOrder),
    latestPaymentOrderId: latestPaymentOrder?._id || null
  };

  return {
    intent: {
      intentId: intent._id,
      status: intent.status,
      expiresAt: intent.reservation.expiresAt,
      capacityReserved: intent.reservation.capacityReserved,
      capacityReleased: intent.reservation.capacityReleased,
      fee: intent.feeSnapshot,
      paymentOrderId: intent.paymentOrderId,
      fulfilledRegistrationId: intent.fulfilledRegistrationId
    },
    paymentOrder: paymentOrder ? {
      paymentOrderId: paymentOrder._id,
      status: paymentOrder.status,
      fulfillmentStatus: paymentOrder.fulfillmentStatus,
      gateway: paymentOrder.gateway,
      gatewayOrderId: paymentOrder.gatewayOrderId,
      gatewayPaymentId: paymentOrder.gatewayPaymentId,
      amountMinor: paymentOrder.amountMinor,
      currency: paymentOrder.currency,
      capturedAt: paymentOrder.capturedAt,
      lastVerifiedAt: paymentOrder.lastVerifiedAt,
      lastError: paymentOrder.lastError
    } : null,
    paymentOrderConsistency,
    registration: registration ? {
      registrationId: registration._id,
      status: registration.status,
      payment: registration.payment,
      registeredAt: registration.registeredAt,
      teamName: registration.teamName,
      tournamentId: registration.tournamentId
    } : null
  };
};

const recoverExpiredReservedIntentIfNeeded = async ({ intent, requesterUserId }) => {
  if (
    intent &&
    intent.status === 'reserved' &&
    intent.reservation?.capacityReserved &&
    !intent.reservation?.capacityReleased &&
    intent.reservation.expiresAt <= new Date()
  ) {
    const recoveryResult = await expireIntentIfSafelyUnpaid({
      intentId: intent._id,
      requesterUserId,
      models
    });
    return {
      intent: recoveryResult.intent,
      recovery: {
        canCreateNewIntent: Boolean(recoveryResult.expired),
        reason: recoveryResult.reason,
        paymentOrderId: recoveryResult.paymentOrder?._id || null,
        paymentOrderStatus: recoveryResult.paymentOrder?.status || null,
        paymentOrderCount: recoveryResult.paymentOrders?.length || 0,
        paymentEventCount: recoveryResult.paymentEvents?.length || 0
      }
    };
  }

  return { intent, recovery: null };
};

router.post('/', auth, [
  body('gameType').equals('valorant').withMessage('Only Valorant registration intents are supported'),
  body('tournamentId').isMongoId().withMessage('A valid tournamentId is required'),
  body('teamId').isMongoId().withMessage('A valid teamId is required'),
  body('idempotencyKey').isString().isLength({ min: 8, max: 128 }).withMessage('A stable idempotencyKey is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await createRegistrationIntent({
      requesterUserId: req.user.userId,
      gameType: req.body.gameType,
      tournamentId: req.body.tournamentId,
      teamId: req.body.teamId,
      idempotencyKey: req.body.idempotencyKey,
      createdByIp: req.ip,
      userAgent: req.get('user-agent') || '',
      models
    });

    return res.status(result.reused ? 200 : 201).json({
      success: true,
      data: {
        intentId: result.intent._id,
        status: result.intent.status,
        expiresAt: result.intent.reservation.expiresAt,
        fee: result.intent.feeSnapshot,
        requiresPayment: result.requiresPayment,
        reused: result.reused
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return sendIntentError(res, error);
  }
});

router.get('/active', auth, [
  query('gameType').equals('valorant').withMessage('Only Valorant registration intents are supported'),
  query('tournamentId').isMongoId().withMessage('A valid tournamentId is required'),
  query('teamId').isMongoId().withMessage('A valid teamId is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    let intent = await RegistrationIntent.findOne({
      gameType: 'valorant',
      tournamentId: req.query.tournamentId,
      teamId: req.query.teamId,
      captainUserId: req.user.userId,
      status: {
        $in: [
          'reserved',
          'payment_order_created',
          'payment_authorized',
          'payment_captured',
          'fulfilling',
          'fulfilled',
          'capture_late_review',
          'refund_pending',
          'refunded'
        ]
      }
    }).sort({ createdAt: -1 });
    const recoveryResult = await recoverExpiredReservedIntentIfNeeded({
      intent,
      requesterUserId: req.user.userId
    });
    intent = recoveryResult.intent;
    const recovery = recoveryResult.recovery;

    const data = await buildIntentStatusPayload(intent);
    if (recovery) data.recovery = recovery;

    return res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return sendIntentError(res, error, 'FETCH_ACTIVE_INTENT_FAILED');
  }
});

router.get('/:intentId', auth, [
  param('intentId').isMongoId().withMessage('A valid intentId is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    let intent = await RegistrationIntent.findOne({
      _id: req.params.intentId,
      captainUserId: req.user.userId
    });
    if (!intent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INTENT_NOT_FOUND',
          message: 'Registration intent not found',
          timestamp: new Date().toISOString()
        }
      });
    }

    const recoveryResult = await recoverExpiredReservedIntentIfNeeded({
      intent,
      requesterUserId: req.user.userId
    });
    intent = recoveryResult.intent;
    const data = await buildIntentStatusPayload(intent);
    if (recoveryResult.recovery) data.recovery = recoveryResult.recovery;

    return res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return sendIntentError(res, error, 'FETCH_INTENT_FAILED');
  }
});

router.post('/:intentId/payment-order', auth, [
  param('intentId').isMongoId().withMessage('A valid intentId is required'),
  body('gateway').optional().equals('razorpay').withMessage('Only Razorpay is supported'),
  body('idempotencyKey').isString().isLength({ min: 8, max: 128 }).withMessage('A stable idempotencyKey is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const result = await createPaymentOrder({
      intentId: req.params.intentId,
      requesterUserId: req.user.userId,
      idempotencyKey: req.body.idempotencyKey,
      models
    });

    return res.status(result.reused ? 200 : 201).json({
      success: true,
      data: result.checkout,
      reused: result.reused,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.code === 'RESERVATION_EXPIRED') {
      return sendReservationExpiredError({ req, res, error });
    }
    return sendIntentError(res, error, 'PAYMENT_ORDER_FAILED');
  }
});

router.post('/:intentId/cancel', auth, [
  param('intentId').isMongoId().withMessage('A valid intentId is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: errors.array(),
          timestamp: new Date().toISOString()
        }
      });
    }

    const intent = await cancelRegistrationIntent({
      intentId: req.params.intentId,
      requesterUserId: req.user.userId,
      models
    });

    return res.json({
      success: true,
      data: {
        intentId: intent._id,
        status: intent.status,
        capacityReleased: intent.reservation.capacityReleased
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return sendIntentError(res, error, 'CANCEL_INTENT_FAILED');
  }
});

module.exports = router;
module.exports._buildIntentStatusPayload = buildIntentStatusPayload;

const crypto = require('crypto');
const mongoose = require('mongoose');

const RegistrationIntent = require('../registration-intents/registration-intent.model');
const PaymentOrder = require('./payment-order.model');
const PaymentEvent = require('./payment-event.model');
const PaymentReceipt = require('./payment-receipt.model');
const PaymentNotificationIntent = require('./payment-notification-intent.model');
const TournamentRegistration = require('../../models/TournamentRegistration');
const TournamentRegistrationClaim = require('../../models/TournamentRegistrationClaim');
const User = require('../../models/User');
const paymentFeatures = require('../../config/paymentFeatures');
const { RazorpayAdapter, createPaymentError } = require('./razorpay.adapter');

const ACTIVE_CAPTURE_STATUSES = ['captured'];

const sanitizeOrder = (order = {}) => ({
  id: order.id,
  entity: order.entity,
  amount: order.amount,
  amount_paid: order.amount_paid,
  amount_due: order.amount_due,
  currency: order.currency,
  receipt: order.receipt,
  status: order.status,
  attempts: order.attempts,
  created_at: order.created_at,
  notes: order.notes ? {
    intentId: order.notes.intentId,
    paymentOrderId: order.notes.paymentOrderId,
    tournamentId: order.notes.tournamentId,
    captainUserId: order.notes.captainUserId,
    gameType: order.notes.gameType,
    providerCreateAttemptId: order.notes.providerCreateAttemptId
  } : undefined
});

const sanitizePayment = (payment = {}) => ({
  id: payment.id,
  entity: payment.entity,
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  order_id: payment.order_id,
  method: payment.method,
  captured: payment.captured,
  created_at: payment.created_at
});

const payloadHash = (rawBody) => crypto
  .createHash('sha256')
  .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || '')))
  .digest('hex');

const providerReceiptForIntent = (intentId) => `valorant_reg_${intentId.toString()}`;

const getGatewayAdapter = (adapter) => adapter || new RazorpayAdapter();

const providerAttemptForPaymentOrder = (paymentOrderId) => `rzp_order_create_${paymentOrderId.toString()}`;

const receiptNumberForPaymentOrder = (paymentOrderId) => (
  `COLAB-VAL-${paymentOrderId.toString().slice(-10).toUpperCase()}`
);

const providerNotesForOrder = ({ intent, paymentOrder, providerCreateAttemptId }) => ({
  intentId: intent._id.toString(),
  paymentOrderId: paymentOrder._id.toString(),
  tournamentId: intent.tournamentId.toString(),
  captainUserId: intent.captainUserId.toString(),
  gameType: 'valorant',
  providerCreateAttemptId
});

const checkoutPayloadForOrder = ({ order, adapter }) => ({
  paymentOrderId: order._id,
  gateway: 'razorpay',
  razorpayOrderId: order.gatewayOrderId,
  amountMinor: order.amountMinor,
  currency: order.currency,
  keyId: adapter.getPublicConfig().keyId
});

const isProviderOutcomeUnknown = (error = {}) => (
  error.providerOutcomeUnknown === true ||
  error.code === 'ETIMEDOUT' ||
  error.code === 'ECONNRESET' ||
  error.code === 'ECONNABORTED' ||
  error.code === 'ESOCKETTIMEDOUT' ||
  error.timeout === true
);

const safeErrorMessage = (error, fallback = 'Unknown payment processing error') => (
  error?.message ||
  error?.error?.description ||
  error?.description ||
  fallback
);

const assertProviderOrderMatchesLocalOrder = ({ providerOrder, localOrder }) => {
  if (!providerOrder) {
    throw createPaymentError('PROVIDER_ORDER_NOT_FOUND', 'Provider order could not be found for this payment order', 409);
  }
  if (Number(providerOrder.amount) !== Number(localOrder.amountMinor)) {
    throw createPaymentError('PROVIDER_ORDER_AMOUNT_MISMATCH', 'Provider order amount does not match the local order', 409);
  }
  if (providerOrder.currency !== localOrder.currency) {
    throw createPaymentError('PROVIDER_ORDER_CURRENCY_MISMATCH', 'Provider order currency does not match the local order', 409);
  }
  if (providerOrder.receipt && providerOrder.receipt !== localOrder.providerReceipt) {
    throw createPaymentError('PROVIDER_ORDER_RECEIPT_MISMATCH', 'Provider order receipt does not match the local order', 409);
  }
};

const assertOrderCreationEnabled = (options = {}) => {
  if (options.ignoreFeatureFlag) return;
  if (!paymentFeatures.valorantPaymentOrderCreateEnabled) {
    throw createPaymentError('PAYMENT_ORDER_CREATE_DISABLED', 'Payment order creation is disabled', 503);
  }
};

const assertVerifyEnabled = (options = {}) => {
  if (options.ignoreFeatureFlag) return;
  if (!paymentFeatures.valorantPaymentVerifyEnabled) {
    throw createPaymentError('PAYMENT_VERIFY_DISABLED', 'Payment verification is disabled', 503);
  }
};

const assertWebhookEnabled = (options = {}) => {
  if (options.ignoreFeatureFlag) return;
  if (!paymentFeatures.razorpayWebhookProcessingEnabled) {
    throw createPaymentError('WEBHOOK_PROCESSING_DISABLED', 'Razorpay webhook processing is disabled', 503);
  }
};

const assertReconciliationEnabled = (options = {}) => {
  if (options.ignoreFeatureFlag) return;
  if (!paymentFeatures.paymentReconciliationEnabled) {
    throw createPaymentError('PAYMENT_RECONCILIATION_DISABLED', 'Payment reconciliation is disabled', 503);
  }
};

const assertIntentCanCreateOrder = (intent, requesterUserId) => {
  if (!intent) throw createPaymentError('INTENT_NOT_FOUND', 'Registration intent not found', 404);
  if (intent.captainUserId.toString() !== requesterUserId.toString()) {
    throw createPaymentError('ACCESS_DENIED', 'Only the captain can create a payment order', 403);
  }
  if (!['reserved', 'payment_order_created'].includes(intent.status)) {
    throw createPaymentError('INTENT_NOT_PAYABLE', 'Registration intent is not payable in its current state', 409);
  }
  if (!intent.reservation?.capacityReserved || intent.reservation?.capacityReleased) {
    throw createPaymentError('RESERVATION_NOT_LIVE', 'Registration intent reservation is not live', 409);
  }
  if (intent.reservation.expiresAt <= new Date()) {
    throw createPaymentError('RESERVATION_EXPIRED', 'Registration intent reservation has expired', 409);
  }
  if (intent.feeSnapshot.currency !== 'INR' || !Number.isInteger(intent.feeSnapshot.amountMinor) || intent.feeSnapshot.amountMinor <= 0) {
    throw createPaymentError('INVALID_FEE_SNAPSHOT', 'Registration intent fee snapshot is invalid', 409);
  }
};

const validateExistingGatewayOrderForCheckout = async ({ paymentOrder, adapter }) => {
  let providerOrder;
  try {
    providerOrder = await adapter.fetchOrder(paymentOrder.gatewayOrderId);
  } catch (error) {
    throw createPaymentError(
      'PROVIDER_ORDER_VALIDATION_FAILED',
      `Could not validate existing provider order: ${error.message}`,
      503
    );
  }

  assertProviderOrderMatchesLocalOrder({ providerOrder, localOrder: paymentOrder });
  paymentOrder.providerOrder = sanitizeOrder(providerOrder);
  paymentOrder.lastVerifiedAt = new Date();

  if (providerOrder.status === 'paid') {
    paymentOrder.status = paymentOrder.status === 'captured' ? 'captured' : 'created';
    paymentOrder.lastError = 'Provider order is already paid and requires payment reconciliation';
    await paymentOrder.save();
    throw createPaymentError(
      'PROVIDER_ORDER_ALREADY_PAID',
      'Provider order is already paid and must be reconciled before checkout can continue',
      409
    );
  }

  if (!['created', 'attempted'].includes(providerOrder.status)) {
    paymentOrder.status = 'provider_create_unknown';
    paymentOrder.lastError = `Provider order status ${providerOrder.status} is not checkout-ready`;
    await paymentOrder.save();
    throw createPaymentError(
      'PROVIDER_ORDER_NOT_CHECKOUT_READY',
      'Provider order is not checkout-ready and requires operational review',
      409
    );
  }

  paymentOrder.status = 'created';
  paymentOrder.lastError = '';
  await paymentOrder.save();
  return checkoutPayloadForOrder({ order: paymentOrder, adapter });
};

const findRecoverableProviderOrders = async ({ paymentOrder, adapter }) => {
  if (typeof adapter.findOrdersByReceipt !== 'function') return null;
  const response = await adapter.findOrdersByReceipt(paymentOrder.providerReceipt);
  if (!response || !Array.isArray(response.items)) return null;

  return response.items.filter((order) => {
    const notes = order.notes || {};
    return (
      order.receipt === paymentOrder.providerReceipt &&
      order.amount === paymentOrder.amountMinor &&
      order.currency === paymentOrder.currency &&
      (
        notes.paymentOrderId === paymentOrder._id.toString() ||
        notes.intentId === paymentOrder.intentId.toString() ||
        notes.providerCreateAttemptId === paymentOrder.providerCreateAttemptId
      )
    );
  });
};

const blockUnknownProviderCreate = async ({ paymentOrder, reason }) => {
  paymentOrder.status = 'provider_create_unknown';
  paymentOrder.isLiveOrder = true;
  paymentOrder.lastError = reason;
  await paymentOrder.save();
  throw createPaymentError(
    'PAYMENT_PROVIDER_CREATE_UNKNOWN',
    'Payment provider order creation outcome is unknown; checkout is blocked pending operational reconciliation',
    409
  );
};

const reconcileProviderCreateAttempt = async ({ paymentOrder, adapter }) => {
  if (paymentOrder.gatewayOrderId) {
    return validateExistingGatewayOrderForCheckout({ paymentOrder, adapter });
  }

  let matches;
  try {
    matches = await findRecoverableProviderOrders({ paymentOrder, adapter });
  } catch (error) {
    return blockUnknownProviderCreate({
      paymentOrder,
      reason: `Provider receipt lookup failed: ${error.message}`
    });
  }

  if (matches === null) {
    return blockUnknownProviderCreate({
      paymentOrder,
      reason: 'Provider adapter cannot reliably lookup orders by receipt'
    });
  }
  if (matches.length !== 1) {
    return blockUnknownProviderCreate({
      paymentOrder,
      reason: `Provider receipt lookup returned ${matches.length} recoverable matches`
    });
  }

  const providerOrder = matches[0];
  assertProviderOrderMatchesLocalOrder({ providerOrder, localOrder: paymentOrder });
  paymentOrder.gatewayOrderId = providerOrder.id;
  paymentOrder.providerOrder = sanitizeOrder(providerOrder);
  paymentOrder.status = 'created';
  paymentOrder.lastVerifiedAt = new Date();
  paymentOrder.lastError = '';
  await paymentOrder.save();

  return validateExistingGatewayOrderForCheckout({ paymentOrder, adapter });
};

const createPaymentOrder = async ({
  intentId,
  requesterUserId,
  idempotencyKey,
  gatewayAdapter,
  models = {},
  options = {}
}) => {
  assertOrderCreationEnabled(options);
  if (!idempotencyKey || idempotencyKey.length < 8) {
    throw createPaymentError('INVALID_IDEMPOTENCY_KEY', 'A stable idempotency key is required');
  }

  const IntentModel = models.RegistrationIntent || RegistrationIntent;
  const PaymentOrderModel = models.PaymentOrder || PaymentOrder;
  const adapter = getGatewayAdapter(gatewayAdapter);

  const intent = await IntentModel.findById(intentId);
  assertIntentCanCreateOrder(intent, requesterUserId);

  const existingLiveOrder = await PaymentOrderModel.findOne({ intentId: intent._id, isLiveOrder: true });
  if (existingLiveOrder) {
    const checkout = await reconcileProviderCreateAttempt({
      paymentOrder: existingLiveOrder,
      adapter
    });
    return { paymentOrder: existingLiveOrder, reused: true, checkout };
  }
  if (intent.status !== 'reserved') {
    throw createPaymentError('INTENT_NOT_PAYABLE', 'Registration intent is not payable in its current state', 409);
  }

  const providerReceipt = providerReceiptForIntent(intent._id);
  const paymentOrderId = new mongoose.Types.ObjectId();
  const providerCreateAttemptId = providerAttemptForPaymentOrder(paymentOrderId);
  const paymentOrder = new PaymentOrderModel({
    _id: paymentOrderId,
    intentId: intent._id,
    purpose: 'tournament_registration',
    gameType: 'valorant',
    tournamentId: intent.tournamentId,
    captainUserId: intent.captainUserId,
    gateway: 'razorpay',
    amountMinor: intent.feeSnapshot.amountMinor,
    currency: intent.feeSnapshot.currency,
    providerReceipt,
    idempotencyKey,
    status: 'provider_create_pending',
    fulfillmentStatus: 'not_started',
    isLiveOrder: true,
    providerCreateAttemptId,
    providerCorrelation: {
      providerCreateAttemptId,
      intentId: intent._id.toString(),
      paymentOrderId: paymentOrderId.toString(),
      tournamentId: intent.tournamentId.toString(),
      captainUserId: intent.captainUserId.toString(),
      gameType: 'valorant'
    }
  });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await paymentOrder.save({ session });
      await IntentModel.updateOne(
        { _id: intent._id, paymentOrderId: null },
        { $set: { paymentOrderId: paymentOrder._id } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  let providerOrder;
  try {
    const notes = providerNotesForOrder({ intent, paymentOrder, providerCreateAttemptId });
    providerOrder = await adapter.createOrder({
      amountMinor: paymentOrder.amountMinor,
      currency: paymentOrder.currency,
      receipt: providerReceipt,
      notes
    });
  } catch (error) {
    const lastError = safeErrorMessage(error, 'Payment provider order creation failed');
    const statusUpdate = isProviderOutcomeUnknown(error)
      ? { status: 'provider_create_unknown', isLiveOrder: true, lastError }
      : { status: 'failed', isLiveOrder: false, lastError };
    await PaymentOrderModel.updateOne(
      { _id: paymentOrder._id, status: 'provider_create_pending' },
      { $set: statusUpdate }
    );
    throw error;
  }

  try {
    if (options.failAfterProviderOrderCreate) {
      throw createPaymentError('SIMULATED_DB_FAILURE_AFTER_PROVIDER_ORDER', 'Simulated DB failure after provider order creation', 500);
    }

    paymentOrder.gatewayOrderId = providerOrder.id;
    paymentOrder.providerOrder = sanitizeOrder(providerOrder);
    paymentOrder.status = 'created';
    paymentOrder.lastError = '';
    await paymentOrder.save();
    await IntentModel.updateOne(
      { _id: intent._id, status: 'reserved' },
      { $set: { status: 'payment_order_created' } }
    );
  } catch (error) {
    const lastError = safeErrorMessage(error, 'Payment order database update failed after provider order creation');
    await PaymentOrderModel.updateOne(
      { _id: paymentOrder._id, status: 'provider_create_pending' },
      { $set: { status: 'provider_create_unknown', isLiveOrder: true, lastError } }
    );
    throw error;
  }

  return {
    paymentOrder,
    reused: false,
    checkout: checkoutPayloadForOrder({ order: paymentOrder, adapter })
  };
};

const createRegistrationFromIntent = (intent, registrationId) => ({
  _id: registrationId,
  tournamentId: intent.tournamentId,
  userId: intent.captainUserId,
  teamId: intent.teamId,
  teamName: intent.rosterSnapshot.teamName,
  teamLeader: intent.rosterSnapshot.teamLeader,
  teamMembers: intent.rosterSnapshot.teamMembers,
  substitutePlayer: intent.rosterSnapshot.substitutePlayer,
  whatsappNumber: intent.rosterSnapshot.whatsappNumber,
  roster: intent.rosterSnapshot.roster,
  status: 'pending'
});

const ensureReceiptAndNotificationIntent = async ({
  order,
  intent,
  registration,
  models,
  session
}) => {
  if (order.status !== 'captured' || !order.gatewayPaymentId) {
    throw createPaymentError('PAYMENT_RECEIPT_NOT_CAPTURED', 'Receipt can only be created for a captured payment', 409);
  }
  if (registration.payment?.status !== 'paid') {
    throw createPaymentError('REGISTRATION_NOT_PAID', 'Receipt can only be created for a paid registration', 409);
  }

  const ReceiptModel = models.PaymentReceipt || PaymentReceipt;
  const NotificationIntentModel = models.PaymentNotificationIntent || PaymentNotificationIntent;
  const UserModel = models.User || User;

  const captain = await UserModel.findById(order.captainUserId).select('email').session(session);
  if (!captain?.email) {
    throw createPaymentError('CAPTAIN_EMAIL_NOT_FOUND', 'Captain email is required to create a receipt notification intent', 409);
  }

  const receipt = await ReceiptModel.findOneAndUpdate(
    { paymentOrderId: order._id },
    {
      $setOnInsert: {
        receiptNumber: receiptNumberForPaymentOrder(order._id),
        paymentOrderId: order._id,
        registrationIntentId: intent._id,
        tournamentRegistrationId: registration._id,
        tournamentId: order.tournamentId,
        captainUserId: order.captainUserId,
        teamName: registration.teamName,
        amountMinor: order.amountMinor,
        currency: order.currency,
        gateway: order.gateway,
        gatewayPaymentId: order.gatewayPaymentId,
        capturedAt: order.capturedAt || registration.payment?.paidAt || new Date()
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  const notificationIntent = await NotificationIntentModel.findOneAndUpdate(
    {
      type: 'payment_receipt_email',
      paymentOrderId: order._id,
      recipientUserId: order.captainUserId
    },
    {
      $setOnInsert: {
        receiptId: receipt._id,
        recipientEmail: captain.email,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date()
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  return { receipt, notificationIntent };
};

const fulfillCapturedPayment = async ({ paymentOrderId, models = {}, options = {} }) => {
  const IntentModel = models.RegistrationIntent || RegistrationIntent;
  const PaymentOrderModel = models.PaymentOrder || PaymentOrder;
  const RegistrationModel = models.TournamentRegistration || TournamentRegistration;
  const ClaimModel = models.ClaimModel || TournamentRegistrationClaim;

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await PaymentOrderModel.findById(paymentOrderId).session(session);
      if (!order) throw createPaymentError('PAYMENT_ORDER_NOT_FOUND', 'Payment order not found', 404);

      const existingRegistration = await RegistrationModel.findOne({ 'payment.paymentOrderId': order._id }).session(session);
      if (existingRegistration) {
        const currentIntent = await IntentModel.findById(order.intentId).session(session);
        if (currentIntent && existingRegistration.payment?.status === 'paid') {
          await ensureReceiptAndNotificationIntent({
            order,
            intent: currentIntent,
            registration: existingRegistration,
            models,
            session
          });
        }
        result = { registration: existingRegistration, alreadyFulfilled: true };
        return;
      }

      if (order.status !== 'captured') {
        throw createPaymentError('PAYMENT_NOT_CAPTURED', 'Payment order is not captured', 409);
      }

      const intent = await IntentModel.findOneAndUpdate(
        {
          _id: order.intentId,
          status: 'payment_captured',
          fulfilledRegistrationId: null,
          'reservation.capacityReserved': true,
          'reservation.capacityReleased': false
        },
        { $set: { status: 'fulfilling' } },
        { new: true, session }
      );

      if (!intent) {
        const currentIntent = await IntentModel.findById(order.intentId).session(session);
        if (currentIntent?.fulfilledRegistrationId) {
          const registration = await RegistrationModel.findById(currentIntent.fulfilledRegistrationId).session(session);
          result = { registration, alreadyFulfilled: true };
          return;
        }
        if (currentIntent?.reservation?.capacityReleased || currentIntent?.status === 'expired_unpaid') {
          await PaymentOrderModel.updateOne(
            { _id: order._id },
            {
              $set: {
                status: 'capture_late_review',
                fulfillmentStatus: 'captured_unfulfilled',
                lastError: 'Payment captured after reservation release; manual review required'
              }
            },
            { session }
          );
          result = { lateCaptureRequiresReview: true };
          return;
        }
        await PaymentOrderModel.updateOne(
          { _id: order._id },
          { $set: { fulfillmentStatus: 'captured_unfulfilled', lastError: 'Intent not fulfillable in current state' } },
          { session }
        );
        throw createPaymentError('INTENT_NOT_FULFILLABLE', 'Captured payment intent is not fulfillable', 409);
      }

      const registrationId = new mongoose.Types.ObjectId();
      const registration = new RegistrationModel({
        ...createRegistrationFromIntent(intent, registrationId),
        payment: {
          status: 'paid',
          amountMinor: order.amountMinor,
          currency: order.currency,
          feeScope: intent.feeSnapshot.feeScope,
          intentId: intent._id,
          paymentOrderId: order._id,
          paidAt: order.capturedAt || new Date(),
          refundStatus: 'not_applicable'
        }
      });
      registration.$locals.skipParticipantSync = true;

      const claimUpdate = await ClaimModel.updateMany(
        { intentId: intent._id, holderType: 'intent' },
        {
          $set: { holderType: 'registration', registrationId: registration._id },
          $unset: { intentId: '' }
        },
        { session }
      );
      if (claimUpdate.modifiedCount !== 13) {
        throw createPaymentError('CLAIM_TRANSFER_FAILED', 'Could not transfer all registration claims', 409);
      }

      if (options.failDuringFulfillment) {
        throw createPaymentError('SIMULATED_FULFILLMENT_FAILURE', 'Simulated fulfillment failure', 500);
      }

      await registration.save({ session });
      await IntentModel.updateOne(
        { _id: intent._id },
        {
          $set: {
            status: 'fulfilled',
            blocksNewIntent: false,
            fulfilledRegistrationId: registration._id
          }
        },
        { session }
      );
      await PaymentOrderModel.updateOne(
        { _id: order._id },
        { $set: { fulfillmentStatus: 'fulfilled' } },
        { session }
      );
      await ensureReceiptAndNotificationIntent({
        order,
        intent,
        registration,
        models,
        session
      });
      result = { registration, alreadyFulfilled: false };
    });
    if (result?.lateCaptureRequiresReview) {
      throw createPaymentError('LATE_CAPTURE_REQUIRES_REVIEW', 'Payment captured after reservation release requires operational review', 409);
    }
    return result;
  } catch (error) {
    await PaymentOrderModel.updateOne(
      { _id: paymentOrderId, status: 'captured', fulfillmentStatus: { $ne: 'fulfilled' } },
      { $set: { fulfillmentStatus: 'captured_unfulfilled', lastError: error.message } }
    );
    throw error;
  } finally {
    await session.endSession();
  }
};

const markPaymentCaptured = async ({ paymentOrder, payment, models = {}, options = {} }) => {
  const PaymentOrderModel = models.PaymentOrder || PaymentOrder;
  const IntentModel = models.RegistrationIntent || RegistrationIntent;
  const order = paymentOrder;
  order.gatewayPaymentId = payment.id;
  order.providerPayment = sanitizePayment(payment);
  order.status = 'captured';
  order.capturedAt = new Date();
  order.lastVerifiedAt = new Date();
  order.fulfillmentStatus = order.fulfillmentStatus === 'fulfilled' ? 'fulfilled' : 'not_started';
  await order.save();
  await IntentModel.updateOne(
    { _id: order.intentId, status: { $in: ['reserved', 'payment_order_created', 'payment_authorized'] } },
    { $set: { status: 'payment_captured' } }
  );
};

const verifyRazorpayCheckout = async ({
  requesterUserId,
  paymentOrderId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  gatewayAdapter,
  models = {},
  options = {}
}) => {
  assertVerifyEnabled(options);
  const PaymentOrderModel = models.PaymentOrder || PaymentOrder;
  const adapter = getGatewayAdapter(gatewayAdapter);

  const order = await PaymentOrderModel.findById(paymentOrderId);
  if (!order) throw createPaymentError('PAYMENT_ORDER_NOT_FOUND', 'Payment order not found', 404);
  if (order.captainUserId.toString() !== requesterUserId.toString()) {
    throw createPaymentError('ACCESS_DENIED', 'Only the captain can verify this payment', 403);
  }
  if (order.gatewayOrderId !== razorpay_order_id) {
    throw createPaymentError('GATEWAY_ORDER_MISMATCH', 'Gateway order ID does not match payment order');
  }
  if (order.status === 'captured' && order.fulfillmentStatus === 'fulfilled') {
    const registration = await TournamentRegistration.findOne({ 'payment.paymentOrderId': order._id });
    return { paymentOrder: order, registration, alreadyProcessed: true };
  }
  if (!adapter.verifyCheckoutSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature
  })) {
    throw createPaymentError('INVALID_PAYMENT_SIGNATURE', 'Invalid payment signature', 400);
  }

  const payment = await adapter.fetchPayment(razorpay_payment_id);
  if (payment.order_id !== order.gatewayOrderId) {
    throw createPaymentError('PAYMENT_ORDER_MISMATCH', 'Payment does not belong to the expected order');
  }
  if (payment.amount !== order.amountMinor) {
    throw createPaymentError('PAYMENT_AMOUNT_MISMATCH', 'Payment amount does not match order amount');
  }
  if (payment.currency !== order.currency) {
    throw createPaymentError('PAYMENT_CURRENCY_MISMATCH', 'Payment currency does not match order currency');
  }
  if (!ACTIVE_CAPTURE_STATUSES.includes(payment.status)) {
    order.status = payment.status === 'authorized' ? 'authorized' : 'failed';
    order.providerPayment = sanitizePayment(payment);
    order.lastVerifiedAt = new Date();
    order.lastError = `Payment status ${payment.status}`;
    await order.save();
    throw createPaymentError('PAYMENT_NOT_CAPTURED', 'Payment is not captured', 409);
  }

  await markPaymentCaptured({ paymentOrder: order, payment, models });
  const fulfillment = await fulfillCapturedPayment({ paymentOrderId: order._id, models, options });
  return { paymentOrder: order, registration: fulfillment.registration, alreadyProcessed: fulfillment.alreadyFulfilled };
};

const extractRazorpayPaymentEntity = (payload) => (
  payload?.payload?.payment?.entity ||
  payload?.payment ||
  payload?.payment?.entity ||
  (payload?.entity?.order_id ? payload.entity : null)
);
const extractRazorpayOrderEntity = (payload) => (
  payload?.payload?.order?.entity ||
  payload?.order ||
  payload?.order?.entity ||
  (payload?.entity?.id && !payload?.entity?.order_id ? payload.entity : null)
);

const recoverOrderFromWebhookPayload = async ({ event, PaymentOrderModel }) => {
  const payment = extractRazorpayPaymentEntity(event.sanitizedPayload);
  const orderEntity = extractRazorpayOrderEntity(event.sanitizedPayload);
  const notes = orderEntity?.notes || payment?.notes || {};
  if (!notes.paymentOrderId || !mongoose.Types.ObjectId.isValid(notes.paymentOrderId)) return null;

  const order = await PaymentOrderModel.findOne({
    _id: notes.paymentOrderId,
    gateway: 'razorpay',
    intentId: notes.intentId
  });
  if (!order) return null;
  if (payment?.order_id && order.gatewayOrderId && order.gatewayOrderId !== payment.order_id) {
    throw createPaymentError('WEBHOOK_ORDER_ID_CONFLICT', 'Webhook order ID conflicts with local payment order');
  }

  if (!order.gatewayOrderId && payment?.order_id) {
    order.gatewayOrderId = payment.order_id;
    order.providerOrder = sanitizeOrder(orderEntity || {
      id: payment.order_id,
      entity: 'order',
      amount: order.amountMinor,
      currency: order.currency,
      receipt: order.providerReceipt,
      status: 'attempted',
      notes
    });
    order.status = order.status === 'provider_create_unknown' ? 'created' : order.status;
    order.lastError = '';
    await order.save();
  }

  return order;
};

const processPaymentEvent = async ({ eventId, models = {}, gatewayAdapter, options = {} }) => {
  const PaymentEventModel = models.PaymentEvent || PaymentEvent;
  const PaymentOrderModel = models.PaymentOrder || PaymentOrder;
  const event = await PaymentEventModel.findById(eventId);
  if (!event || event.processingStatus === 'processed' || event.processingStatus === 'ignored') return event;

  event.processingStatus = 'processing';
  event.lockedUntil = new Date(Date.now() + 60_000);
  event.processingAttempts += 1;
  await event.save();

  try {
    if (event.eventType !== 'payment.captured' && event.eventType !== 'payment.authorized' && event.eventType !== 'payment.failed') {
      event.processingStatus = 'ignored';
      event.processingResult = 'event_type_not_handled';
      event.processedAt = new Date();
      event.lockedUntil = null;
      await event.save();
      return event;
    }

    const payment = extractRazorpayPaymentEntity(event.sanitizedPayload);
    if (!payment?.order_id) throw createPaymentError('WEBHOOK_PAYMENT_MISSING', 'Webhook payment entity is missing order ID');
    let order = await PaymentOrderModel.findOne({ gateway: 'razorpay', gatewayOrderId: payment.order_id });
    if (!order) {
      order = await recoverOrderFromWebhookPayload({ event, PaymentOrderModel });
    }
    if (!order) {
      event.processingStatus = 'failed';
      event.lastError = 'Payment order not found for webhook';
      event.lockedUntil = null;
      await event.save();
      return event;
    }

    event.paymentOrderId = order._id;
    event.intentId = order.intentId;
    event.gatewayOrderId = payment.order_id;
    event.gatewayPaymentId = payment.id;

    if (event.eventType === 'payment.captured') {
      if (payment.amount !== order.amountMinor || payment.currency !== order.currency) {
        throw createPaymentError('WEBHOOK_PAYMENT_MISMATCH', 'Webhook payment amount/currency mismatch');
      }
      await markPaymentCaptured({ paymentOrder: order, payment, models });
      await fulfillCapturedPayment({ paymentOrderId: order._id, models, options });
      event.processingResult = 'captured_and_fulfilled';
    } else if (event.eventType === 'payment.authorized') {
      order.status = 'authorized';
      order.providerPayment = sanitizePayment(payment);
      order.lastVerifiedAt = new Date();
      await order.save();
      event.processingResult = 'authorized_recorded';
    } else {
      order.status = 'failed';
      order.providerPayment = sanitizePayment(payment);
      order.lastVerifiedAt = new Date();
      await order.save();
      event.processingResult = 'failed_recorded';
    }

    event.processingStatus = 'processed';
    event.processedAt = new Date();
    event.lockedUntil = null;
    await event.save();
    return event;
  } catch (error) {
    event.processingStatus = 'failed';
    event.lastError = error.message;
    event.lockedUntil = null;
    await event.save();
    throw error;
  }
};

const handleRazorpayWebhook = async ({ rawBody, signature, gatewayAdapter, models = {}, options = {} }) => {
  assertWebhookEnabled(options);
  const PaymentEventModel = models.PaymentEvent || PaymentEvent;
  const adapter = getGatewayAdapter(gatewayAdapter);
  if (!adapter.verifyWebhookSignature(rawBody, signature)) {
    throw createPaymentError('INVALID_WEBHOOK_SIGNATURE', 'Invalid Razorpay webhook signature', 400);
  }

  const payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
  const payment = extractRazorpayPaymentEntity(payload);
  const order = extractRazorpayOrderEntity(payload);
  const gatewayEventId = payload.id || `${payload.event}:${payment?.id || order?.id || payload.created_at}`;
  let event;
  try {
    event = await PaymentEventModel.create({
      gateway: 'razorpay',
      gatewayEventId,
      eventType: payload.event,
      gatewayOrderId: payment?.order_id || order?.id || null,
      gatewayPaymentId: payment?.id || null,
      signatureVerified: true,
      payloadHash: payloadHash(rawBody),
      sanitizedPayload: {
        event: payload.event,
        created_at: payload.created_at,
        account_id: payload.account_id,
        entity: payment ? sanitizePayment(payment) : sanitizeOrder(order || {}),
        payment: payment ? sanitizePayment(payment) : undefined,
        order: order ? sanitizeOrder(order) : undefined
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await PaymentEventModel.findOne({ gateway: 'razorpay', gatewayEventId });
      return { event: duplicate, duplicate: true };
    }
    throw error;
  }

  await processPaymentEvent({ eventId: event._id, models, gatewayAdapter: adapter, options });
  return { event, duplicate: false };
};

const reconcilePayments = async ({ gatewayAdapter, models = {}, options = {} } = {}) => {
  assertReconciliationEnabled(options);
  const PaymentOrderModel = models.PaymentOrder || PaymentOrder;
  const PaymentEventModel = models.PaymentEvent || PaymentEvent;
  const adapter = gatewayAdapter ? getGatewayAdapter(gatewayAdapter) : null;
  const orders = await PaymentOrderModel.find({
    $or: [
      { status: { $in: ['provider_create_pending', 'provider_create_unknown', 'created', 'authorized', 'captured'] } },
      { fulfillmentStatus: 'captured_unfulfilled' }
    ]
  }).limit(options.limit || 50);

  const results = [];
  for (const order of orders) {
    try {
      if (order.status === 'captured' || order.fulfillmentStatus === 'captured_unfulfilled') {
        const fulfillment = await fulfillCapturedPayment({ paymentOrderId: order._id, models, options });
        results.push({ paymentOrderId: order._id, action: 'fulfillment_retry', registrationId: fulfillment.registration?._id });
        continue;
      }

      if (['provider_create_pending', 'provider_create_unknown'].includes(order.status)) {
        if (!adapter) {
          results.push({ paymentOrderId: order._id, action: 'skipped_no_gateway_adapter' });
          continue;
        }
        try {
          await reconcileProviderCreateAttempt({ paymentOrder: order, adapter });
          results.push({ paymentOrderId: order._id, action: 'provider_order_recovered', gatewayOrderId: order.gatewayOrderId });
        } catch (error) {
          results.push({ paymentOrderId: order._id, action: 'provider_order_unresolved', error: error.message });
        }
        continue;
      }

      if (!adapter || !order.gatewayPaymentId) {
        results.push({ paymentOrderId: order._id, action: 'skipped_no_payment_id' });
        continue;
      }

      const payment = await adapter.fetchPayment(order.gatewayPaymentId);
      if (payment.status === 'captured') {
        await markPaymentCaptured({ paymentOrder: order, payment, models });
        const fulfillment = await fulfillCapturedPayment({ paymentOrderId: order._id, models, options });
        results.push({ paymentOrderId: order._id, action: 'captured_fulfilled', registrationId: fulfillment.registration?._id });
      } else {
        results.push({ paymentOrderId: order._id, action: `provider_status_${payment.status}` });
      }
    } catch (error) {
      results.push({ paymentOrderId: order._id, action: 'failed', error: error.message });
    }
  }

  const retryableEvents = await PaymentEventModel.find({
    processingStatus: { $in: ['received', 'failed'] },
    $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date() } }]
  }).sort({ createdAt: 1 }).limit(options.eventLimit || options.limit || 50);

  for (const event of retryableEvents) {
    try {
      await processPaymentEvent({ eventId: event._id, models, gatewayAdapter: adapter, options });
      results.push({ paymentEventId: event._id, action: 'event_retry_processed' });
    } catch (error) {
      results.push({ paymentEventId: event._id, action: 'event_retry_failed', error: error.message });
    }
  }

  return results;
};

module.exports = {
  createPaymentOrder,
  fulfillCapturedPayment,
  handleRazorpayWebhook,
  processPaymentEvent,
  reconcilePayments,
  sanitizeOrder,
  sanitizePayment,
  verifyRazorpayCheckout
};

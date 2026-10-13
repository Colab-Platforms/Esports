const crypto = require('crypto');
const mongoose = require('mongoose');

const PaymentNotificationIntent = require('./payment-notification-intent.model');
const PaymentReceipt = require('./payment-receipt.model');
const PaymentOrder = require('./payment-order.model');
const TournamentRegistration = require('../../models/TournamentRegistration');
const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
const emailService = require('../../services/emailService');
const paymentFeatures = require('../../config/paymentFeatures');
const { buildPaymentReceiptEmail } = require('./payment-receipt-email.template');

const RETRYABLE_STATUSES = ['pending', 'failed', 'delivery_uncertain'];
const DEFAULT_BACKOFF_SECONDS = 30;
const MAX_BACKOFF_SECONDS = 60 * 60;
const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
const SEND_TIMEOUT_SAFETY_MARGIN_SECONDS = 10;

const createNotificationError = (code, message, options = {}) => {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, options);
  return error;
};

const safeProviderError = (error) => (
  error?.message ||
  error?.error?.message ||
  error?.error?.name ||
  'Email provider operation failed'
);

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const isEmailLike = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));

const isSyntheticEmail = (email) => {
  const normalized = normalizeEmail(email);
  const domain = normalized.split('@')[1] || '';
  return (
    normalized.includes('+placeholder@') ||
    normalized.includes('noreply@') ||
    domain === 'example.com' ||
    domain === 'example.org' ||
    domain === 'example.net' ||
    domain === 'test.com' ||
    domain === 'localhost' ||
    domain.endsWith('.invalid')
  );
};

const computeBackoffDate = ({ attempts, now = new Date() }) => {
  const exponent = Math.max(0, Number(attempts || 1) - 1);
  const seconds = Math.min(MAX_BACKOFF_SECONDS, DEFAULT_BACKOFF_SECONDS * (2 ** exponent));
  return new Date(now.getTime() + seconds * 1000);
};

const receiptNotificationIdempotencyKey = (notificationIntentId) => (
  `payment-receipt-email-${notificationIntentId.toString()}`
);

const maskEmail = (email = '') => {
  const normalized = normalizeEmail(email);
  const [local = '', domain = ''] = normalized.split('@');
  if (!domain) return '';
  return `${local.slice(0, 1) || '*'}***@${domain}`;
};

const receiptNotificationEligibilityQuery = ({ now = new Date(), targetNotificationId } = {}) => {
  const query = {
    type: 'payment_receipt_email',
    $expr: { $lt: ['$attempts', '$maxAttempts'] },
    $or: [
      { status: { $in: RETRYABLE_STATUSES }, nextAttemptAt: { $lte: now } },
      { status: 'processing', lockedUntil: { $lt: now } }
    ]
  };
  if (targetNotificationId) query._id = targetNotificationId;
  return query;
};

const isReceiptNotificationEligible = ({ notificationIntent, now = new Date() }) => {
  if (!notificationIntent) return { eligible: false, reason: 'not_found' };
  if (notificationIntent.type !== 'payment_receipt_email') return { eligible: false, reason: 'wrong_type' };
  if (notificationIntent.attempts >= notificationIntent.maxAttempts) return { eligible: false, reason: 'max_attempts_exhausted' };
  if (RETRYABLE_STATUSES.includes(notificationIntent.status)) {
    if (!notificationIntent.nextAttemptAt || notificationIntent.nextAttemptAt <= now) {
      return { eligible: true, reason: 'eligible' };
    }
    return { eligible: false, reason: 'retry_not_due' };
  }
  if (notificationIntent.status === 'processing') {
    if (notificationIntent.lockedUntil && notificationIntent.lockedUntil < now) {
      return { eligible: true, reason: 'expired_processing_lease' };
    }
    return { eligible: false, reason: 'processing_lease_active' };
  }
  return { eligible: false, reason: `status_${notificationIntent.status}` };
};

const isTransientProviderError = (error = {}) => {
  const statusCode = error?.error?.statusCode || error?.statusCode;
  const name = error?.error?.name || error?.name || error?.code || '';
  if ([
    'rate_limit_exceeded',
    'internal_server_error',
    'application_error',
    'concurrent_idempotent_requests'
  ].includes(name)) return true;
  if (statusCode >= 500 || statusCode === 429) return true;
  return Boolean(error.providerOutcomeUnknown || error.timeout || ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED'].includes(error.code));
};

const isPermanentProviderError = (error = {}) => {
  const name = error?.error?.name || error?.name || error?.code || '';
  const statusCode = error?.error?.statusCode || error?.statusCode;
  if (name === 'concurrent_idempotent_requests') return false;
  if (['validation_error', 'invalid_from_address', 'invalid_parameter', 'missing_required_field', 'invalid_access'].includes(name)) {
    return true;
  }
  return statusCode >= 400 && statusCode < 500 && statusCode !== 429;
};

const effectiveSendTimeoutMs = ({ leaseSeconds, configuredTimeoutSeconds }) => {
  const safeLeaseTimeoutSeconds = Math.max(1, Number(leaseSeconds || 0) - SEND_TIMEOUT_SAFETY_MARGIN_SECONDS);
  const requested = Number(configuredTimeoutSeconds || paymentFeatures.paymentReceiptEmailSendTimeoutSeconds);
  const timeoutSeconds = Math.min(
    Number.isInteger(requested) && requested > 0 ? requested : paymentFeatures.paymentReceiptEmailSendTimeoutSeconds,
    safeLeaseTimeoutSeconds
  );
  return timeoutSeconds * 1000;
};

const assertWithinProviderIdempotencyWindow = ({ notificationIntent, now = new Date() }) => {
  if (
    notificationIntent.firstProviderSubmittedAt &&
    now.getTime() - notificationIntent.firstProviderSubmittedAt.getTime() >= RESEND_IDEMPOTENCY_WINDOW_MS
  ) {
    throw createNotificationError(
      'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
      'Provider idempotency window has expired for an uncertain receipt email delivery',
      { permanent: true }
    );
  }
};

const withSendTimeout = async ({ sendPromise, timeoutMs }) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(createNotificationError(
        'PROVIDER_SEND_TIMEOUT',
        'Email provider send timed out before the worker lease expired',
        { providerOutcomeUnknown: true, timeout: true, code: 'ETIMEDOUT' }
      ));
    }, timeoutMs);
  });

  try {
    return await Promise.race([sendPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
};

const claimNextReceiptNotification = async ({
  models = {},
  now = new Date(),
  leaseSeconds = paymentFeatures.paymentReceiptEmailLeaseSeconds,
  claimToken = crypto.randomUUID()
} = {}) => {
  const NotificationIntentModel = models.PaymentNotificationIntent || PaymentNotificationIntent;
  const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);

  const notificationIntent = await NotificationIntentModel.findOneAndUpdate(
    receiptNotificationEligibilityQuery({ now }),
    {
      $set: {
        status: 'processing',
        claimToken,
        lockedUntil: leaseUntil,
        processingStartedAt: now,
        lastAttemptAt: now,
        provider: 'resend',
        providerIdempotencyKey: ''
      },
      $inc: { attempts: 1 }
    },
    { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } }
  );

  if (!notificationIntent) return null;
  notificationIntent.providerIdempotencyKey = receiptNotificationIdempotencyKey(notificationIntent._id);
  await notificationIntent.save();
  return notificationIntent;
};

const claimReceiptNotificationById = async ({
  notificationIntentId,
  models = {},
  now = new Date(),
  leaseSeconds = paymentFeatures.paymentReceiptEmailLeaseSeconds,
  claimToken = crypto.randomUUID()
} = {}) => {
  const NotificationIntentModel = models.PaymentNotificationIntent || PaymentNotificationIntent;
  const leaseUntil = new Date(now.getTime() + leaseSeconds * 1000);

  if (!mongoose.Types.ObjectId.isValid(notificationIntentId)) {
    throw createNotificationError('INVALID_NOTIFICATION_ID', 'Target notification id must be a valid MongoDB ObjectId');
  }

  const notificationIntent = await NotificationIntentModel.findOneAndUpdate(
    receiptNotificationEligibilityQuery({
      now,
      targetNotificationId: new mongoose.Types.ObjectId(notificationIntentId)
    }),
    {
      $set: {
        status: 'processing',
        claimToken,
        lockedUntil: leaseUntil,
        processingStartedAt: now,
        lastAttemptAt: now,
        provider: 'resend',
        providerIdempotencyKey: ''
      },
      $inc: { attempts: 1 }
    },
    { new: true }
  );

  if (!notificationIntent) return null;
  notificationIntent.providerIdempotencyKey = receiptNotificationIdempotencyKey(notificationIntent._id);
  await notificationIntent.save();
  return notificationIntent;
};

const loadReceiptNotificationContext = async ({ notificationIntent, models = {} }) => {
  const ReceiptModel = models.PaymentReceipt || PaymentReceipt;
  const RegistrationModel = models.TournamentRegistration || TournamentRegistration;
  const PaymentOrderModel = models.PaymentOrder || PaymentOrder;
  const TournamentModel = models.Tournament || Tournament;
  const UserModel = models.User || User;

  const receipt = await ReceiptModel.findById(notificationIntent.receiptId);
  if (!receipt) throw createNotificationError('RECEIPT_NOT_FOUND', 'Payment receipt not found', { permanent: true });

  const [registration, paymentOrder, tournament, captain] = await Promise.all([
    RegistrationModel.findById(receipt.tournamentRegistrationId),
    PaymentOrderModel.findById(receipt.paymentOrderId),
    TournamentModel.findById(receipt.tournamentId).select('name gameType'),
    UserModel.findById(receipt.captainUserId).select('email isEmailVerified isActive fullName username')
  ]);

  if (!registration) throw createNotificationError('REGISTRATION_NOT_FOUND', 'Paid registration not found', { permanent: true });
  if (!paymentOrder) throw createNotificationError('PAYMENT_ORDER_NOT_FOUND', 'Payment order not found', { permanent: true });
  if (!captain) throw createNotificationError('CAPTAIN_NOT_FOUND', 'Captain user not found', { permanent: true });

  if (paymentOrder.status !== 'captured' || paymentOrder.fulfillmentStatus !== 'fulfilled') {
    throw createNotificationError('PAYMENT_NOT_FULFILLED', 'Receipt email requires a captured and fulfilled payment', { permanent: true });
  }
  if (registration.payment?.status !== 'paid') {
    throw createNotificationError('REGISTRATION_NOT_PAID', 'Receipt email requires a paid registration', { permanent: true });
  }
  if (registration.payment?.paymentOrderId?.toString() !== paymentOrder._id.toString()) {
    throw createNotificationError('REGISTRATION_PAYMENT_MISMATCH', 'Registration payment order does not match receipt', { permanent: true });
  }
  if (receipt.gatewayPaymentId !== paymentOrder.gatewayPaymentId) {
    throw createNotificationError('RECEIPT_PAYMENT_MISMATCH', 'Receipt payment reference does not match payment order', { permanent: true });
  }

  return { receipt, registration, paymentOrder, tournament, captain };
};

const assertRecipientCanReceiveReceipt = ({ notificationIntent, captain }) => {
  const recipientEmail = normalizeEmail(notificationIntent.recipientEmail);
  const captainEmail = normalizeEmail(captain.email);
  if (!isEmailLike(recipientEmail) || isSyntheticEmail(recipientEmail)) {
    throw createNotificationError('RECIPIENT_EMAIL_INVALID', 'Receipt recipient email is invalid or synthetic', { permanent: true });
  }
  if (!captain.isActive) {
    throw createNotificationError('RECIPIENT_USER_INACTIVE', 'Receipt recipient account is inactive', { permanent: true });
  }
  if (!captain.isEmailVerified) {
    throw createNotificationError('RECIPIENT_EMAIL_UNVERIFIED', 'Receipt recipient email is not verified', { permanent: true });
  }
  if (recipientEmail !== captainEmail) {
    throw createNotificationError('RECIPIENT_EMAIL_MISMATCH', 'Receipt recipient email no longer matches captain account', { permanent: true });
  }
};

const createResendReceiptEmailSender = ({ resendClient = emailService.getResendClient(), fromEmail = emailService.getConfiguredFromAddress() } = {}) => {
  if (!resendClient) {
    throw createNotificationError('RESEND_NOT_CONFIGURED', 'Resend client is not configured', { permanent: true });
  }
  if (!fromEmail || !isEmailLike(fromEmail)) {
    throw createNotificationError('RESEND_FROM_EMAIL_NOT_CONFIGURED', 'A verified Resend sender email is required', { permanent: true });
  }

  return {
    from: `Colab Esports <${fromEmail}>`,
    async send({ payload, idempotencyKey }) {
      return resendClient.emails.send(
        payload,
        { idempotencyKey }
      );
    }
  };
};

const markNotificationForRetry = async ({ notificationIntent, error, now = new Date(), status = 'failed' }) => {
  const nextAttemptAt = computeBackoffDate({ attempts: notificationIntent.attempts, now });
  const nextStatus = notificationIntent.attempts >= notificationIntent.maxAttempts ? 'needs_attention' : status;
  notificationIntent.status = nextStatus;
  notificationIntent.lockedUntil = null;
  notificationIntent.claimToken = '';
  notificationIntent.lastError = safeProviderError(error);
  notificationIntent.nextAttemptAt = nextStatus === 'needs_attention' ? null : nextAttemptAt;
  notificationIntent.providerResponse = {
    ...(notificationIntent.providerResponse || {}),
    errorName: error?.error?.name || error?.name || error?.code || '',
    errorMessage: safeProviderError(error)
  };
  await notificationIntent.save();
  return notificationIntent;
};

const markNotificationNeedsAttention = async ({ notificationIntent, error }) => {
  notificationIntent.status = 'needs_attention';
  notificationIntent.lockedUntil = null;
  notificationIntent.claimToken = '';
  notificationIntent.nextAttemptAt = null;
  notificationIntent.lastError = safeProviderError(error);
  notificationIntent.providerResponse = {
    ...(notificationIntent.providerResponse || {}),
    errorName: error?.code || error?.name || error?.error?.name || '',
    errorMessage: safeProviderError(error)
  };
  await notificationIntent.save();
  return notificationIntent;
};

const processClaimedReceiptNotification = async ({
  notificationIntent,
  claimToken,
  sender,
  models = {},
  now = new Date(),
  options = {}
}) => {
  const NotificationIntentModel = models.PaymentNotificationIntent || PaymentNotificationIntent;
  const leaseSeconds = options.leaseSeconds || paymentFeatures.paymentReceiptEmailLeaseSeconds;
  const sendTimeoutMs = effectiveSendTimeoutMs({
    leaseSeconds,
    configuredTimeoutSeconds: options.sendTimeoutSeconds
  });
  const current = await NotificationIntentModel.findOne({
    _id: notificationIntent._id,
    status: 'processing',
    claimToken
  });
  if (!current) return { action: 'claim_lost' };

  let context;
  try {
    assertWithinProviderIdempotencyWindow({ notificationIntent: current, now });
    context = await loadReceiptNotificationContext({ notificationIntent: current, models });
    assertRecipientCanReceiveReceipt({ notificationIntent: current, captain: context.captain });
  } catch (error) {
    await markNotificationNeedsAttention({ notificationIntent: current, error });
    return { action: 'needs_attention', code: error.code };
  }

  const captainName = context.captain.fullName || context.captain.username || 'Captain';
  const email = buildPaymentReceiptEmail({
    receipt: context.receipt,
    registration: context.registration,
    tournament: context.tournament,
    captainName
  });
  const providerPayload = current.providerRequestSnapshot?.subject
    ? current.providerRequestSnapshot
    : {
      from: sender.from || '',
      to: current.recipientEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [
        { name: 'type', value: 'payment_receipt' }
      ]
    };

  let ownedForSend = current;
  try {
    const claimBeforeSend = await NotificationIntentModel.findOneAndUpdate(
      {
        _id: current._id,
        status: 'processing',
        claimToken,
        lockedUntil: { $gt: now }
      },
      {
        $set: {
          firstProviderSubmittedAt: current.firstProviderSubmittedAt || now,
          providerRequestSnapshot: providerPayload
        }
      },
      { new: true }
    );

    if (!claimBeforeSend) return { action: 'claim_lost_before_send' };
    ownedForSend = claimBeforeSend;

    const response = await withSendTimeout({
      sendPromise: sender.send({
        payload: claimBeforeSend.providerRequestSnapshot,
        idempotencyKey: claimBeforeSend.providerIdempotencyKey || receiptNotificationIdempotencyKey(claimBeforeSend._id)
      }),
      timeoutMs: sendTimeoutMs
    });

    if (response?.error) {
      const providerError = response.error;
      if (isPermanentProviderError(providerError)) {
        await markNotificationNeedsAttention({ notificationIntent: claimBeforeSend, error: providerError });
        return { action: 'needs_attention', code: providerError.name };
      }
      const updated = await markNotificationForRetry({
        notificationIntent: claimBeforeSend,
        error: providerError,
        now,
        status: providerError.name === 'concurrent_idempotent_requests' ? 'delivery_uncertain' : 'failed'
      });
      return {
        action: updated.status === 'needs_attention'
          ? 'needs_attention'
          : (providerError.name === 'concurrent_idempotent_requests' ? 'delivery_uncertain' : 'retry_scheduled'),
        code: providerError.name
      };
    }

    const providerMessageId = response?.data?.id;
    if (!providerMessageId) {
      const unknown = createNotificationError('PROVIDER_ACCEPTANCE_UNKNOWN', 'Email provider response did not include a message id', { providerOutcomeUnknown: true });
      const updated = await markNotificationForRetry({ notificationIntent: claimBeforeSend, error: unknown, now, status: 'delivery_uncertain' });
      return { action: updated.status === 'needs_attention' ? 'needs_attention' : 'delivery_uncertain', code: unknown.code };
    }

    if (options.failAfterProviderAccept) {
      const uncertain = createNotificationError('SIMULATED_DB_FAILURE_AFTER_PROVIDER_ACCEPT', 'Provider accepted email but local persistence failed', { providerOutcomeUnknown: true });
      uncertain.providerMessageId = providerMessageId;
      throw uncertain;
    }

    const sentUpdate = await NotificationIntentModel.updateOne(
      {
        _id: claimBeforeSend._id,
        status: 'processing',
        claimToken
      },
      {
        $set: {
          status: 'sent',
          providerMessageId,
          providerResponse: {
            id: providerMessageId,
            status: 'accepted'
          },
          sentAt: now,
          lockedUntil: null,
          claimToken: '',
          nextAttemptAt: null,
          lastError: ''
        }
      }
    );
    if (sentUpdate.modifiedCount !== 1) {
      return { action: 'claim_lost_after_provider_accept', providerMessageId };
    }
    return { action: 'sent', providerMessageId };
  } catch (error) {
    if (error.providerOutcomeUnknown || !isPermanentProviderError(error)) {
      if (error.providerMessageId) {
        ownedForSend.providerMessageId = error.providerMessageId;
      }
      const updated = await markNotificationForRetry({ notificationIntent: ownedForSend, error, now, status: 'delivery_uncertain' });
      return { action: updated.status === 'needs_attention' ? 'needs_attention' : 'delivery_uncertain', code: error.code };
    }
    await markNotificationNeedsAttention({ notificationIntent: ownedForSend, error });
    return { action: 'needs_attention', code: error.code };
  }
};

const processReceiptNotificationBatch = async ({
  sender,
  models = {},
  options = {}
} = {}) => {
  if (!options.ignoreFeatureFlag && !paymentFeatures.paymentReceiptEmailDeliveryEnabled) {
    return [{ action: 'skipped_disabled' }];
  }

  const batchSize = options.batchSize || paymentFeatures.paymentReceiptEmailBatchSize;
  const leaseSeconds = options.leaseSeconds || paymentFeatures.paymentReceiptEmailLeaseSeconds;
  const resolvedSender = sender || createResendReceiptEmailSender();
  const results = [];

  for (let index = 0; index < batchSize; index += 1) {
    const claimToken = crypto.randomUUID();
    const notificationIntent = await claimNextReceiptNotification({
      models,
      now: options.now || new Date(),
      leaseSeconds,
      claimToken
    });
    if (!notificationIntent) break;
    const result = await processClaimedReceiptNotification({
      notificationIntent,
      claimToken,
      sender: resolvedSender,
      models,
      now: options.now || new Date(),
      options
    });
    results.push({ notificationIntentId: notificationIntent._id, ...result });
  }

  return results;
};

const processTargetedReceiptNotification = async ({
  notificationIntentId,
  sender,
  models = {},
  options = {}
} = {}) => {
  if (!options.ignoreFeatureFlag && !paymentFeatures.paymentReceiptEmailDeliveryEnabled) {
    return [{ notificationIntentId, action: 'skipped_disabled' }];
  }
  if (!mongoose.Types.ObjectId.isValid(notificationIntentId)) {
    return [{ notificationIntentId, action: 'target_invalid', code: 'INVALID_NOTIFICATION_ID' }];
  }

  const now = options.now || new Date();
  const leaseSeconds = options.leaseSeconds || paymentFeatures.paymentReceiptEmailLeaseSeconds;
  const claimToken = crypto.randomUUID();
  const notificationIntent = await claimReceiptNotificationById({
    notificationIntentId,
    models,
    now,
    leaseSeconds,
    claimToken
  });

  if (!notificationIntent) {
    return [{ notificationIntentId, action: 'target_not_eligible' }];
  }

  const resolvedSender = sender || createResendReceiptEmailSender();
  const result = await processClaimedReceiptNotification({
    notificationIntent,
    claimToken,
    sender: resolvedSender,
    models,
    now,
    options
  });

  return [{ notificationIntentId: notificationIntent._id, ...result }];
};

const preflightReceiptNotification = async ({
  notificationIntentId,
  models = {},
  now = new Date()
} = {}) => {
  const NotificationIntentModel = models.PaymentNotificationIntent || PaymentNotificationIntent;
  const ReceiptModel = models.PaymentReceipt || PaymentReceipt;

  if (!mongoose.Types.ObjectId.isValid(notificationIntentId)) {
    return {
      notificationIntentId,
      exists: false,
      eligible: false,
      reason: 'invalid_object_id'
    };
  }

  const notificationIntent = await NotificationIntentModel.findById(notificationIntentId);
  if (!notificationIntent) {
    return {
      notificationIntentId,
      exists: false,
      eligible: false,
      reason: 'not_found'
    };
  }

  const receipt = await ReceiptModel.findById(notificationIntent.receiptId).select('receiptNumber');
  const eligibility = isReceiptNotificationEligible({ notificationIntent, now });
  const idempotencyWindowSafe = !notificationIntent.firstProviderSubmittedAt ||
    now.getTime() - notificationIntent.firstProviderSubmittedAt.getTime() < RESEND_IDEMPOTENCY_WINDOW_MS;

  return {
    notificationIntentId: notificationIntent._id.toString(),
    exists: true,
    eligible: eligibility.eligible,
    reason: eligibility.reason,
    status: notificationIntent.status,
    receiptNumber: receipt?.receiptNumber || '',
    recipientEmailMasked: maskEmail(notificationIntent.recipientEmail),
    attempts: notificationIntent.attempts,
    maxAttempts: notificationIntent.maxAttempts,
    nextAttemptAt: notificationIntent.nextAttemptAt,
    lockedUntil: notificationIntent.lockedUntil,
    idempotencyWindowSafe
  };
};

module.exports = {
  claimReceiptNotificationById,
  claimNextReceiptNotification,
  createResendReceiptEmailSender,
  isSyntheticEmail,
  preflightReceiptNotification,
  processClaimedReceiptNotification,
  processReceiptNotificationBatch,
  processTargetedReceiptNotification,
  receiptNotificationIdempotencyKey
};

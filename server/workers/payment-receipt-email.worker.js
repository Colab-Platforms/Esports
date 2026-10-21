const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const paymentFeatures = require('../config/paymentFeatures');
const receiptEmailService = require('../features/payments/payment-receipt-email.service');

const {
  preflightReceiptNotification,
  processReceiptNotificationBatch,
  processTargetedReceiptNotification
} = receiptEmailService;

const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const isProductionEnvironment = () => (
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER_ENV === 'production'
);

const getExpectedDbName = () => String(process.env.PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME || '').trim();

const assertExpectedDatabase = () => {
  const expectedDbName = getExpectedDbName();
  if (!expectedDbName) {
    throw new Error('PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME is required for receipt email worker delivery');
  }
  if (mongoose.connection.name !== expectedDbName) {
    throw new Error(`Payment receipt email worker connected to unexpected database "${mongoose.connection.name}"`);
  }
};

const runOnce = async ({ services = {} } = {}) => {
  const {
    preflightReceiptNotification: preflight = preflightReceiptNotification,
    processReceiptNotificationBatch: processBatch = processReceiptNotificationBatch,
    processTargetedReceiptNotification: processTargeted = processTargetedReceiptNotification
  } = services;
  const targetNotificationId = String(process.env.PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID || '').trim();
  const preflightOnly = truthy(process.env.PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY);
  const isReadOnlyTargetedPreflight = Boolean(targetNotificationId && preflightOnly);

  if (!paymentFeatures.paymentReceiptEmailWorkerEnabled) {
    console.log('Payment receipt email worker is disabled. Set PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED=true to run it.');
    return;
  }

  if (targetNotificationId && isProductionEnvironment()) {
    throw new Error('Targeted receipt email worker mode is disabled in production environments.');
  }

  if (preflightOnly && !targetNotificationId) {
    throw new Error('PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY requires a target notification id; batch delivery was not started.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for the payment receipt email worker');
  }

  const wasAlreadyConnected = mongoose.connection.readyState === 1;
  if (!wasAlreadyConnected) {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }

  try {
    if (!isReadOnlyTargetedPreflight) {
      assertExpectedDatabase();
    }

    if (targetNotificationId && preflightOnly) {
      const result = await preflight({ notificationIntentId: targetNotificationId });
      console.log('Payment receipt email worker preflight:', result);
      return;
    }

    const results = targetNotificationId
      ? await processTargeted({ notificationIntentId: targetNotificationId })
      : await processBatch();
    console.log('Payment receipt email worker processed batch:', results.map((result) => ({
      notificationIntentId: result.notificationIntentId?.toString(),
      action: result.action,
      code: result.code
    })));
  } finally {
    if (!wasAlreadyConnected) {
      await mongoose.disconnect();
    }
  }
};

if (require.main === module) {
  runOnce().catch((error) => {
    console.error('Payment receipt email worker failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { assertExpectedDatabase, runOnce };

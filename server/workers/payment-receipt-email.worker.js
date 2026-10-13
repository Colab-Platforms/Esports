const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const paymentFeatures = require('../config/paymentFeatures');
const {
  preflightReceiptNotification,
  processReceiptNotificationBatch,
  processTargetedReceiptNotification
} = require('../features/payments/payment-receipt-email.service');

const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const isProductionEnvironment = () => (
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL_ENV === 'production' ||
  process.env.RENDER_ENV === 'production'
);

const runOnce = async () => {
  const targetNotificationId = String(process.env.PAYMENT_RECEIPT_EMAIL_TARGET_NOTIFICATION_ID || '').trim();
  const preflightOnly = truthy(process.env.PAYMENT_RECEIPT_EMAIL_PREFLIGHT_ONLY);

  if (!paymentFeatures.paymentReceiptEmailWorkerEnabled) {
    console.log('Payment receipt email worker is disabled. Set PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED=true to run it.');
    return;
  }

  if (targetNotificationId && isProductionEnvironment()) {
    throw new Error('Targeted receipt email worker mode is disabled in production environments.');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for the payment receipt email worker');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  try {
    if (targetNotificationId && preflightOnly) {
      const result = await preflightReceiptNotification({ notificationIntentId: targetNotificationId });
      console.log('Payment receipt email worker preflight:', result);
      return;
    }

    const results = targetNotificationId
      ? await processTargetedReceiptNotification({ notificationIntentId: targetNotificationId })
      : await processReceiptNotificationBatch();
    console.log('Payment receipt email worker processed batch:', results.map((result) => ({
      notificationIntentId: result.notificationIntentId?.toString(),
      action: result.action,
      code: result.code
    })));
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  runOnce().catch((error) => {
    console.error('Payment receipt email worker failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { runOnce };

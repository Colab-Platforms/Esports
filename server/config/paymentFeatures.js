const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const positiveIntegerOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const positiveIntegerOrDefault = (value, defaultValue) => (
  positiveIntegerOrNull(value) || defaultValue
);

const paymentFeatures = {
  valorantPaidCheckoutCreateEnabled: truthy(process.env.VALORANT_PAID_CHECKOUT_CREATE_ENABLED),
  valorantPaymentOrderCreateEnabled: truthy(process.env.VALORANT_PAYMENT_ORDER_CREATE_ENABLED),
  valorantPaymentVerifyEnabled: truthy(process.env.VALORANT_PAYMENT_VERIFY_ENABLED),
  razorpayWebhookProcessingEnabled: truthy(process.env.RAZORPAY_WEBHOOK_PROCESSING_ENABLED),
  paymentReconciliationEnabled: truthy(process.env.PAYMENT_RECONCILIATION_ENABLED),
  paymentRefundsEnabled: truthy(process.env.PAYMENT_REFUNDS_ENABLED),
  paymentReceiptEmailDeliveryEnabled: truthy(process.env.PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED),
  paymentReceiptEmailWorkerEnabled: truthy(process.env.PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED),
  paymentReceiptEmailMaxAttempts: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_MAX_ATTEMPTS, 5),
  paymentReceiptEmailLeaseSeconds: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_LEASE_SECONDS, 120),
  paymentReceiptEmailSendTimeoutSeconds: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_SEND_TIMEOUT_SECONDS, 30),
  paymentReceiptEmailBatchSize: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_BATCH_SIZE, 10),
  paymentReceiptEmailInProcessEnabled: truthy(process.env.PAYMENT_RECEIPT_EMAIL_IN_PROCESS_ENABLED),
  paymentReceiptEmailInProcessPollSeconds: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_IN_PROCESS_POLL_SECONDS, 60),
  paymentReceiptEmailInProcessBatchSize: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_IN_PROCESS_BATCH_SIZE, 1),
  paymentGateway: process.env.PAYMENT_GATEWAY || 'razorpay',
  registrationIntentTtlMinutes: positiveIntegerOrNull(process.env.REGISTRATION_INTENT_TTL_MINUTES)
};

module.exports = paymentFeatures;

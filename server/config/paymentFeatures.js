// Every paid entry point fails closed until explicitly enabled. No automatic
// live-key fallback and no payment workers are started by importing this module.
const truthy = value => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
const positiveIntegerOrDefault = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};
module.exports = {
  enabled: () => process.env.VALORANT_PAYMENTS_ENABLED === 'true',
  checkoutPaused: () => process.env.VALORANT_CHECKOUT_PAUSED === 'true',
  mode: () => process.env.RAZORPAY_MODE || 'test',
  paymentReceiptEmailDeliveryEnabled: truthy(process.env.PAYMENT_RECEIPT_EMAIL_DELIVERY_ENABLED),
  paymentReceiptEmailWorkerEnabled: truthy(process.env.PAYMENT_RECEIPT_EMAIL_WORKER_ENABLED),
  paymentReceiptEmailMaxAttempts: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_MAX_ATTEMPTS, 5),
  paymentReceiptEmailLeaseSeconds: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_LEASE_SECONDS, 120),
  paymentReceiptEmailSendTimeoutSeconds: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_SEND_TIMEOUT_SECONDS, 30),
  paymentReceiptEmailBatchSize: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_BATCH_SIZE, 10),
  paymentReceiptEmailInProcessEnabled: truthy(process.env.PAYMENT_RECEIPT_EMAIL_IN_PROCESS_ENABLED),
  paymentReceiptEmailInProcessPollSeconds: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_IN_PROCESS_POLL_SECONDS, 60),
  paymentReceiptEmailInProcessBatchSize: positiveIntegerOrDefault(process.env.PAYMENT_RECEIPT_EMAIL_IN_PROCESS_BATCH_SIZE, 1),
  reservationMs: 10 * 60 * 1000
};

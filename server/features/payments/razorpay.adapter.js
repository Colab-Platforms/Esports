const crypto = require('crypto');
const Razorpay = require('razorpay');

const createPaymentError = (code, message, status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const providerErrorMessage = (error, fallback) => (
  error?.error?.description ||
  error?.description ||
  error?.message ||
  fallback
);

const providerErrorStatus = (error, fallback = 502) => (
  Number.isInteger(error?.status) ? error.status :
    (Number.isInteger(error?.statusCode) ? error.statusCode : fallback)
);

const isUnknownProviderOutcome = (error = {}) => (
  error.providerOutcomeUnknown === true ||
  error.code === 'ETIMEDOUT' ||
  error.code === 'ECONNRESET' ||
  error.code === 'ECONNABORTED' ||
  error.code === 'ESOCKETTIMEDOUT' ||
  error.timeout === true
);

const wrapProviderError = (error, code, fallbackMessage, fallbackStatus = 502) => {
  if (error instanceof Error && error.code && error.status) return error;

  const wrapped = createPaymentError(
    code,
    providerErrorMessage(error, fallbackMessage),
    providerErrorStatus(error, fallbackStatus)
  );
  wrapped.providerOutcomeUnknown = isUnknownProviderOutcome(error);
  wrapped.providerCode = error?.error?.code || error?.code;
  return wrapped;
};

const timingSafeEqualHex = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const hmacHex = (secret, body) => crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('hex');

class RazorpayAdapter {
  constructor({ keyId, keySecret, webhookSecret, client } = {}) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID;
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
    this.client = client || null;

    if (!this.keyId || !this.keySecret) {
      throw createPaymentError('RAZORPAY_NOT_CONFIGURED', 'Razorpay credentials are not configured', 503);
    }
    const mode = require('../../config/paymentFeatures').mode();
    if (!['test', 'live'].includes(mode) || !this.keyId.startsWith(`rzp_${mode}_`)) {
      throw createPaymentError('RAZORPAY_MODE_MISMATCH', 'Razorpay key does not match the explicitly selected mode', 503);
    }

    if (!this.client) {
      this.client = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret
      });
      // The locked SDK exposes its dedicated Axios instance here. Bound provider
      // outages and prevent redirects/proxy inheritance on credentialed requests.
      if (!this.client.api?.rq?.defaults) throw createPaymentError('RAZORPAY_TRANSPORT_UNSUPPORTED', 'Razorpay transport requires review', 503);
      Object.assign(this.client.api.rq.defaults, { timeout: 10000, maxRedirects: 0, proxy: false });
    }
  }

  getPublicConfig() {
    return { keyId: this.keyId };
  }

  async createOrder({ amountMinor, currency, receipt, notes }) {
    try {
      return await this.client.orders.create({
        amount: amountMinor,
        currency,
        receipt,
        notes
      });
    } catch (error) {
      throw wrapProviderError(
        error,
        'RAZORPAY_ORDER_CREATE_FAILED',
        'Razorpay order creation failed',
        502
      );
    }
  }

  async fetchOrder(orderId) {
    return this.client.orders.fetch(orderId);
  }

  async findOrdersByReceipt(receipt) {
    if (!this.client.orders?.all) return null;
    return this.client.orders.all({ receipt, count: 10 });
  }

  async fetchOrderPayments(orderId) {
    if (!this.client.orders?.fetchPayments) return null;
    return this.client.orders.fetchPayments(orderId);
  }

  async fetchPayment(paymentId) {
    return this.client.payments.fetch(paymentId);
  }

  async fetchRefund(refundId) {
    if (!this.client.refunds?.fetch) {
      throw createPaymentError('RAZORPAY_REFUND_FETCH_UNAVAILABLE', 'Razorpay refund fetch is unavailable', 503);
    }
    return this.client.refunds.fetch(refundId);
  }

  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    if (!/^[a-f0-9]{64}$/i.test(String(signature))) return false;
    const expected = hmacHex(this.keySecret, `${orderId}|${paymentId}`);
    return timingSafeEqualHex(expected, signature);
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!/^[a-f0-9]{64}$/i.test(String(signature))) return false;
    if (!this.webhookSecret) {
      throw createPaymentError('RAZORPAY_WEBHOOK_SECRET_MISSING', 'Razorpay webhook secret is not configured', 503);
    }
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
    const expected = hmacHex(this.webhookSecret, body);
    return timingSafeEqualHex(expected, signature);
  }
}

module.exports = {
  RazorpayAdapter,
  createPaymentError,
  wrapProviderError
};

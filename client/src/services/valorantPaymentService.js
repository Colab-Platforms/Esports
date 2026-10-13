import api from './api';

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

const makeIdempotencyKey = (prefix) => {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const amountMinorFromTournament = (tournament = {}) => {
  if (tournament.entryFee === undefined || tournament.entryFee === null || tournament.entryFee === '') {
    return Number.isInteger(tournament.entryFeeAmountMinor) && tournament.entryFeeAmountMinor >= 0
      ? tournament.entryFeeAmountMinor
      : 0;
  }

  const rupees = Number(tournament.entryFee);
  if (!Number.isFinite(rupees) || rupees < 0 || !Number.isInteger(rupees)) {
    return null;
  }

  if (Number.isInteger(tournament.entryFeeAmountMinor) && tournament.entryFeeAmountMinor > 0) {
    return tournament.entryFeeAmountMinor;
  }

  return rupees * 100;
};

const formatInrMinor = (amountMinor = 0) => {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) return 'Fee unavailable';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2
  }).format(amountMinor / 100);
};

const getTournamentFeeInfo = (tournament = {}) => {
  const amountMinor = amountMinorFromTournament(tournament);
  const isInvalid = amountMinor === null;
  const requiresPayment = Number.isInteger(amountMinor) && amountMinor > 0;

  return {
    amountMinor,
    isFree: amountMinor === 0,
    isInvalid,
    requiresPayment,
    label: isInvalid
      ? 'Fee unavailable'
      : (requiresPayment ? `${formatInrMinor(amountMinor)} per team` : 'Free registration'),
    shortLabel: isInvalid
      ? 'Fee unavailable'
      : (requiresPayment ? formatInrMinor(amountMinor) : 'Free'),
    helperText: isInvalid
      ? 'Registration fee is not configured correctly.'
      : (requiresPayment ? 'Payment required to register this team.' : 'No payment required.')
  };
};

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve(window.Razorpay);
    return;
  }

  const existing = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
  if (existing) {
    existing.addEventListener('load', () => resolve(window.Razorpay), { once: true });
    existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay Checkout')), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = RAZORPAY_CHECKOUT_SRC;
  script.async = true;
  script.onload = () => {
    if (window.Razorpay) resolve(window.Razorpay);
    else reject(new Error('Razorpay Checkout loaded without an SDK object'));
  };
  script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'));
  document.body.appendChild(script);
});

const createRegistrationIntent = ({ tournamentId, teamId }) => (
  api.post('/api/registration-intents', {
    gameType: 'valorant',
    tournamentId,
    teamId,
    idempotencyKey: makeIdempotencyKey('valorant-intent')
  })
);

const createPaymentOrder = ({ intentId }) => (
  api.post(`/api/registration-intents/${intentId}/payment-order`, {
    gateway: 'razorpay',
    idempotencyKey: makeIdempotencyKey('valorant-order')
  })
);

const verifyRazorpayPayment = ({ paymentOrderId, razorpayResponse }) => (
  api.post('/api/payments/razorpay/verify', {
    paymentOrderId,
    razorpay_order_id: razorpayResponse.razorpay_order_id,
    razorpay_payment_id: razorpayResponse.razorpay_payment_id,
    razorpay_signature: razorpayResponse.razorpay_signature
  })
);

const getRegistrationIntentStatus = (intentId) => (
  api.get(`/api/registration-intents/${intentId}`)
);

const getActiveRegistrationAttempt = ({ tournamentId, teamId }) => (
  api.get('/api/registration-intents/active', {
    params: {
      gameType: 'valorant',
      tournamentId,
      teamId
    }
  })
);

const openRazorpayCheckout = ({ order, tournament, user, onSuccess, onDismiss, onFailure }) => {
  const checkout = new window.Razorpay({
    key: order.keyId,
    amount: order.amountMinor,
    currency: order.currency,
    name: 'Colab Esports',
    description: tournament?.name || 'Valorant Tournament Registration',
    order_id: order.razorpayOrderId,
    prefill: {
      name: user?.fullName || user?.username || '',
      email: user?.email || '',
      contact: user?.phone || ''
    },
    theme: { color: '#FFD700' },
    handler: onSuccess,
    modal: {
      ondismiss: onDismiss
    }
  });

  checkout.on('payment.failed', onFailure);
  checkout.open();
};

const valorantPaymentService = {
  amountMinorFromTournament,
  createPaymentOrder,
  createRegistrationIntent,
  formatInrMinor,
  getTournamentFeeInfo,
  getActiveRegistrationAttempt,
  getRegistrationIntentStatus,
  loadRazorpayCheckout,
  openRazorpayCheckout,
  verifyRazorpayPayment
};

export default valorantPaymentService;

import api from './api';

const checkoutSrc = 'https://checkout.razorpay.com/v1/checkout.js';
const dataOf = response => response.data?.data || response.data || response;
let loading;
export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = checkoutSrc; script.async = true;
    script.onload = () => window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Checkout unavailable'));
    script.onerror = () => { script.remove(); reject(new Error('Unable to load payment checkout')); };
    document.body.appendChild(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}
const requestKey = () => `valorant-${window.crypto.randomUUID ? window.crypto.randomUUID() : Array.from(window.crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('')}`;

export async function registerPaidTeam({ tournament, team, user }) {
  // Resume the server-owned attempt after reload/dismissal. Never start another
  // order because a browser callback failed or a response was lost.
  let { intent } = dataOf(await api.get(`/api/valorant-payments/active?tournamentId=${encodeURIComponent(tournament._id)}&teamId=${encodeURIComponent(team._id)}`));
  if (intent?.fulfilledRegistrationId) return { registrationId: intent.fulfilledRegistrationId };
  if (intent?.status === 'capture_late_review') throw new Error('Payment received after expiry. An administrator must review the payment; do not pay again.');
  const expiresAt = intent?.reservation?.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    const recovery = dataOf(await api.post(`/api/valorant-payments/intents/${intent._id}/recover`, {}));
    if (recovery?.registrationId) return { registrationId: recovery.registrationId };
    if (recovery?.reviewRequired) throw new Error('Payment received after expiry. An administrator must review the payment; do not pay again.');
    if (!recovery?.canCreateNewIntent) throw new Error('Your previous payment is being checked. Refresh registration status before retrying; do not pay again.');
    intent = null;
  }
  if (!intent) intent = dataOf(await api.post('/api/valorant-payments/intents', {
    tournamentId: tournament._id, teamId: team._id, idempotencyKey: requestKey()
  }));
  const intentId = intent._id;
  if (!intentId) throw new Error('Reservation could not be confirmed');
  const order = dataOf(await api.post(`/api/valorant-payments/intents/${intentId}/order`, { idempotencyKey: requestKey() }));
  const Razorpay = await loadCheckout();
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, value) => { if (finished) return; finished = true; error ? reject(error) : resolve(value); };
    const checkout = new Razorpay({ key: order.keyId, order_id: order.razorpayOrderId, amount: order.amountMinor, currency: order.currency,
      name: 'Colab Esports', description: `${tournament.name} — team registration`,
      prefill: { name: user?.fullName || user?.username || '', email: user?.email || '', contact: user?.phone || '' },
      handler: async response => {
        try {
          const result = dataOf(await api.post('/api/valorant-payments/verify', { paymentOrderId: order.paymentOrderId, ...response }));
          if (!result.registrationId) throw new Error(result.reviewRequired ? 'Payment received after expiry; manual refund review is required.' : 'Payment is not captured yet. Check registration status before retrying.');
          finish(null, result);
        } catch (error) { finish(error); }
      },
      modal: { ondismiss: () => finish(new Error('Checkout closed. Payment may still be processing; check registration status before retrying.')) }
    });
    checkout.on('payment.failed', () => finish(new Error('Payment attempt failed. Your existing reservation will be checked before retrying.')));
    checkout.open();
  });
}

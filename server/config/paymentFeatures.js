// Every paid entry point fails closed until explicitly enabled. No automatic
// live-key fallback and no payment workers are started by importing this module.
module.exports = {
  enabled: () => process.env.VALORANT_PAYMENTS_ENABLED === 'true',
  checkoutPaused: () => process.env.VALORANT_CHECKOUT_PAUSED === 'true',
  mode: () => process.env.RAZORPAY_MODE || 'test',
  reservationMs: 10 * 60 * 1000
};

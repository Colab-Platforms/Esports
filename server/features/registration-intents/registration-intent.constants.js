const CAPACITY_HOLDING_INTENT_STATUSES = [
  'reserved',
  'payment_order_created',
  'payment_authorized',
  'payment_captured',
  'fulfilling',
  'capture_late_review'
];

const TERMINAL_INTENT_STATUSES = [
  'fulfilled',
  'expired_unpaid',
  'cancelled',
  'failed',
  'refund_pending',
  'refunded'
];

module.exports = {
  CAPACITY_HOLDING_INTENT_STATUSES,
  TERMINAL_INTENT_STATUSES
};

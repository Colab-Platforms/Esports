const mongoose = require('mongoose');

const { Schema } = mongoose;

const sanitizedProviderRefundSchema = new Schema({
  id: String,
  entity: String,
  amount: Number,
  currency: String,
  payment_id: String,
  status: String,
  speed_processed: String,
  speed_requested: String,
  created_at: Number
}, { _id: false, strict: false });

const refundSchema = new Schema({
  paymentOrderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder', required: true },
  registrationId: { type: Schema.Types.ObjectId, ref: 'TournamentRegistration', default: null },
  intentId: { type: Schema.Types.ObjectId, ref: 'RegistrationIntent', default: null },

  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  requestedByRole: { type: String, required: true, trim: true },
  reasonCode: {
    type: String,
    enum: ['admin_rejection', 'tournament_cancelled', 'late_payment', 'manual_review', 'other'],
    required: true
  },
  reasonText: { type: String, default: '', trim: true },

  gateway: { type: String, enum: ['razorpay'], required: true },
  gatewayRefundId: { type: String, default: null },
  amountMinor: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Refund amount must be an integer number of paise'
    }
  },
  currency: { type: String, enum: ['INR'], required: true },

  status: {
    type: String,
    enum: [
      'requested',
      'provider_request_pending',
      'provider_request_unknown',
      'provider_pending',
      'processed',
      'failed',
      'cancelled'
    ],
    default: 'requested'
  },
  isLiveRefund: { type: Boolean, default: true, required: true },
  providerResponse: sanitizedProviderRefundSchema,
  lastCheckedAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
  idempotencyKey: { type: String, required: true, trim: true }
}, { timestamps: true });

refundSchema.index({ paymentOrderId: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: 1 });
refundSchema.index(
  { gateway: 1, gatewayRefundId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayRefundId: { $type: 'string' } },
    name: 'uniq_gateway_refund_id'
  }
);
refundSchema.index(
  { paymentOrderId: 1, reasonCode: 1 },
  {
    unique: true,
    partialFilterExpression: { isLiveRefund: true },
    name: 'uniq_live_refund_reason_per_payment'
  }
);
refundSchema.index(
  { requestedBy: 1, idempotencyKey: 1 },
  { unique: true, name: 'uniq_refund_idempotency_per_actor' }
);

module.exports = mongoose.model('Refund', refundSchema);

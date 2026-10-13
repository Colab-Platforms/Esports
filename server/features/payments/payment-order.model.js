const mongoose = require('mongoose');

const { Schema } = mongoose;

const sanitizedProviderOrderSchema = new Schema({
  id: String,
  entity: String,
  amount: Number,
  amount_paid: Number,
  amount_due: Number,
  currency: String,
  receipt: String,
  status: String,
  attempts: Number,
  created_at: Number,
  notes: {
    intentId: String,
    paymentOrderId: String,
    tournamentId: String,
    captainUserId: String,
    gameType: String,
    providerCreateAttemptId: String
  }
}, { _id: false, strict: false });

const providerCorrelationSchema = new Schema({
  providerCreateAttemptId: { type: String, default: '', trim: true },
  intentId: { type: String, default: '', trim: true },
  paymentOrderId: { type: String, default: '', trim: true },
  tournamentId: { type: String, default: '', trim: true },
  captainUserId: { type: String, default: '', trim: true },
  gameType: { type: String, enum: ['valorant', ''], default: 'valorant' }
}, { _id: false });

const sanitizedProviderPaymentSchema = new Schema({
  id: String,
  entity: String,
  amount: Number,
  currency: String,
  status: String,
  order_id: String,
  method: String,
  captured: Boolean,
  created_at: Number
}, { _id: false, strict: false });

const paymentOrderSchema = new Schema({
  intentId: { type: Schema.Types.ObjectId, ref: 'RegistrationIntent', required: true },
  purpose: { type: String, enum: ['tournament_registration'], required: true },
  gameType: { type: String, enum: ['valorant'], required: true },
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  captainUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  gateway: { type: String, enum: ['razorpay'], required: true },
  gatewayOrderId: { type: String, default: null },
  gatewayPaymentId: { type: String, default: null },

  amountMinor: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Payment order amount must be an integer number of paise'
    }
  },
  currency: { type: String, enum: ['INR'], required: true },

  status: {
    type: String,
    enum: [
      'provider_create_pending',
      'provider_create_unknown',
      'created',
      'authorized',
      'captured',
      'failed',
      'cancelled',
      'capture_late_review',
      'refunded',
      'partially_refunded'
    ],
    default: 'provider_create_pending'
  },
  fulfillmentStatus: {
    type: String,
    enum: ['not_started', 'fulfilling', 'fulfilled', 'captured_unfulfilled', 'failed'],
    default: 'not_started'
  },
  isLiveOrder: { type: Boolean, default: true, required: true },

  providerOrder: sanitizedProviderOrderSchema,
  providerPayment: sanitizedProviderPaymentSchema,
  providerReceipt: { type: String, required: true, trim: true },
  providerCreateAttemptId: { type: String, default: '', trim: true },
  providerCorrelation: providerCorrelationSchema,
  lastVerifiedAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
  capturedAt: { type: Date, default: null },
  idempotencyKey: { type: String, required: true, trim: true }
}, { timestamps: true });

paymentOrderSchema.index({ intentId: 1, createdAt: -1 });
paymentOrderSchema.index({ tournamentId: 1, status: 1 });
paymentOrderSchema.index({ captainUserId: 1, createdAt: -1 });
paymentOrderSchema.index(
  { gateway: 1, gatewayOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayOrderId: { $type: 'string' } },
    name: 'uniq_gateway_order_id'
  }
);
paymentOrderSchema.index(
  { gateway: 1, gatewayPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayPaymentId: { $type: 'string' } },
    name: 'uniq_gateway_payment_id'
  }
);
paymentOrderSchema.index(
  { intentId: 1, idempotencyKey: 1 },
  { unique: true, name: 'uniq_payment_order_idempotency_per_intent' }
);
paymentOrderSchema.index(
  { intentId: 1 },
  {
    unique: true,
    partialFilterExpression: { isLiveOrder: true },
    name: 'uniq_live_payment_order_per_intent'
  }
);
paymentOrderSchema.index({ providerCreateAttemptId: 1 });
paymentOrderSchema.index({ providerReceipt: 1, status: 1 });

module.exports = mongoose.model('PaymentOrder', paymentOrderSchema);

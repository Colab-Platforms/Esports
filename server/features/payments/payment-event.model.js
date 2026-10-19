const mongoose = require('mongoose');

const { Schema } = mongoose;

const paymentEventSchema = new Schema({
  gateway: { type: String, enum: ['razorpay'], required: true },
  gatewayEventId: { type: String, required: true, trim: true },
  eventType: { type: String, required: true, trim: true },
  gatewayOrderId: { type: String, default: null },
  gatewayPaymentId: { type: String, default: null },
  paymentOrderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder', default: null },
  intentId: { type: Schema.Types.ObjectId, ref: 'RegistrationIntent', default: null },

  signatureVerified: { type: Boolean, required: true },
  payloadHash: { type: String, required: true, trim: true },
  sanitizedPayload: {
    event: String,
    created_at: Number,
    account_id: String,
    entity: Schema.Types.Mixed,
    payment: Schema.Types.Mixed,
    order: Schema.Types.Mixed
  },

  processingStatus: {
    type: String,
    enum: ['received', 'processing', 'processed', 'ignored', 'failed'],
    default: 'received'
  },
  lockedUntil: { type: Date, default: null },
  processingAttempts: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Processing attempts must be an integer'
    }
  },
  processedAt: { type: Date, default: null },
  processingResult: { type: String, default: '' },
  lastError: { type: String, default: '' }
}, { timestamps: true, autoIndex: false, autoCreate: false });

paymentEventSchema.index({ gateway: 1, gatewayEventId: 1 }, { unique: true, name: 'uniq_gateway_event_id' });
paymentEventSchema.index({ gatewayOrderId: 1 });
paymentEventSchema.index({ gatewayPaymentId: 1 });
paymentEventSchema.index({ processingStatus: 1, createdAt: 1 });
paymentEventSchema.index({ lockedUntil: 1, processingStatus: 1 });

module.exports = mongoose.model('PaymentEvent', paymentEventSchema);

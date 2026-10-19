const mongoose = require('mongoose');

const { Schema } = mongoose;

const paymentNotificationIntentSchema = new Schema({
  type: {
    type: String,
    enum: ['payment_receipt_email'],
    required: true
  },
  paymentOrderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder', required: true },
  receiptId: { type: Schema.Types.ObjectId, ref: 'PaymentReceipt', required: true },
  recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  recipientEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid recipient email']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed', 'delivery_uncertain', 'needs_attention', 'cancelled'],
    default: 'pending',
    required: true
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Notification attempts must be an integer'
    }
  },
  nextAttemptAt: { type: Date, default: Date.now },
  lastError: { type: String, default: '' },
  lockedUntil: { type: Date, default: null },
  claimToken: { type: String, default: '', trim: true },
  processingStartedAt: { type: Date, default: null },
  lastAttemptAt: { type: Date, default: null },
  sentAt: { type: Date, default: null },
  provider: { type: String, enum: ['resend', ''], default: '' },
  providerMessageId: { type: String, default: '', trim: true },
  providerIdempotencyKey: { type: String, default: '', trim: true },
  providerResponse: {
    id: String,
    status: String,
    errorName: String,
    errorMessage: String
  },
  firstProviderSubmittedAt: { type: Date, default: null },
  providerRequestSnapshot: {
    from: String,
    to: String,
    subject: String,
    html: String,
    text: String,
    tags: [{
      name: String,
      value: String
    }]
  },
  maxAttempts: {
    type: Number,
    default: 5,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Notification max attempts must be an integer'
    }
  }
}, { timestamps: true, autoIndex: false, autoCreate: false });

paymentNotificationIntentSchema.index(
  { type: 1, paymentOrderId: 1, recipientUserId: 1 },
  { unique: true, name: 'uniq_payment_notification_intent' }
);
paymentNotificationIntentSchema.index({ status: 1, nextAttemptAt: 1 });
paymentNotificationIntentSchema.index({ receiptId: 1 });
paymentNotificationIntentSchema.index({ recipientUserId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentNotificationIntent', paymentNotificationIntentSchema);

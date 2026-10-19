const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  paymentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentOrder', required: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentRegistration', default: null },
  reason: { type: String, required: true },
  status: { type: String, enum: ['requested', 'approved', 'declined', 'processed'], default: 'requested' },
  decisionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decisionAt: Date,
  decisionReason: String,
  gatewayRefundId: { type: String, default: null },
  providerStatus: String,
  refundedAt: Date
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ paymentOrderId: 1 }, { unique: true, name: 'uniq_refund_review_payment_order' });
schema.index({ status: 1, createdAt: 1 });
schema.index({ gatewayRefundId: 1 }, { unique: true, partialFilterExpression: { gatewayRefundId: { $type: 'string' } }, name: 'uniq_review_gateway_refund' });
module.exports = mongoose.model('PaymentRefundReview', schema);

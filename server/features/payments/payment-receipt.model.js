const mongoose = require('mongoose');

const { Schema } = mongoose;

const paymentReceiptSchema = new Schema({
  receiptNumber: { type: String, required: true, trim: true },
  paymentOrderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder', required: true },
  registrationIntentId: { type: Schema.Types.ObjectId, ref: 'RegistrationIntent', required: true },
  tournamentRegistrationId: { type: Schema.Types.ObjectId, ref: 'TournamentRegistration', required: true },
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  captainUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  teamName: { type: String, required: true, trim: true },
  amountMinor: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Receipt amount must be an integer number of paise'
    }
  },
  currency: { type: String, enum: ['INR'], required: true },
  gateway: { type: String, enum: ['razorpay'], required: true },
  gatewayPaymentId: { type: String, required: true, trim: true },
  capturedAt: { type: Date, required: true }
}, { timestamps: true, autoIndex: false, autoCreate: false });

paymentReceiptSchema.index({ receiptNumber: 1 }, { unique: true, name: 'uniq_payment_receipt_number' });
paymentReceiptSchema.index({ paymentOrderId: 1 }, { unique: true, name: 'uniq_receipt_payment_order' });
paymentReceiptSchema.index(
  { tournamentRegistrationId: 1 },
  { unique: true, name: 'uniq_receipt_tournament_registration' }
);
paymentReceiptSchema.index({ captainUserId: 1, createdAt: -1 });
paymentReceiptSchema.index({ tournamentId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentReceipt', paymentReceiptSchema);

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StoreItem',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  playerID: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'fulfilled', 'failed', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  claimStatus: {
    type: String,
    enum: ['pending', 'fulfilled', 'failed'],
    default: 'pending'
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fulfilledAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);

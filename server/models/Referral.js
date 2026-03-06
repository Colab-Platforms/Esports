const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  referredUsers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending'
    },
    coinsEarned: {
      type: Number,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: Date
  }],
  totalReferrals: {
    type: Number,
    default: 0
  },
  successfulReferrals: {
    type: Number,
    default: 0
  },
  totalCoinsEarned: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate unique referral code
referralSchema.statics.generateCode = async function(userId) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const exists = await this.findOne({ referralCode: code });
  if (exists) {
    return this.generateCode(userId);
  }
  return code;
};

module.exports = mongoose.model('Referral', referralSchema);

const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["earn", "spend", "refund", "bonus", "referral"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  metadata: {
    source: String, // 'tournament_win', 'daily_login', 'referral', 'store_purchase', etc.
    referenceId: mongoose.Schema.Types.ObjectId,
    referenceModel: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    transactions: [transactionSchema],
    lastDailyLogin: {
      type: Date,
    },

    streak: {
      type: Number,
      default: 0,
    },
    
    // Track daily login history for last 30 days
    dailyLoginHistory: [{
      date: {
        type: Date,
        required: true
      },
      claimed: {
        type: Boolean,
        default: true
      },
      coinsEarned: {
        type: Number,
        default: 0
      }
    }],
  },
  {
    timestamps: true,
  },
);

// Method to add coins
walletSchema.methods.addCoins = function (
  amount,
  type,
  description,
  metadata = {},
) {
  this.balance += amount;
  this.totalEarned += amount;
  this.transactions.push({
    type,
    amount,
    description,
    metadata,
  });
  return this.save();
};

// Method to deduct coins
walletSchema.methods.deductCoins = function (
  amount,
  description,
  metadata = {},
) {
  if (this.balance < amount) {
    throw new Error("Insufficient balance");
  }
  this.balance -= amount;
  this.totalSpent += amount;
  this.transactions.push({
    type: "spend",
    amount: -amount,
    description,
    metadata,
  });
  return this.save();
};

module.exports = mongoose.model("Wallet", walletSchema);

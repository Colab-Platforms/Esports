const mongoose = require('mongoose');

const multiplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  multiplier: {
    type: Number,
    required: true,
    min: 1
  },
  startTime: {
    type: String, // Format: "HH:MM" (24-hour)
    required: true
  },
  endTime: {
    type: String, // Format: "HH:MM" (24-hour)
    required: true
  },
  days: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  }],
  isActive: {
    type: Boolean,
    default: true
  }
});

const coinConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String
  },
  category: {
    type: String,
    enum: ['earning', 'bonus', 'referral', 'tournament'],
    default: 'earning'
  }
}, {
  timestamps: true
});

const timeMultiplierSchema = new mongoose.Schema({
  multipliers: [multiplierSchema]
}, {
  timestamps: true
});

const CoinConfig = mongoose.model('CoinConfig', coinConfigSchema);
const TimeMultiplier = mongoose.model('TimeMultiplier', timeMultiplierSchema);

module.exports = { CoinConfig, TimeMultiplier };

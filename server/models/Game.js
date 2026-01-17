const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: false
  },
  category: {
    type: String,
    required: false,
    enum: ['PC', 'Mobile', 'Console']
  },
  description: {
    type: String,
    required: true
  },
  background: {
    type: String,
    required: false
  },
  backgroundImage: {
    type: String,
    required: false
  },
  logo: {
    type: String,
    required: false
  },
  tournaments: {
    type: Number,
    default: 0
  },
  activePlayers: {
    type: String,
    default: '0'
  },
  totalPrize: {
    type: String,
    default: '₹0'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Game', gameSchema);
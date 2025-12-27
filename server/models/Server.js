const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  gameType: {
    type: String,
    required: true,
    enum: ['cs2', 'bgmi', 'valorant', 'freefire'],
    default: 'cs2'
  },
  region: {
    type: String,
    required: true,
    default: 'mumbai'
  },
  ip: {
    type: String,
    required: true
  },
  port: {
    type: String,
    required: true,
    default: '27015'
  },
  maxPlayers: {
    type: Number,
    required: true,
    default: 10
  },
  currentPlayers: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'full'],
    default: 'active'
  },
  map: {
    type: String,
    default: 'de_dust2'
  },
  ping: {
    type: String,
    default: '12ms'
  },
  password: {
    type: String,
    default: ''
  },
  connectCommand: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
serverSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for players display
serverSchema.virtual('playersDisplay').get(function() {
  return `${this.currentPlayers}/${this.maxPlayers}`;
});

// Virtual for connection string
serverSchema.virtual('connectionString').get(function() {
  return `${this.ip}:${this.port}`;
});

module.exports = mongoose.model('Server', serverSchema);
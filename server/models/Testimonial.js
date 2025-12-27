const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    trim: true
  },
  gameType: {
    type: String,
    required: true,
    enum: ['bgmi', 'cs2', 'valorant', 'freefire', 'ml', 'apex', 'rainbow6', 'fc24'],
    default: 'bgmi'
  },
  gameTitle: {
    type: String,
    required: true,
    default: 'BGMI Player'
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    default: 5
  },
  avatar: {
    type: String,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
testimonialSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
testimonialSchema.index({ isActive: 1, displayOrder: 1 });
testimonialSchema.index({ gameType: 1, isActive: 1 });

module.exports = mongoose.model('Testimonial', testimonialSchema);
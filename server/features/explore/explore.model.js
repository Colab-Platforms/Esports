const mongoose = require('mongoose');

// Only http:// and https:// are allowed - explicitly blocks javascript:, data:,
// vbscript:, and protocol-relative (//host) URLs from being stored as a
// click-through destination.
const SAFE_URL_PATTERN = /^https?:\/\/[^\s]+$/i;

const exploreContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  description: {
    type: String,
    default: '',
    maxlength: 500
  },
  url: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
    validate: {
      validator: (value) => SAFE_URL_PATTERN.test(value),
      message: 'URL must start with http:// or https://'
    }
  },
  thumbnailUrl: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['video', 'article', 'social', 'resource'],
    required: true
  },
  platform: {
    type: String,
    enum: ['youtube', 'instagram', 'external'],
    default: 'external'
  },
  isFeatured: {
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
  clickCount: {
    type: Number,
    default: 0
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

exploreContentSchema.index({ isActive: 1, isFeatured: 1, displayOrder: 1 });
exploreContentSchema.index({ contentType: 1, isActive: 1 });

module.exports = mongoose.model('ExploreContent', exploreContentSchema);

const mongoose = require('mongoose');

const siteImageSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    required: true
  },
  // Responsive image URLs
  responsiveUrls: {
    desktop: String,   // 1920x1080
    tablet: String,    // 1024x768
    mobile: String     // 750x1334
  },
  // Text overlay for banners/sliders
  textOverlay: {
    enabled: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: '',
      maxlength: 100
    },
    subtitle: {
      type: String,
      default: '',
      maxlength: 150
    },
    description: {
      type: String,
      default: '',
      maxlength: 300
    },
    ctaText: {
      type: String,
      default: '',
      maxlength: 50
    },
    ctaLink: {
      type: String,
      default: '',
      maxlength: 200
    },
    textColor: {
      type: String,
      default: '#ffffff'
    },
    position: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'left'
    }
  },
  category: {
    type: String,
    enum: ['banner', 'hero', 'background', 'icon', 'logo', 'other'],
    default: 'other'
  },
  dimensions: {
    width: Number,
    height: Number
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SiteImage', siteImageSchema);

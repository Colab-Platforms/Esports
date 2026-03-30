const mongoose = require('mongoose');

const clanReportSchema = new mongoose.Schema({
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clan',
    required: [true, 'Clan is required']
  },
  
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClanMessage',
    required: [true, 'Message is required']
  },
  
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reporter is required']
  },
  
  reason: {
    type: String,
    enum: {
      values: ['spam', 'harassment', 'inappropriate', 'other'],
      message: 'Invalid report reason'
    },
    required: [true, 'Reason is required']
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  
  status: {
    type: String,
    enum: {
      values: ['pending', 'resolved', 'dismissed'],
      message: 'Invalid status'
    },
    default: 'pending'
  },
  
  handledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  handledAt: {
    type: Date,
    default: null
  },
  
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    default: ''
  }
}, {
  timestamps: true
});

// Indexes
clanReportSchema.index({ clan: 1, status: 1 });
clanReportSchema.index({ message: 1 });
clanReportSchema.index({ reportedBy: 1 });
clanReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ClanReport', clanReportSchema);

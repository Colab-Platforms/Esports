const mongoose = require('mongoose');

const whatsAppMessageSchema = new mongoose.Schema({
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TournamentRegistration',
    required: [true, 'Registration ID is required']
  },
  
  // Message Details
  messageType: {
    type: String,
    enum: ['registration_success', 'verification_approved', 'verification_rejected', 'tournament_update'],
    required: [true, 'Message type is required']
  },
  
  recipientPhone: {
    type: String,
    required: [true, 'Recipient phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  
  // WhatsApp Template Information
  templateName: {
    type: String,
    required: [true, 'Template name is required']
  },
  
  templateParams: {
    type: Map,
    of: String,
    default: new Map()
  },
  
  // Message Content
  messageContent: {
    type: String,
    required: [true, 'Message content is required']
  },
  
  // Delivery Tracking
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
    default: 'queued'
  },
  
  whatsappMessageId: {
    type: String,
    default: null
  },
  
  // Timestamps
  queuedAt: {
    type: Date,
    default: Date.now
  },
  
  sentAt: {
    type: Date,
    default: null
  },
  
  deliveredAt: {
    type: Date,
    default: null
  },
  
  readAt: {
    type: Date,
    default: null
  },
  
  failedAt: {
    type: Date,
    default: null
  },
  
  // Error Information
  errorMessage: {
    type: String,
    default: null
  },
  
  retryCount: {
    type: Number,
    default: 0
  },
  
  maxRetries: {
    type: Number,
    default: 3
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
whatsAppMessageSchema.index({ registrationId: 1 });
whatsAppMessageSchema.index({ messageType: 1 });
whatsAppMessageSchema.index({ status: 1 });
whatsAppMessageSchema.index({ recipientPhone: 1 });
whatsAppMessageSchema.index({ queuedAt: 1 });

// Virtual for delivery duration
whatsAppMessageSchema.virtual('deliveryDuration').get(function() {
  if (this.sentAt && this.deliveredAt) {
    return this.deliveredAt - this.sentAt;
  }
  return null;
});

// Virtual for total processing time
whatsAppMessageSchema.virtual('totalProcessingTime').get(function() {
  if (this.queuedAt && this.deliveredAt) {
    return this.deliveredAt - this.queuedAt;
  }
  return null;
});

// Method to mark as sent
whatsAppMessageSchema.methods.markAsSent = function(whatsappMessageId) {
  this.status = 'sent';
  this.whatsappMessageId = whatsappMessageId;
  this.sentAt = new Date();
  return this.save();
};

// Method to mark as delivered
whatsAppMessageSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Method to mark as read
whatsAppMessageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

// Method to mark as failed
whatsAppMessageSchema.methods.markAsFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.failedAt = new Date();
  this.retryCount += 1;
  return this.save();
};

// Method to check if retry is possible
whatsAppMessageSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && this.status === 'failed';
};

// Static method to create registration success message
whatsAppMessageSchema.statics.createRegistrationSuccessMessage = function(registrationId, recipientPhone, teamName, tournamentName) {
  const messageContent = `🎮 Registration Successful! 

Team: ${teamName}
Tournament: ${tournamentName}

Next Steps:
1. Upload 8 verification images (2 per player)
2. Wait for admin verification
3. Receive tournament details

Good luck! 🏆`;

  return this.create({
    registrationId,
    messageType: 'registration_success',
    recipientPhone,
    templateName: 'registration_success',
    templateParams: new Map([
      ['team_name', teamName],
      ['tournament_name', tournamentName]
    ]),
    messageContent
  });
};

// Static method to create verification message (alias for approved)
whatsAppMessageSchema.statics.createVerificationMessage = function(registrationId, recipientPhone, teamName, tournamentName, tournamentDetails = {}) {
  return this.createVerificationApprovedMessage(registrationId, recipientPhone, teamName, tournamentName, tournamentDetails);
};

// Static method to create verification approved message
whatsAppMessageSchema.statics.createVerificationApprovedMessage = function(registrationId, recipientPhone, teamName, tournamentName, tournamentDetails = {}) {
  const messageContent = `✅ Verification Approved! 

Team: ${teamName}
Tournament: ${tournamentName}

Your registration has been verified! 

Tournament Details:
📅 Date: ${tournamentDetails.date || 'TBD'}
⏰ Time: ${tournamentDetails.time || 'TBD'}
🎮 Mode: ${tournamentDetails.mode || 'Squad'}

Room details will be shared 30 minutes before the match.

Best of luck! 🏆`;

  return this.create({
    registrationId,
    messageType: 'verification_approved',
    recipientPhone,
    templateName: 'verification_approved',
    templateParams: new Map([
      ['team_name', teamName],
      ['tournament_name', tournamentName],
      ['tournament_date', tournamentDetails.date || 'TBD'],
      ['tournament_time', tournamentDetails.time || 'TBD']
    ]),
    messageContent
  });
};

// Static method to create verification rejected message
whatsAppMessageSchema.statics.createVerificationRejectedMessage = function(registrationId, recipientPhone, teamName, tournamentName, reason) {
  const messageContent = `❌ Verification Rejected

Team: ${teamName}
Tournament: ${tournamentName}

Reason: ${reason}

You can re-register with correct information.

Contact support if you need help.`;

  return this.create({
    registrationId,
    messageType: 'verification_rejected',
    recipientPhone,
    templateName: 'verification_rejected',
    templateParams: new Map([
      ['team_name', teamName],
      ['tournament_name', tournamentName],
      ['rejection_reason', reason]
    ]),
    messageContent
  });
};

// Static method to get message statistics
whatsAppMessageSchema.statics.getMessageStats = function(filters = {}) {
  const matchQuery = {};
  
  if (filters.messageType) {
    matchQuery.messageType = filters.messageType;
  }
  
  if (filters.dateFrom || filters.dateTo) {
    matchQuery.queuedAt = {};
    if (filters.dateFrom) matchQuery.queuedAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) matchQuery.queuedAt.$lte = new Date(filters.dateTo);
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDeliveryTime: {
          $avg: {
            $cond: {
              if: { $and: ['$sentAt', '$deliveredAt'] },
              then: { $subtract: ['$deliveredAt', '$sentAt'] },
              else: null
            }
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
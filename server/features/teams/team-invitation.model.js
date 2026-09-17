const mongoose = require('mongoose');

const teamInvitationSchema = new mongoose.Schema({
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
}, {
  timestamps: true
});

// Indexes
teamInvitationSchema.index({ teamId: 1 });
teamInvitationSchema.index({ invitedUser: 1 });
teamInvitationSchema.index({ status: 1 });
teamInvitationSchema.index({ expiresAt: 1 });

// Check if invitation is expired
teamInvitationSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Auto-expire old invitations
teamInvitationSchema.pre('save', function(next) {
  if (this.isExpired() && this.status === 'pending') {
    this.status = 'expired';
  }
  next();
});

const TeamInvitation = mongoose.model('TeamInvitation', teamInvitationSchema);

module.exports = TeamInvitation;

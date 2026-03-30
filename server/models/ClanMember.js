const mongoose = require('mongoose');

const clanMemberSchema = new mongoose.Schema({
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clan',
    required: [true, 'Clan is required']
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  
  role: {
    type: String,
    enum: {
      values: ['owner', 'admin', 'mod', 'member'],
      message: 'Role must be owner, admin, mod, or member'
    },
    default: 'member'
  },
  
  mutedUntil: {
    type: Date,
    default: null
  },
  
  joinedAt: {
    type: Date,
    default: Date.now
  },
  
  stats: {
    messagesCount: {
      type: Number,
      default: 0
    },
    lastMessageAt: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate memberships
clanMemberSchema.index({ clan: 1, user: 1 }, { unique: true });

// Additional indexes for efficient queries
clanMemberSchema.index({ clan: 1, role: 1 });
clanMemberSchema.index({ user: 1 });
clanMemberSchema.index({ clan: 1, joinedAt: -1 });

// Method to check if member is muted
clanMemberSchema.methods.isMuted = function() {
  if (!this.mutedUntil) return false;
  return new Date() < this.mutedUntil;
};

// Method to mute member
clanMemberSchema.methods.mute = function(durationMs) {
  this.mutedUntil = new Date(Date.now() + durationMs);
  return this.save();
};

// Method to unmute member
clanMemberSchema.methods.unmute = function() {
  this.mutedUntil = null;
  return this.save();
};

// Method to check if member has permission
clanMemberSchema.methods.hasPermission = function(permission) {
  const permissions = {
    owner: ['manage_members', 'manage_roles', 'delete_messages', 'pin_messages', 'manage_settings', 'invite_members', 'send_messages'],
    admin: ['manage_members', 'delete_messages', 'pin_messages', 'invite_members', 'send_messages'],
    mod: ['delete_messages', 'pin_messages', 'send_messages'],
    member: ['send_messages']
  };
  
  const rolePermissions = permissions[this.role] || [];
  return rolePermissions.includes(permission);
};

module.exports = mongoose.model('ClanMember', clanMemberSchema);

const mongoose = require('mongoose');

const clanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Clan name is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Clan name must be at least 3 characters'],
    maxlength: [50, 'Clan name cannot exceed 50 characters']
  },
  
  tag: {
    type: String,
    uppercase: true,
    trim: true,
    maxlength: [5, 'Clan tag cannot exceed 5 characters'],
    sparse: true // Allow null values but enforce uniqueness on non-null values
  },
  
  avatar: {
    type: String,
    default: null // URL to clan avatar image
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Clan owner is required']
  },
  
  visibility: {
    type: String,
    enum: {
      values: ['public', 'private', 'invite'],
      message: 'Visibility must be public, private, or invite'
    },
    default: 'public'
  },
  
  maxMembers: {
    type: Number,
    default: 100,
    min: [2, 'Clan must allow at least 2 members'],
    max: [1000, 'Clan cannot exceed 1000 members']
  },
  
  isLocked: {
    type: Boolean,
    default: false
  },
  
  bannedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  stats: {
    totalMembers: {
      type: Number,
      default: 1 // Owner counts as 1 member
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    createdTournaments: {
      type: Number,
      default: 0
    }
  },
  
  settings: {
    allowPublicChat: {
      type: Boolean,
      default: true
    },
    requireApprovalToJoin: {
      type: Boolean,
      default: false
    },
    allowMembersToInvite: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes
clanSchema.index({ name: 1 });
clanSchema.index({ owner: 1 });
clanSchema.index({ visibility: 1 });
clanSchema.index({ createdAt: -1 });

// Virtual for member count
clanSchema.virtual('memberCount').get(function() {
  return this.stats?.totalMembers || 0;
});

// Method to check if user is banned
clanSchema.methods.isBanned = function(userId) {
  if (!this.bannedUsers) return false;
  return this.bannedUsers.some(id => id.toString() === userId.toString());
};

// Method to ban a user
clanSchema.methods.banUser = function(userId) {
  if (!this.isBanned(userId)) {
    this.bannedUsers.push(userId);
  }
  return this.save();
};

// Method to unban a user
clanSchema.methods.unbanUser = function(userId) {
  this.bannedUsers = this.bannedUsers.filter(id => id.toString() !== userId.toString());
  return this.save();
};

module.exports = mongoose.model('Clan', clanSchema);

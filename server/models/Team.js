const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    minlength: [3, 'Team name must be at least 3 characters'],
    maxlength: [30, 'Team name cannot exceed 30 characters']
  },
  tag: {
    type: String,
    trim: true,
    uppercase: true,
    minlength: [2, 'Team tag must be at least 2 characters'],
    maxlength: [5, 'Team tag cannot exceed 5 characters']
  },
  game: {
    type: String,
    required: [true, 'Game is required'],
    enum: ['bgmi', 'cs2']
  },
  logo: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['captain', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxMembers: {
    type: Number,
    required: true,
    min: [2, 'Team must have at least 2 members'],
    max: [10, 'Team cannot exceed 10 members']
  },
  privacy: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  },
  stats: {
    wins: {
      type: Number,
      default: 0
    },
    losses: {
      type: Number,
      default: 0
    },
    tournamentsPlayed: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
teamSchema.index({ name: 1 });
teamSchema.index({ captain: 1 });
teamSchema.index({ game: 1 });
teamSchema.index({ 'members.userId': 1 });

// Virtual for member count
teamSchema.virtual('memberCount').get(function() {
  return this.members.length;
});

// Method to check if user is captain
teamSchema.methods.isCaptain = function(userId) {
  if (!userId || !this.captain) return false;
  return this.captain.toString() === userId.toString();
};

// Method to check if user is member
teamSchema.methods.isMember = function(userId) {
  if (!userId) return false;
  return this.members.some(member => {
    if (!member.userId) return false;
    return member.userId.toString() === userId.toString();
  });
};

// Method to add member
teamSchema.methods.addMember = function(userId, role = 'member') {
  if (this.members.length >= this.maxMembers) {
    throw new Error('Team is full');
  }
  
  if (this.isMember(userId)) {
    throw new Error('User is already a member');
  }
  
  this.members.push({
    userId,
    role,
    joinedAt: new Date()
  });
};

// Method to remove member
teamSchema.methods.removeMember = function(userId) {
  if (this.isCaptain(userId)) {
    throw new Error('Cannot remove captain');
  }
  
  this.members = this.members.filter(
    member => member.userId.toString() !== userId.toString()
  );
};

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;

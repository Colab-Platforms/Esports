const mongoose = require('mongoose');

const clanMessageSchema = new mongoose.Schema({
  clan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clan',
    required: [true, 'Clan is required']
  },
  
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    trim: true
  },
  
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClanMessage',
    default: null
  },
  
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    count: {
      type: Number,
      default: 0
    }
  }],
  
  isPinned: {
    type: Boolean,
    default: false
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deletedAt: {
    type: Date,
    default: null
  },
  
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  pinnedAt: {
    type: Date,
    default: null
  },
  
  editedAt: {
    type: Date,
    default: null
  },
  
  seq: {
    type: Number,
    required: true
  },
  
  attachments: [{
    url: String,
    type: String, // 'image', 'video', 'file'
    size: Number,
    name: String
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
clanMessageSchema.index({ clan: 1, seq: -1 });
clanMessageSchema.index({ clan: 1, isPinned: 1 });
clanMessageSchema.index({ sender: 1 });
clanMessageSchema.index({ clan: 1, createdAt: -1 });
clanMessageSchema.index({ replyTo: 1 });

// Method to add reaction
clanMessageSchema.methods.addReaction = function(emoji, userId) {
  let reaction = this.reactions.find(r => r.emoji === emoji);
  
  if (!reaction) {
    this.reactions.push({ emoji, users: [userId] });
  } else {
    // Check if user already reacted with this emoji
    if (!reaction.users.some(id => id.toString() === userId.toString())) {
      reaction.users.push(userId);
    }
  }
  
  return this.save();
};

// Method to remove reaction
clanMessageSchema.methods.removeReaction = function(emoji, userId) {
  const reaction = this.reactions.find(r => r.emoji === emoji);
  
  if (reaction) {
    reaction.users = reaction.users.filter(id => id.toString() !== userId.toString());
    
    // Remove reaction if no users left
    if (reaction.users.length === 0) {
      this.reactions = this.reactions.filter(r => r.emoji !== emoji);
    }
  }
  
  return this.save();
};

// Method to pin message
clanMessageSchema.methods.pin = function() {
  this.isPinned = true;
  return this.save();
};

// Method to unpin message
clanMessageSchema.methods.unpin = function() {
  this.isPinned = false;
  return this.save();
};

// Method to soft delete message
clanMessageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.content = '[Message deleted]';
  return this.save();
};

// Method to edit message
clanMessageSchema.methods.edit = function(newContent) {
  this.content = newContent;
  this.editedAt = new Date();
  return this.save();
};

// Virtual for reaction count
clanMessageSchema.virtual('reactionCount').get(function() {
  return this.reactions.reduce((sum, r) => sum + r.users.length, 0);
});

module.exports = mongoose.model('ClanMessage', clanMessageSchema);

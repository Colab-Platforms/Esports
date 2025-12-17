const mongoose = require('mongoose');

const tournamentRegistrationSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: [true, 'Tournament ID is required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  
  // Team Details (4 players per team for BGMI)
  teamName: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
    minlength: [3, 'Team name must be at least 3 characters'],
    maxlength: [50, 'Team name cannot exceed 50 characters']
  },
  
  // Team Leader (the user who registered)
  teamLeader: {
    name: {
      type: String,
      required: [true, 'Team leader name is required'],
      trim: true
    },
    bgmiId: {
      type: String,
      required: [true, 'Team leader BGMI ID is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Team leader phone is required'],
      match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
    }
  },
  
  // Team Members (3 additional players)
  teamMembers: [{
    name: {
      type: String,
      required: [true, 'Team member name is required'],
      trim: true
    },
    bgmiId: {
      type: String,
      required: [true, 'Team member BGMI ID is required'],
      trim: true
    }
  }],
  
  // Registration Status
  status: {
    type: String,
    enum: ['pending', 'images_uploaded', 'verified', 'rejected'],
    default: 'pending'
  },
  
  // WhatsApp Contact (for notifications)
  whatsappNumber: {
    type: String,
    required: [true, 'WhatsApp number is required'],
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  
  // Verification Images (8 images: 2 per player)
  verificationImages: [{
    playerId: {
      type: String,
      required: true,
      enum: ['leader', 'member1', 'member2', 'member3']
    },
    imageNumber: {
      type: Number,
      required: true,
      enum: [1, 2] // 2 images per player
    },
    cloudinaryUrl: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Admin Actions
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verificationDate: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  
  // Timestamps
  registeredAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique index to prevent duplicate registrations
tournamentRegistrationSchema.index({ tournamentId: 1, userId: 1 }, { unique: true });

// Indexes for efficient queries
tournamentRegistrationSchema.index({ tournamentId: 1, status: 1 });
tournamentRegistrationSchema.index({ userId: 1 });
tournamentRegistrationSchema.index({ status: 1 });
tournamentRegistrationSchema.index({ verifiedBy: 1 });

// Virtual to check if all images are uploaded (8 images total)
tournamentRegistrationSchema.virtual('allImagesUploaded').get(function() {
  return this.verificationImages.length === 8;
});

// Virtual to get images by player
tournamentRegistrationSchema.virtual('imagesByPlayer').get(function() {
  const imagesByPlayer = {
    leader: [],
    member1: [],
    member2: [],
    member3: []
  };
  
  this.verificationImages.forEach(image => {
    imagesByPlayer[image.playerId].push(image);
  });
  
  return imagesByPlayer;
});

// Virtual to get all team members (including leader)
tournamentRegistrationSchema.virtual('allTeamMembers').get(function() {
  return [
    { ...this.teamLeader, role: 'leader' },
    ...this.teamMembers.map((member, index) => ({ ...member, role: `member${index + 1}` }))
  ];
});

// Pre-save validation
tournamentRegistrationSchema.pre('save', function(next) {
  // Ensure exactly 3 team members (plus leader = 4 total)
  if (this.teamMembers.length !== 3) {
    return next(new Error('Team must have exactly 3 members (plus leader = 4 total players)'));
  }
  
  // Collect all BGMI IDs to check for duplicates
  const allBgmiIds = [this.teamLeader.bgmiId, ...this.teamMembers.map(m => m.bgmiId)];
  const uniqueBgmiIds = [...new Set(allBgmiIds)];
  
  if (allBgmiIds.length !== uniqueBgmiIds.length) {
    return next(new Error('All team members must have unique BGMI IDs'));
  }
  
  // No phone number validation for team members needed
  
  next();
});

// Method to add verification image
tournamentRegistrationSchema.methods.addVerificationImage = function(playerId, imageNumber, cloudinaryUrl, publicId) {
  // Check if image already exists for this player and image number
  const existingImageIndex = this.verificationImages.findIndex(
    img => img.playerId === playerId && img.imageNumber === imageNumber
  );
  
  if (existingImageIndex !== -1) {
    // Replace existing image
    this.verificationImages[existingImageIndex] = {
      playerId,
      imageNumber,
      cloudinaryUrl,
      publicId,
      uploadedAt: new Date()
    };
  } else {
    // Add new image
    this.verificationImages.push({
      playerId,
      imageNumber,
      cloudinaryUrl,
      publicId,
      uploadedAt: new Date()
    });
  }
  
  // Update status if all 8 images are uploaded
  if (this.verificationImages.length === 8 && this.status === 'pending') {
    this.status = 'images_uploaded';
  }
  
  return this.save();
};

// Method to verify registration
tournamentRegistrationSchema.methods.verify = function(adminUserId) {
  this.status = 'verified';
  this.verifiedBy = adminUserId;
  this.verificationDate = new Date();
  this.rejectionReason = null;
  
  return this.save();
};

// Method to reject registration
tournamentRegistrationSchema.methods.reject = function(adminUserId, reason) {
  this.status = 'rejected';
  this.verifiedBy = adminUserId;
  this.verificationDate = new Date();
  this.rejectionReason = reason;
  
  return this.save();
};

// Static method to get registrations with filters
tournamentRegistrationSchema.statics.getFilteredRegistrations = function(filters = {}) {
  const query = {};
  
  if (filters.tournamentId) {
    query.tournamentId = filters.tournamentId;
  }
  
  if (filters.userId) {
    query.userId = filters.userId;
  }
  
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query.status = { $in: filters.status };
    } else {
      query.status = filters.status;
    }
  }
  
  if (filters.teamName) {
    query.teamName = new RegExp(filters.teamName, 'i');
  }
  
  if (filters.playerName) {
    query.$or = [
      { 'teamLeader.name': new RegExp(filters.playerName, 'i') },
      { 'teamMembers.name': new RegExp(filters.playerName, 'i') }
    ];
  }
  
  if (filters.phone) {
    query.$or = [
      { 'teamLeader.phone': filters.phone },
      { 'teamMembers.phone': filters.phone },
      { whatsappNumber: filters.phone }
    ];
  }
  
  return this.find(query)
    .populate('tournamentId', 'name gameType mode')
    .populate('userId', 'username email')
    .populate('verifiedBy', 'username')
    .sort({ registeredAt: -1 });
};

module.exports = mongoose.model('TournamentRegistration', tournamentRegistrationSchema);
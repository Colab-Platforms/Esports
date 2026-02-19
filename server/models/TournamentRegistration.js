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
  
  // Team Details (4-5 players per team for BGMI: 3 required + 1 optional substitute)
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
      trim: true
    },
    freeFireId: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Team leader phone is required'],
      match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
    },
    isSubstitute: {
      type: Boolean,
      default: false
    }
  },
  
  // Team Members (3-4 additional players: 3 required + 1 optional substitute)
  teamMembers: [{
    name: {
      type: String,
      required: [true, 'Team member name is required'],
      trim: true
    },
    bgmiId: {
      type: String,
      trim: true
    },
    freeFireId: {
      type: String,
      trim: true
    },
    isSubstitute: {
      type: Boolean,
      default: false
    }
  }],
  
  // Registration Status
  status: {
    type: String,
    enum: ['pending', 'images_uploaded', 'verified', 'rejected'],
    default: 'pending'
  },

  // Team reference (set when registering via a saved Team)
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  
  // Group Assignment (for tournaments with grouping enabled)
  group: {
    type: String,
    default: null // Will be assigned automatically when grouping is enabled
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
tournamentRegistrationSchema.index({ teamId: 1, status: 1 });
tournamentRegistrationSchema.index({ status: 1 });
tournamentRegistrationSchema.index({ verifiedBy: 1 });

// Virtual to check if all images are uploaded (8 images total)
tournamentRegistrationSchema.virtual('allImagesUploaded').get(function() {
  return (this.verificationImages && this.verificationImages.length === 8) || false;
});

// Virtual to get images by player
tournamentRegistrationSchema.virtual('imagesByPlayer').get(function() {
  const imagesByPlayer = {
    leader: [],
    member1: [],
    member2: [],
    member3: []
  };
  
  // Check if verificationImages exists and is an array before forEach
  if (this.verificationImages && Array.isArray(this.verificationImages)) {
    this.verificationImages.forEach(image => {
      if (image.playerId && imagesByPlayer[image.playerId]) {
        imagesByPlayer[image.playerId].push(image);
      }
    });
  }
  
  return imagesByPlayer;
});

// Virtual to get all team members (including leader)
tournamentRegistrationSchema.virtual('allTeamMembers').get(function() {
  return [
    { ...this.teamLeader, role: 'leader' },
    ...this.teamMembers.map((member, index) => ({ ...member, role: `member${index + 1}` }))
  ];
});

// Pre-save middleware to update tournament participant count
tournamentRegistrationSchema.pre('save', async function(next) {
  // Ensure 3-4 team members (plus leader = 4-5 total)
  if (this.teamMembers.length < 3 || this.teamMembers.length > 4) {
    return next(new Error('Team must have 3-4 members (plus leader = 4-5 total players)'));
  }
  
  // Get tournament to check game type
  const Tournament = require('./Tournament');
  const tournament = await Tournament.findById(this.tournamentId);
  
  if (!tournament) {
    return next(new Error('Tournament not found'));
  }
  
  // Validate unique IDs based on game type
  if (tournament.gameType === 'bgmi') {
    // Collect all BGMI IDs to check for duplicates
    const allBgmiIds = [this.teamLeader.bgmiId, ...this.teamMembers.map(m => m.bgmiId)].filter(Boolean);
    const uniqueBgmiIds = [...new Set(allBgmiIds)];
    
    if (allBgmiIds.length !== uniqueBgmiIds.length) {
      return next(new Error('All team members must have unique BGMI IDs'));
    }
    
    // Ensure all members have BGMI IDs
    if (!this.teamLeader.bgmiId) {
      return next(new Error('Team leader BGMI ID is required for BGMI tournaments'));
    }
    for (const member of this.teamMembers) {
      if (!member.bgmiId) {
        return next(new Error('All team members must have BGMI IDs for BGMI tournaments'));
      }
    }
  } else if (tournament.gameType === 'freefire') {
    // Collect all Free Fire IDs to check for duplicates
    const allFreeFireIds = [this.teamLeader.freeFireId, ...this.teamMembers.map(m => m.freeFireId)].filter(Boolean);
    const uniqueFreeFireIds = [...new Set(allFreeFireIds)];
    
    if (allFreeFireIds.length !== uniqueFreeFireIds.length) {
      return next(new Error('All team members must have unique Free Fire IDs'));
    }
    
    // Ensure all members have Free Fire IDs
    if (!this.teamLeader.freeFireId) {
      return next(new Error('Team leader Free Fire ID is required for Free Fire tournaments'));
    }
    for (const member of this.teamMembers) {
      if (!member.freeFireId) {
        return next(new Error('All team members must have Free Fire IDs for Free Fire tournaments'));
      }
    }
  }
  
  next();
});

// Post-save middleware to sync tournament participant count and assign groups
tournamentRegistrationSchema.post('save', async function(doc) {
  try {
    const Tournament = require('./Tournament');
    const tournament = await Tournament.findById(doc.tournamentId);
    
    if (tournament && tournament.gameType === 'bgmi') {
      // Count active registrations
      const registrationCount = await this.constructor.countDocuments({
        tournamentId: doc.tournamentId,
        status: { $in: ['pending', 'images_uploaded', 'verified'] }
      });
      
      // Update tournament participant count
      tournament.currentParticipants = registrationCount;
      await tournament.save();
      
      console.log(`🔄 Updated tournament ${tournament.name} participant count to ${registrationCount}`);
      
      // Auto-assign groups if grouping is enabled and this registration doesn't have a group
      if (tournament.grouping && tournament.grouping.enabled && !doc.group) {
        await this.constructor.assignGroups(doc.tournamentId);
      }
    }
  } catch (error) {
    console.error('❌ Error syncing tournament participant count:', error);
  }
});

// Post-remove middleware to sync tournament participant count
tournamentRegistrationSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const Tournament = require('./Tournament');
      const tournament = await Tournament.findById(doc.tournamentId);
      
      if (tournament && tournament.gameType === 'bgmi') {
        // Count active registrations
        const registrationCount = await mongoose.model('TournamentRegistration').countDocuments({
          tournamentId: doc.tournamentId,
          status: { $in: ['pending', 'images_uploaded', 'verified'] }
        });
        
        // Update tournament participant count
        tournament.currentParticipants = registrationCount;
        await tournament.save();
        
        console.log(`🔄 Updated tournament ${tournament.name} participant count to ${registrationCount} after deletion`);
      }
    } catch (error) {
      console.error('❌ Error syncing tournament participant count after deletion:', error);
    }
  }
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
  if (this.verificationImages && this.verificationImages.length === 8 && this.status === 'pending') {
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

// Static method to assign groups automatically
tournamentRegistrationSchema.statics.assignGroups = async function(tournamentId) {
  try {
    const Tournament = require('./Tournament');
    const tournament = await Tournament.findById(tournamentId);
    
    if (!tournament || !tournament.grouping || !tournament.grouping.enabled) {
      return { success: false, message: 'Grouping not enabled for this tournament' };
    }
    
    const groupSize = tournament.grouping.groupSize;
    
    // Get all registrations for this tournament ordered by registration time
    const registrations = await this.find({
      tournamentId: tournamentId,
      status: { $in: ['pending', 'images_uploaded', 'verified'] }
    }).sort({ registeredAt: 1 });
    
    let updatedCount = 0;
    
    // Assign groups based on registration order
    for (let i = 0; i < registrations.length; i++) {
      const registration = registrations[i];
      const groupNumber = Math.floor(i / groupSize) + 1;
      const groupName = `G${groupNumber}`;
      
      // Only update if group assignment has changed
      if (registration.group !== groupName) {
        await this.findByIdAndUpdate(registration._id, { group: groupName });
        updatedCount++;
        console.log(`📊 Assigned ${registration.teamName} to ${groupName}`);
      }
    }
    
    console.log(`✅ Group assignment complete for tournament ${tournament.name}. Updated ${updatedCount} registrations.`);
    return { success: true, updatedCount, totalGroups: Math.ceil(registrations.length / groupSize) };
    
  } catch (error) {
    console.error('❌ Error assigning groups:', error);
    return { success: false, error: error.message };
  }
};

// Static method to sync all tournament participant counts
tournamentRegistrationSchema.statics.syncTournamentCounts = async function() {
  try {
    const Tournament = require('./Tournament');
    
    // Get all BGMI tournaments
    const bgmiTournaments = await Tournament.find({ gameType: 'bgmi' });
    
    let updatedCount = 0;
    
    for (const tournament of bgmiTournaments) {
      // Count active registrations for this tournament
      const registrationCount = await this.countDocuments({
        tournamentId: tournament._id,
        status: { $in: ['pending', 'images_uploaded', 'verified'] }
      });
      
      // Update if count is different
      if (tournament.currentParticipants !== registrationCount) {
        tournament.currentParticipants = registrationCount;
        await tournament.save();
        updatedCount++;
        
        console.log(`🔄 Synced tournament "${tournament.name}": ${registrationCount} participants`);
      }
    }
    
    console.log(`✅ Tournament count sync complete. Updated ${updatedCount} tournaments.`);
    return { success: true, updatedCount };
    
  } catch (error) {
    console.error('❌ Error syncing tournament counts:', error);
    return { success: false, error: error.message };
  }
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
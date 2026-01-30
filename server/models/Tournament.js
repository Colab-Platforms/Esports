const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tournament name is required'],
    trim: true,
    minlength: [3, 'Tournament name must be at least 3 characters'],
    maxlength: [100, 'Tournament name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: false, // Optional for CS2
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  gameType: {
    type: String,
    required: [true, 'Game type is required'],
    enum: {
      values: ['bgmi', 'cs2', 'valorant', 'freefire'],
      message: 'Game type must be one of: bgmi, cs2, valorant, freefire'
    }
  },
  mode: {
    type: String,
    required: false, // Optional for CS2
    enum: {
      values: ['solo', 'duo', 'squad', 'team'],
      message: 'Mode must be one of: solo, duo, squad, team'
    }
  },
  entryFee: {
    type: Number,
    default: 0, // Free tournaments by default
    min: [0, 'Entry fee cannot be negative'],
    max: [0, 'All tournaments are free'] // Enforce free tournaments
  },
  prizePool: {
    type: Number,
    required: function() {
      // Prize pool not required for CS2 tournaments (they're just server access)
      return this.gameType !== 'cs2';
    },
    default: function() {
      // CS2 tournaments have no prize pool (just server access)
      return this.gameType === 'cs2' ? 0 : undefined;
    },
    min: [0, 'Prize pool cannot be negative']
  },
  prizeDistribution: [{
    position: {
      type: Number,
      required: true,
      min: 1
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  }],
  youtubeVideoId: {
    type: String,
    default: null,
    trim: true,
    maxlength: [50, 'YouTube video ID cannot exceed 50 characters']
  },
  isLiveStreamEnabled: {
    type: Boolean,
    default: false
  },
  maxParticipants: {
    type: Number,
    required: [true, 'Maximum participants is required'],
    min: [2, 'Tournament must allow at least 2 participants'],
    max: [1000, 'Tournament cannot exceed 1000 participants']
  },
  currentParticipants: {
    type: Number,
    default: 0,
    min: 0
  },
  // Grouping configuration for BGMI tournaments
  grouping: {
    enabled: {
      type: Boolean,
      default: false
    },
    groupSize: {
      type: Number,
      default: 20,
      min: [5, 'Group size must be at least 5'],
      max: [100, 'Group size cannot exceed 100']
    }
  },
  startDate: {
    type: Date,
    required: false // Optional for CS2
  },
  endDate: {
    type: Date,
    required: false // Optional for CS2
  },
  registrationDeadline: {
    type: Date,
    required: false // Optional for CS2
  },
  status: {
    type: String,
    enum: {
      values: ['upcoming', 'registration_open', 'registration_closed', 'active', 'completed', 'cancelled', 'inactive'],
      message: 'Invalid tournament status'
    },
    default: function() {
      // CS2 tournaments default to 'active', others to 'upcoming'
      return this.gameType === 'cs2' ? 'active' : 'registration_open';
    }
  },
  rules: {
    type: String,
    required: false, // Optional for CS2 tournaments
    maxlength: [5000, 'Rules cannot exceed 5000 characters']
  },
  format: {
    type: String,
    required: false, // Optional for CS2
    enum: {
      values: ['elimination', 'round_robin', 'swiss', 'battle_royale'],
      message: 'Format must be one of: elimination, round_robin, swiss, battle_royale'
    }
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    teamName: {
      type: String,
      default: ''
    },
    gameId: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['registered', 'confirmed', 'checked_in', 'disqualified', 'withdrawn'],
      default: 'registered'
    }
  }],
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tournament creator is required']
  },
  moderators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  settings: {
    allowLateRegistration: {
      type: Boolean,
      default: false
    },
    requireKYC: {
      type: Boolean,
      default: true
    },
    autoStartMatches: {
      type: Boolean,
      default: false
    },
    streamUrl: {
      type: String,
      default: ''
    },
    discordInvite: {
      type: String,
      default: ''
    }
  },
  stats: {
    totalMatches: {
      type: Number,
      default: 0
    },
    completedMatches: {
      type: Number,
      default: 0
    },
    totalPrizeDistributed: {
      type: Number,
      default: 0
    }
  },
  featured: {
    type: Boolean,
    default: false
  },
  bannerImage: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Room/Server Details (shown after registration)
  roomDetails: {
    // BGMI Room Details
    bgmi: {
      roomId: {
        type: String,
        default: ''
      },
      password: {
        type: String,
        default: ''
      },
      map: {
        type: String,
        default: 'Erangel'
      },
      perspective: {
        type: String,
        enum: ['TPP', 'FPP'],
        default: 'TPP'
      },
      mode: {
        type: String,
        default: 'Squad'
      }
    },
    
    // CS2 Server Details
    cs2: {
      serverIp: {
        type: String,
        default: ''
      },
      serverPort: {
        type: String,
        default: '27015'
      },
      password: {
        type: String,
        default: ''
      },
      rconPassword: {
        type: String,
        default: ''
      },
      connectCommand: {
        type: String,
        default: ''
      },
      mapPool: [{
        type: String
      }]
    },
    
    // Valorant Match Details
    valorant: {
      matchId: {
        type: String,
        default: ''
      },
      serverRegion: {
        type: String,
        default: 'Mumbai'
      },
      mapPool: [{
        type: String
      }]
    }
  },
  
  // Tournament Region
  region: {
    type: String,
    enum: ['mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'hyderabad', 'pune', 'singapore'],
    default: 'mumbai'
  },
  
  // Scoreboard Images (for completed tournaments)
  scoreboards: [{
    imageUrl: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: 'Tournament Results'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    order: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for tournament duration in hours
tournamentSchema.virtual('duration').get(function() {
  if (this.startDate && this.endDate) {
    return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60));
  }
  return 0;
});

// Virtual for registration status
tournamentSchema.virtual('isRegistrationOpen').get(function() {
  // CS2 tournaments: Only 'active' status allows joining, 'inactive' means server is down
  if (this.gameType === 'cs2') {
    return this.status === 'active';
  }
  
  const now = new Date();
  
  // Registration is open if:
  // 1. For CS2: Status is 'active' (server is online and available)
  // 2. For other games: Status is 'upcoming' or 'registration_open'
  // 3. Current time is before registration deadline (except CS2)
  // 4. Tournament is not full
  const validStatuses = ['upcoming', 'registration_open'];
  const isValidStatus = validStatuses.includes(this.status);
  const beforeDeadline = now < this.registrationDeadline;
  const hasSpace = this.currentParticipants < this.maxParticipants;
  
  // Commented out to reduce console spam - uncomment for debugging
  // console.log('🔍 Registration Check:', {
  //   tournamentId: this._id,
  //   status: this.status,
  //   isValidStatus,
  //   beforeDeadline,
  //   hasSpace,
  //   now: now.toISOString(),
  //   deadline: this.registrationDeadline?.toISOString(),
  //   currentParticipants: this.currentParticipants,
  //   maxParticipants: this.maxParticipants,
  //   result: isValidStatus && beforeDeadline && hasSpace
  // });
  
  return isValidStatus && beforeDeadline && hasSpace;
});

// Virtual for spots remaining
tournamentSchema.virtual('spotsRemaining').get(function() {
  return Math.max(0, this.maxParticipants - this.currentParticipants);
});

// Virtual for is full
tournamentSchema.virtual('isFull').get(function() {
  return this.currentParticipants >= this.maxParticipants;
});

// Indexes for efficient queries
tournamentSchema.index({ gameType: 1, status: 1 });
tournamentSchema.index({ startDate: 1 });
tournamentSchema.index({ entryFee: 1 });
tournamentSchema.index({ prizePool: -1 });
tournamentSchema.index({ featured: -1, createdAt: -1 });
tournamentSchema.index({ 'participants.userId': 1 });
tournamentSchema.index({ createdBy: 1 });

// Pre-save middleware to update tournament status
tournamentSchema.pre('save', function(next) {
  const now = new Date();
  
  // Validate CS2 tournament status
  if (this.gameType === 'cs2') {
    if (!['active', 'inactive'].includes(this.status)) {
      return next(new Error('CS2 tournament status must be either "active" or "inactive"'));
    }
    // Set default status for new CS2 tournaments
    if (this.isNew && !this.status) {
      this.status = 'active';
    }
  }
  
  console.log('⏰ Pre-save status check:', {
    tournamentId: this._id,
    gameType: this.gameType,
    currentStatus: this.status,
    now: now.toISOString(),
    registrationDeadline: this.registrationDeadline?.toISOString(),
    startDate: this.startDate?.toISOString(),
    endDate: this.endDate?.toISOString()
  });
  
  // Auto-open registration if tournament is upcoming and deadline hasn't passed (skip for CS2 servers)
  if (this.gameType !== 'cs2' && this.status === 'upcoming' && this.registrationDeadline && now < this.registrationDeadline) {
    console.log('✅ Auto-opening registration for upcoming tournament');
    this.status = 'registration_open';
  }
  
  // Auto-close registration if deadline passed (handles both upcoming and registration_open)
  // Skip auto-close for CS2 servers as they're always active
  if (this.gameType !== 'cs2' && 
      (this.status === 'upcoming' || this.status === 'registration_open') && 
      this.registrationDeadline && now >= this.registrationDeadline) {
    console.log('⏰ Auto-closing registration - deadline passed');
    this.status = 'registration_closed';
  }
  
  // Start tournament if start date reached (skip for CS2 servers - they should be manually managed)
  if (this.gameType !== 'cs2' && this.status === 'registration_closed' && this.startDate && now >= this.startDate) {
    console.log('🎮 Auto-starting tournament - start date reached');
    this.status = 'active';
  }
  
  // Complete tournament if end date reached (skip for CS2 servers - they should always remain active)
  if (this.gameType !== 'cs2' && this.status === 'active' && now >= this.endDate) {
    console.log('🏁 Auto-completing tournament - end date reached');
    this.status = 'completed';
  }
  
  next();
});

// Method to add participant
tournamentSchema.methods.addParticipant = function(userId, gameId, teamName = '') {
  // Check if user is already registered (skip for CS2 - they can rejoin anytime)
  const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (existingParticipant && this.gameType !== 'cs2') {
    throw new Error('User is already registered for this tournament');
  }
  
  // For CS2, if already registered, just return success (no error)
  if (existingParticipant && this.gameType === 'cs2') {
    console.log('✅ CS2 user already registered, allowing re-join');
    return this.save();
  }
  
  // Check if tournament is full
  if (this.currentParticipants >= this.maxParticipants) {
    throw new Error('Tournament is full');
  }
  
  // Check if registration is open
  // For CS2: Only allow joining if status is 'active' (server is online)
  // For others: Check traditional registration status
  if (this.gameType === 'cs2') {
    if (this.status !== 'active') {
      throw new Error('CS2 server is currently offline');
    }
  } else {
    if (!this.isRegistrationOpen) {
      throw new Error('Registration is not open for this tournament');
    }
  }
  
  this.participants.push({
    userId,
    gameId,
    teamName,
    registeredAt: new Date()
  });
  
  this.currentParticipants += 1;
  
  return this.save();
};

// Method to remove participant
tournamentSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(p => p.userId.toString() === userId.toString());
  
  if (participantIndex === -1) {
    throw new Error('User is not registered for this tournament');
  }
  
  this.participants.splice(participantIndex, 1);
  this.currentParticipants = Math.max(0, this.currentParticipants - 1);
  
  return this.save();
};

// Method to check if user is registered
tournamentSchema.methods.isUserRegistered = function(userId) {
  return this.participants.some(p => p.userId.toString() === userId.toString());
};

// Method to get participant by user ID
tournamentSchema.methods.getParticipant = function(userId) {
  return this.participants.find(p => p.userId.toString() === userId.toString());
};

// Static method to update tournament statuses (can be called manually or via cron)
tournamentSchema.statics.updateTournamentStatuses = async function() {
  const now = new Date();
  console.log('🔄 Running tournament status update check at:', now.toISOString());
  
  try {
    // Find all tournaments that might need status updates (exclude CS2)
    const tournaments = await this.find({
      gameType: { $ne: 'cs2' },
      status: { $in: ['upcoming', 'registration_open', 'registration_closed', 'active'] }
    });
    
    let updatedCount = 0;
    
    for (const tournament of tournaments) {
      let needsUpdate = false;
      let newStatus = tournament.status;
      
      // Auto-close registration if deadline passed
      if ((tournament.status === 'upcoming' || tournament.status === 'registration_open') && 
          tournament.registrationDeadline && now >= tournament.registrationDeadline) {
        newStatus = 'registration_closed';
        needsUpdate = true;
        console.log(`⏰ Closing registration for tournament: ${tournament.name}`);
      }
      
      // Start tournament if start date reached
      if (tournament.status === 'registration_closed' && 
          tournament.startDate && now >= tournament.startDate) {
        newStatus = 'active';
        needsUpdate = true;
        console.log(`🎮 Starting tournament: ${tournament.name}`);
      }
      
      // Complete tournament if end date reached
      if (tournament.status === 'active' && 
          tournament.endDate && now >= tournament.endDate) {
        newStatus = 'completed';
        needsUpdate = true;
        console.log(`🏁 Completing tournament: ${tournament.name}`);
      }
      
      if (needsUpdate) {
        await this.findByIdAndUpdate(tournament._id, { status: newStatus });
        updatedCount++;
      }
    }
    
    console.log(`✅ Tournament status update complete. Updated ${updatedCount} tournaments.`);
    return { success: true, updatedCount };
    
  } catch (error) {
    console.error('❌ Error updating tournament statuses:', error);
    return { success: false, error: error.message };
  }
};

// Static method to get tournaments with filters
tournamentSchema.statics.getFilteredTournaments = function(filters = {}) {
  const query = {};
  
  if (filters.gameType) {
    query.gameType = filters.gameType;
  }
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.entryFeeMin !== undefined || filters.entryFeeMax !== undefined) {
    query.entryFee = {};
    if (filters.entryFeeMin !== undefined) query.entryFee.$gte = filters.entryFeeMin;
    if (filters.entryFeeMax !== undefined) query.entryFee.$lte = filters.entryFeeMax;
  }
  
  if (filters.prizePoolMin !== undefined || filters.prizePoolMax !== undefined) {
    query.prizePool = {};
    if (filters.prizePoolMin !== undefined) query.prizePool.$gte = filters.prizePoolMin;
    if (filters.prizePoolMax !== undefined) query.prizePool.$lte = filters.prizePoolMax;
  }
  
  if (filters.mode) {
    query.mode = filters.mode;
  }
  
  if (filters.featured !== undefined) {
    query.featured = filters.featured;
  }
  
  return this.find(query)
    .populate('createdBy', 'username avatarUrl')
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Tournament', tournamentSchema);
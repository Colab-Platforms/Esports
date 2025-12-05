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
    required: [true, 'Tournament description is required'],
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  gameType: {
    type: String,
    required: [true, 'Game type is required'],
    enum: {
      values: ['bgmi', 'cs2'],
      message: 'Game type must be one of: bgmi, cs2'
    }
  },
  mode: {
    type: String,
    required: [true, 'Tournament mode is required'],
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
    required: [true, 'Prize pool is required'],
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
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
    // Validation removed to allow seeding
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        return value > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  registrationDeadline: {
    type: Date,
    required: [true, 'Registration deadline is required'],
    validate: {
      validator: function(value) {
        return value <= this.startDate;
      },
      message: 'Registration deadline must be before or equal to start date'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['upcoming', 'registration_open', 'registration_closed', 'active', 'completed', 'cancelled'],
      message: 'Invalid tournament status'
    },
    default: 'upcoming'
  },
  rules: {
    type: String,
    required: [true, 'Tournament rules are required'],
    maxlength: [5000, 'Rules cannot exceed 5000 characters']
  },
  format: {
    type: String,
    required: [true, 'Tournament format is required'],
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
  }
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
  const now = new Date();
  
  // Registration is open if:
  // 1. Status is 'upcoming' or 'registration_open' (not closed, active, completed, or cancelled)
  // 2. Current time is before registration deadline
  // 3. Tournament is not full
  const validStatuses = ['upcoming', 'registration_open'];
  const isValidStatus = validStatuses.includes(this.status);
  const beforeDeadline = now < this.registrationDeadline;
  const hasSpace = this.currentParticipants < this.maxParticipants;
  
  console.log('🔍 Registration Check:', {
    tournamentId: this._id,
    status: this.status,
    isValidStatus,
    beforeDeadline,
    hasSpace,
    now: now.toISOString(),
    deadline: this.registrationDeadline.toISOString(),
    currentParticipants: this.currentParticipants,
    maxParticipants: this.maxParticipants,
    result: isValidStatus && beforeDeadline && hasSpace
  });
  
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
  
  console.log('⏰ Pre-save status check:', {
    tournamentId: this._id,
    currentStatus: this.status,
    now: now.toISOString(),
    registrationDeadline: this.registrationDeadline.toISOString(),
    startDate: this.startDate.toISOString(),
    endDate: this.endDate.toISOString()
  });
  
  // Auto-open registration if tournament is upcoming and deadline hasn't passed
  if (this.status === 'upcoming' && now < this.registrationDeadline) {
    console.log('✅ Auto-opening registration for upcoming tournament');
    this.status = 'registration_open';
  }
  
  // Auto-close registration if deadline passed (handles both upcoming and registration_open)
  if ((this.status === 'upcoming' || this.status === 'registration_open') && 
      now >= this.registrationDeadline) {
    console.log('⏰ Auto-closing registration - deadline passed');
    this.status = 'registration_closed';
  }
  
  // Start tournament if start date reached
  if (this.status === 'registration_closed' && now >= this.startDate) {
    console.log('🎮 Auto-starting tournament - start date reached');
    this.status = 'active';
  }
  
  // Complete tournament if end date reached
  if (this.status === 'active' && now >= this.endDate) {
    console.log('🏁 Auto-completing tournament - end date reached');
    this.status = 'completed';
  }
  
  next();
});

// Method to add participant
tournamentSchema.methods.addParticipant = function(userId, gameId, teamName = '') {
  // Check if user is already registered
  const existingParticipant = this.participants.find(p => p.userId.toString() === userId.toString());
  if (existingParticipant) {
    throw new Error('User is already registered for this tournament');
  }
  
  // Check if tournament is full
  if (this.currentParticipants >= this.maxParticipants) {
    throw new Error('Tournament is full');
  }
  
  // Check if registration is open
  if (!this.isRegistrationOpen) {
    throw new Error('Registration is not open for this tournament');
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
    .sort({ featured: -1, startDate: 1 });
};

module.exports = mongoose.model('Tournament', tournamentSchema);
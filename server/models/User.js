const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [3, 'Full name must be at least 3 characters'],
    maxlength: [50, 'Full name cannot exceed 50 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: function() {
      return !this.authProvider || this.authProvider === 'local';
    },
    unique: true,
    sparse: true, // Allow null values for OAuth users
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  passwordHash: {
    type: String,
    required: function() {
      return !this.authProvider || this.authProvider === 'local';
    },
    minlength: [6, 'Password must be at least 6 characters']
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'steam'],
    default: 'local'
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  panCard: {
    type: String,
    default: '',
    uppercase: true,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please enter a valid PAN card number']
  },
  gameIds: {
    steam: { type: String, default: '' },
    bgmi: {
      ign: { type: String, default: '', trim: true, maxlength: [30, 'BGMI IGN cannot exceed 30 characters'] },
      uid: { type: String, default: '', sparse: true }
    },
    freefire: {
      ign: { type: String, default: '', trim: true, maxlength: [30, 'Free Fire IGN cannot exceed 30 characters'] },
      uid: { type: String, default: '', sparse: true }
    },
    valorant: { type: String, default: '' }
  },
  // Legacy fields - kept for backward compatibility, will be deprecated
  bgmiIgnName: {
    type: String,
    default: '',
    trim: true,
    maxlength: [30, 'IGN name cannot exceed 30 characters']
  },
  bgmiUid: {
    type: String,
    default: '',
    sparse: true
  },
  freeFireIgnName: {
    type: String,
    default: '',
    trim: true,
    maxlength: [30, 'Free Fire IGN name cannot exceed 30 characters']
  },
  freeFireUid: {
    type: String,
    default: '',
    sparse: true
  },
  steamProfile: {
    steamId: { type: String, default: '' },
    profileUrl: { type: String, default: '' },
    avatar: { type: String, default: '' },
    displayName: { type: String, default: '' },
    realName: { type: String, default: '' },
    countryCode: { type: String, default: '' },
    isConnected: { type: Boolean, default: false },
    connectedAt: { type: Date },
    lastSync: { type: Date }
  },
  steamGames: {
    cs2: {
      owned: { type: Boolean, default: false },
      playtime: { type: Number, default: 0 }, // minutes
      lastPlayed: { type: Date },
      achievements: { type: Number, default: 0 },
      verified: { type: Boolean, default: false }
    },
    csgo: {
      owned: { type: Boolean, default: false },
      playtime: { type: Number, default: 0 },
      lastPlayed: { type: Date },
      rank: { type: String, default: '' }
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator', 'designer'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  loginStreak: {
    type: Number,
    default: 0
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  tournamentsWon: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  achievements: [{
    name: String,
    description: String,
    earnedAt: { type: Date, default: Date.now },
    icon: String
  }],
  bio: {
    type: String,
    default: '',
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  country: {
    type: String,
    default: 'India'
  },
  state: {
    type: String,
    default: ''
  },
  favoriteGame: {
    type: String,
    default: ''
  },
  profileVisibility: {
    type: String,
    enum: ['public', 'private', 'friends'],
    default: 'public'
  },
  socialAccounts: {
    twitter: { type: String, default: '' },
    instagram: { type: String, default: '' },
    github: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    google: {
      id: { type: String, default: '' },
      email: { type: String, default: '' },
      name: { type: String, default: '' },
      picture: { type: String, default: '' },
      isConnected: { type: Boolean, default: false },
      connectedAt: { type: Date }
    }
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      tournaments: { type: Boolean, default: true },
      matches: { type: Boolean, default: true }
    },
    privacy: {
      showStats: { type: Boolean, default: true },
      showEarnings: { type: Boolean, default: false }
    }
  },
  // Security and ban-related fields
  banReason: {
    type: String,
    default: null
  },
  bannedAt: {
    type: Date,
    default: null
  },
  banExpiresAt: {
    type: Date,
    default: null
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  securityFlags: [{
    type: {
      type: String,
      enum: ['suspicious_activity', 'duplicate_account', 'cheating_suspected']
    },
    flaggedAt: { type: Date, default: Date.now },
    description: String
  }],
  lastIpAddress: {
    type: String,
    default: null
  },
  deviceFingerprint: {
    type: String,
    default: null
  },
  // Password reset fields
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for user's current rank
userSchema.virtual('currentRank').get(function () {
  if (this.level >= 50) return 'Diamond';
  if (this.level >= 30) return 'Gold';
  if (this.level >= 15) return 'Silver';
  return 'Bronze';
});

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ totalEarnings: -1 });
userSchema.index({ level: -1 });
userSchema.index({ 'steamProfile.steamId': 1 }); // For CS2 player matching
userSchema.index({ 'gameIds.steam': 1 }); // For CS2 player matching

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();

  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Update login streak
userSchema.methods.updateLoginStreak = function () {
  const now = new Date();
  const lastLogin = new Date(this.lastLogin);
  const daysDiff = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));

  if (daysDiff === 1) {
    this.loginStreak += 1;
  } else if (daysDiff > 1) {
    this.loginStreak = 1;
  }

  this.lastLogin = now;
  return this.save();
};

// Add experience and level up
userSchema.methods.addExperience = function (exp) {
  this.experience += exp;
  const newLevel = Math.floor(this.experience / 100) + 1;

  if (newLevel > this.level) {
    this.level = newLevel;
    // Add level up achievement
    this.achievements.push({
      name: `Level ${newLevel}`,
      description: `Reached level ${newLevel}!`,
      icon: '🏆'
    });
  }

  return this.save();
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);
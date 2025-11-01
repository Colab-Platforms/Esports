const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
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
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
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
    bgmi: { type: String, default: '' },
    valorant: { type: String, default: '' }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
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
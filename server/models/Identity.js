const mongoose = require('mongoose');

// One document per (provider, providerId) - represents an external account
// linked to a Colab Esports User. Used for both "login with X" and
// "connect X from settings" - the distinction is which endpoint creates the
// document (see services/auth/auth.service.js), not the data shape itself.
const identitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'userId is required'],
    index: true
  },
  provider: {
    type: String,
    enum: ['google', 'facebook', 'steam', 'xbox'],
    required: [true, 'provider is required']
  },
  // The provider's stable identifier for this account (Google sub, Facebook
  // id, Steam ID64, Xbox XUID). Xbox is a special case: its OAuth scope can't
  // be combined with an OIDC/Graph scope in the same token request (see
  // providers.config.js), so there is no separate Microsoft "sub" claim
  // available in this flow to use instead - the XUID from the Xbox Live XSTS
  // exchange is the only stable identifier this flow ever produces.
  providerId: {
    type: String,
    required: [true, 'providerId is required'],
    trim: true
  },
  // Whether this identity can be used to log in. True for every provider
  // today, but kept explicit rather than assumed.
  canLogin: {
    type: Boolean,
    default: true
  },
  email: {
    type: String,
    default: '',
    lowercase: true,
    trim: true
  },
  // Only Google reliably asserts a verified email today. Facebook/Xbox may
  // report an email that the provider itself has not verified - callers must
  // check this before using `email` for any account-matching decision.
  emailVerifiedByProvider: {
    type: Boolean,
    default: false
  },
  displayName: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  // Normalized, provider-specific profile fields (e.g. Steam profileUrl,
  // Xbox gamertag/xuid). Shape varies per provider by design.
  profile: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Larger/rawer provider data that doesn't belong on the core profile
  // (e.g. Steam owned-games snapshot). Never store raw OAuth access/refresh
  // tokens here - see the audit's note on dedicated encrypted token storage
  // if a provider (Xbox) ends up requiring persisted tokens.
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  linkedVia: {
    type: String,
    enum: ['signup', 'login-auto-consented', 'manual-connect', 'migrated'],
    default: 'signup'
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// A given external account can only ever belong to one Colab Esports user.
identitySchema.index({ provider: 1, providerId: 1 }, { unique: true });

module.exports = mongoose.model('Identity', identitySchema);

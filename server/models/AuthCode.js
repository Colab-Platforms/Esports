const mongoose = require('mongoose');

// One-time code handed to the frontend in an OAuth callback redirect,
// traded for a JWT via POST /api/auth/exchange. Replaces putting the JWT
// itself directly in the redirect URL (browser history / server access
// logs / referrer exposure).
const authCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    required: true
  },
  isNewUser: {
    type: Boolean,
    default: false
  },
  used: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // MongoDB TTL — auto-deletes the document at expiresAt
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AuthCode', authCodeSchema);

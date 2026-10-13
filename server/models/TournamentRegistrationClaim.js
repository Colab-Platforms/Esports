const mongoose = require('mongoose');

const tournamentRegistrationClaimSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true
  },
  type: {
    type: String,
    enum: ['team', 'user', 'riot'],
    required: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TournamentRegistration',
    default: null,
    required: function() {
      return this.holderType === 'registration';
    }
  },
  holderType: {
    type: String,
    enum: ['intent', 'registration'],
    default: 'registration',
    required: true
  },
  intentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistrationIntent',
    default: null,
    required: function() {
      return this.holderType === 'intent';
    }
  },
  status: {
    type: String,
    enum: ['active', 'released'],
    default: 'active',
    required: true
  },
  releasedAt: {
    type: Date,
    default: null
  },
  releaseReason: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

tournamentRegistrationClaimSchema.pre('validate', function(next) {
  if (this.holderType === 'registration' && this.intentId) {
    this.invalidate('intentId', 'Registration-owned claims cannot also reference an intent');
  }
  if (this.holderType === 'intent' && this.registrationId) {
    this.invalidate('registrationId', 'Intent-owned claims cannot also reference a registration');
  }
  next();
});

tournamentRegistrationClaimSchema.index(
  { tournamentId: 1, type: 1, value: 1 },
  { unique: true, name: 'uniq_tournament_registration_claim' }
);
tournamentRegistrationClaimSchema.index({ registrationId: 1 });
tournamentRegistrationClaimSchema.index({ intentId: 1 });
tournamentRegistrationClaimSchema.index({ status: 1, tournamentId: 1 });

module.exports = mongoose.model('TournamentRegistrationClaim', tournamentRegistrationClaimSchema);

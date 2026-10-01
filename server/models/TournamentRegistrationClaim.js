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
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

tournamentRegistrationClaimSchema.index(
  { tournamentId: 1, type: 1, value: 1 },
  { unique: true, name: 'uniq_tournament_registration_claim' }
);
tournamentRegistrationClaimSchema.index({ registrationId: 1 });

module.exports = mongoose.model('TournamentRegistrationClaim', tournamentRegistrationClaimSchema);

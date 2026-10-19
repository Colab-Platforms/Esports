const mongoose = require('mongoose');

// Only active Valorant claims are stored here. Rejection/cancellation
// releases claims inside the same transaction while preserving registration history.
const schema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentRegistration', default: null },
  intentId: { type: mongoose.Schema.Types.ObjectId, ref: 'RegistrationIntent', default: null },
  type: { type: String, enum: ['team', 'user', 'riot'], required: true },
  value: { type: String, required: true }
}, { timestamps: true });
schema.pre('validate', function(next) {
  if (Boolean(this.registrationId) === Boolean(this.intentId)) this.invalidate('registrationId', 'Exactly one claim owner is required');
  next();
});

schema.index({ tournamentId: 1, type: 1, value: 1 }, { unique: true, name: 'uniq_tournament_registration_claim' });
schema.index({ registrationId: 1 });
schema.index({ intentId: 1 });
module.exports = mongoose.model('TournamentRegistrationClaim', schema);

const mongoose = require('mongoose');
const { RESULT_STATUSES } = require('../game-results/game-results.utils');

const rosterSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  displayName: { type: String, trim: true, default: '' },
  gameId: { type: String, trim: true, default: '' },
  role: { type: String, trim: true, default: '' }
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  type: { type: String, enum: ['scoreboard_image', 'stream_clip', 'admin_link', 'other'], default: 'scoreboard_image' },
  url: { type: String, trim: true, required: true },
  description: { type: String, trim: true, default: '' },
  isPublic: { type: Boolean, default: true }
}, { _id: false });

const freeFireTeamResultSchema = new mongoose.Schema({
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentRegistration', required: true },
  canonicalTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  teamNameSnapshot: { type: String, required: true, trim: true },
  rosterSnapshot: [rosterSnapshotSchema],
  placement: { type: Number, min: 1 },
  kills: { type: Number, min: 0, default: 0 },
  placementPoints: { type: Number, min: 0, default: 0 },
  killPoints: { type: Number, min: 0, default: 0 },
  totalPoints: { type: Number, min: 0, default: 0 }
}, { _id: false });

const freeFireMatchResultSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  lobbyNumber: { type: Number, required: true, min: 1 },
  matchNumber: { type: Number, required: true, min: 1 },
  map: { type: String, trim: true, default: '' },
  status: { type: String, enum: Object.values(RESULT_STATUSES), default: RESULT_STATUSES.DRAFT },
  playedAt: { type: Date, default: null },
  teamResults: [freeFireTeamResultSchema],
  evidence: [evidenceSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  voidedAt: { type: Date, default: null },
  adminNotesPrivate: { type: String, trim: true, default: '' }
}, { timestamps: true });

freeFireMatchResultSchema.index({ tournamentId: 1, matchNumber: 1, lobbyNumber: 1 }, { unique: true });
freeFireMatchResultSchema.index({ tournamentId: 1, status: 1 });
freeFireMatchResultSchema.index({ 'teamResults.registrationId': 1 });
freeFireMatchResultSchema.index({ playedAt: -1 });

module.exports = mongoose.model('FreeFireMatchResult', freeFireMatchResultSchema);

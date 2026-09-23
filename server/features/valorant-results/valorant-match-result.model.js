const mongoose = require('mongoose');
const { RESULT_STATUSES } = require('../game-results/game-results.utils');

const rosterSnapshotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  displayName: { type: String, trim: true, default: '' },
  gameId: { type: String, trim: true, default: '' },
  role: { type: String, trim: true, default: '' }
}, { _id: false });

const valorantSideSchema = new mongoose.Schema({
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentRegistration', required: true },
  canonicalTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  teamNameSnapshot: { type: String, required: true, trim: true },
  rosterSnapshot: [rosterSnapshotSchema],
  score: { type: Number, min: 0 }
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  type: { type: String, enum: ['scoreboard_image', 'stream_clip', 'admin_link', 'other'], default: 'scoreboard_image' },
  url: { type: String, trim: true, required: true },
  description: { type: String, trim: true, default: '' },
  isPublic: { type: Boolean, default: true }
}, { _id: false });

const valorantMatchResultSchema = new mongoose.Schema({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  matchNumber: { type: Number, required: true, min: 1 },
  status: { type: String, enum: Object.values(RESULT_STATUSES), default: RESULT_STATUSES.DRAFT },
  playedAt: { type: Date, default: null },
  map: { type: String, trim: true, default: '' },
  bestOf: { type: Number, enum: [1], default: 1 },
  teamA: { type: valorantSideSchema, required: true },
  teamB: { type: valorantSideSchema, required: true },
  winnerRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentRegistration', default: null },
  serverRegion: { type: String, trim: true, default: '' },
  evidence: [evidenceSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  voidedAt: { type: Date, default: null },
  adminNotesPrivate: { type: String, trim: true, default: '' }
}, { timestamps: true });

valorantMatchResultSchema.index({ tournamentId: 1, matchNumber: 1 }, { unique: true });
valorantMatchResultSchema.index({ tournamentId: 1, status: 1 });
valorantMatchResultSchema.index({ 'teamA.registrationId': 1 });
valorantMatchResultSchema.index({ 'teamB.registrationId': 1 });
valorantMatchResultSchema.index({ winnerRegistrationId: 1 });
valorantMatchResultSchema.index({ playedAt: -1 });

module.exports = mongoose.model('ValorantMatchResult', valorantMatchResultSchema);

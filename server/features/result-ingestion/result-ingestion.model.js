const mongoose = require('mongoose');
const {
  GAME_TYPES,
  INGESTION_SOURCE_TYPES,
  INGESTION_STATUSES,
  SCOREBOARD_LAYOUTS
} = require('./result-ingestion.constants');

const candidateSchema = new mongoose.Schema({
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentRegistration' },
  teamName: { type: String, trim: true },
  canonicalTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  similarity: { type: Number, default: 0 },
  confidence: { type: String, trim: true }
}, { _id: false });

const normalizedTeamResultSchema = new mongoose.Schema({
  rowIndex: { type: Number, required: true },
  rawTeamName: { type: String, trim: true },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'TournamentRegistration', default: null },
  placement: { type: Number, default: null },
  kills: { type: Number, default: null },
  placementPoints: { type: Number, default: null },
  killPoints: { type: Number, default: null },
  totalPoints: { type: Number, default: null },
  matchConfidence: { type: String, default: 'unmatched' },
  fieldConfidence: {
    placement: { type: String, default: 'low' },
    kills: { type: String, default: 'low' },
    placementPoints: { type: String, default: 'low' },
    killPoints: { type: String, default: 'low' },
    totalPoints: { type: String, default: 'low' }
  },
  candidates: [candidateSchema],
  warnings: [{ type: String, trim: true }]
}, { _id: false });

const resultIngestionJobSchema = new mongoose.Schema({
  gameType: {
    type: String,
    enum: Object.values(GAME_TYPES),
    required: true,
    index: true
  },
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(INGESTION_STATUSES),
    default: INGESTION_STATUSES.PENDING,
    index: true
  },
  source: {
    type: {
      type: String,
      enum: Object.values(INGESTION_SOURCE_TYPES),
      default: INGESTION_SOURCE_TYPES.SCOREBOARD_IMAGE
    },
    imageUrl: { type: String, trim: true },
    publicId: { type: String, trim: true },
    imageHash: { type: String, required: true, trim: true }
  },
  input: {
    lobbyNumber: { type: Number, default: null },
    matchNumber: { type: Number, default: null },
    map: { type: String, trim: true, default: '' }
  },
  rawExtraction: {
    provider: { type: String, default: 'python-ocr' },
    rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    detectedText: { type: [String], default: [] },
    headers: { type: [String], default: [] },
    layout: {
      type: String,
      enum: Object.values(SCOREBOARD_LAYOUTS),
      default: SCOREBOARD_LAYOUTS.UNKNOWN
    },
    reasonCode: { type: String, trim: true, default: '' },
    imageMetadata: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      preprocessing: { type: [String], default: [] }
    },
    warnings: [{ type: String, trim: true }],
    message: { type: String, trim: true, default: '' }
  },
  normalizedDraft: {
    lobbyNumber: { type: Number, default: null },
    matchNumber: { type: Number, default: null },
    map: { type: String, trim: true, default: '' },
    teamResults: [normalizedTeamResultSchema]
  },
  warnings: [{ type: String, trim: true }],
  failedReason: { type: String, trim: true, default: '' },
  confirmedResultId: { type: mongoose.Schema.Types.ObjectId, ref: 'FreeFireMatchResult', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

resultIngestionJobSchema.index(
  { gameType: 1, tournamentId: 1, 'source.imageHash': 1 },
  { unique: true }
);

module.exports = mongoose.model('ResultIngestionJob', resultIngestionJobSchema);

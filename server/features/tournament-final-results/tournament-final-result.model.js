const mongoose = require('mongoose');

const teamRefSchema = new mongoose.Schema({
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TournamentRegistration',
    default: null
  },
  canonicalTeamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  teamNameSnapshot: {
    type: String,
    default: ''
  }
}, { _id: false });

const rosterSnapshotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  displayName: {
    type: String,
    trim: true,
    default: ''
  },
  gameId: {
    type: String,
    trim: true,
    default: ''
  },
  role: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: false });

const standingSchema = new mongoose.Schema({
  rank: {
    type: Number,
    required: true,
    min: 1
  },
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TournamentRegistration',
    default: null
  },
  canonicalTeamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  teamNameSnapshot: {
    type: String,
    default: ''
  },
  rosterSnapshot: {
    type: [rosterSnapshotSchema],
    default: []
  },
  matchesPlayed: {
    type: Number,
    default: null,
    min: 0
  },
  wins: {
    type: Number,
    default: null,
    min: 0
  },
  losses: {
    type: Number,
    default: null,
    min: 0
  },
  kills: {
    type: Number,
    default: null,
    min: 0
  },
  placementPoints: {
    type: Number,
    default: null,
    min: 0
  },
  killPoints: {
    type: Number,
    default: null,
    min: 0
  },
  totalPoints: {
    type: Number,
    default: null,
    min: 0
  },
  roundsWon: {
    type: Number,
    default: null,
    min: 0
  },
  roundsLost: {
    type: Number,
    default: null,
    min: 0
  },
  roundDifference: {
    type: Number,
    default: null
  },
  bestPlacement: {
    type: Number,
    default: null
  }
}, { _id: false });

const podiumSchema = new mongoose.Schema({
  rank: {
    type: Number,
    required: true,
    min: 1
  },
  registrationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TournamentRegistration',
    default: null
  },
  canonicalTeamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  teamNameSnapshot: {
    type: String,
    default: ''
  }
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: 'Official Scoreboard'
  },
  source: {
    type: String,
    enum: ['tournament_scoreboard'],
    default: 'tournament_scoreboard'
  }
}, { _id: false });

const tournamentFinalResultSchema = new mongoose.Schema({
  tournamentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tournament',
    required: true,
    unique: true,
    index: true
  },
  gameType: {
    type: String,
    enum: ['bgmi', 'freefire', 'valorant'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['unpublished', 'published', 'needs_republish', 'void'],
    default: 'unpublished',
    index: true
  },
  sourceFingerprint: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['derived', 'manual'],
    default: 'derived',
    index: true
  },
  winner: {
    type: teamRefSchema,
    default: null
  },
  podium: {
    type: [podiumSchema],
    default: []
  },
  standings: {
    type: [standingSchema],
    default: []
  },
  evidence: {
    type: [evidenceSchema],
    default: []
  },
  warnings: {
    type: [String],
    default: []
  },
  coverage: {
    structuredResultsAvailable: {
      type: Boolean,
      default: false
    },
    note: {
      type: String,
      default: ''
    }
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },
  voidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  voidedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TournamentFinalResult', tournamentFinalResultSchema);

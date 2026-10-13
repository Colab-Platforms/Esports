const mongoose = require('mongoose');

const { Schema } = mongoose;

const rosterEntrySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, trim: true, required: true },
  riotId: { type: String, trim: true, required: true },
  normalizedRiotId: { type: String, trim: true, lowercase: true, required: true },
  role: { type: String, enum: ['starter', 'substitute'], required: true }
}, { _id: false });

const riotIdSchema = new Schema({
  name: { type: String, trim: true },
  tag: { type: String, trim: true }
}, { _id: false });

const playerSnapshotSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, trim: true },
  username: { type: String, trim: true },
  phone: { type: String, trim: true },
  riotId: riotIdSchema,
  role: { type: String, enum: ['starter', 'substitute'] }
}, { _id: false });

const registrationIntentSchema = new Schema({
  gameType: { type: String, enum: ['valorant'], required: true },
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  captainUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },

  status: {
    type: String,
    enum: [
      'reserved',
      'payment_order_created',
      'payment_authorized',
      'payment_captured',
      'fulfilling',
      'fulfilled',
      'expired_unpaid',
      'cancelled',
      'failed',
      'capture_late_review',
      'refund_pending',
      'refunded'
    ],
    required: true,
    default: 'reserved'
  },

  // Boolean partial-index guard; status transitions must maintain this field.
  blocksNewIntent: { type: Boolean, default: true, required: true },

  rosterSnapshot: {
    teamName: { type: String, trim: true },
    teamLeader: playerSnapshotSchema,
    teamMembers: [playerSnapshotSchema],
    substitutePlayer: playerSnapshotSchema,
    whatsappNumber: { type: String, trim: true },
    roster: [rosterEntrySchema],
    rosterUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    normalizedRiotIds: [{ type: String, trim: true, lowercase: true }]
  },

  feeSnapshot: {
    amountMinor: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Fee amount must be an integer number of paise'
      }
    },
    currency: { type: String, enum: ['INR'], required: true },
    feeScope: { type: String, enum: ['team'], required: true },
    tournamentFeeVersion: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'Tournament fee version must be an integer'
      }
    }
  },

  reservation: {
    capacityReserved: { type: Boolean, default: false },
    capacityReleased: { type: Boolean, default: false },
    reservedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: '' }
  },

  paymentOrderId: { type: Schema.Types.ObjectId, ref: 'PaymentOrder', default: null },
  fulfilledRegistrationId: { type: Schema.Types.ObjectId, ref: 'TournamentRegistration', default: null },

  idempotencyKey: { type: String, required: true, trim: true },
  requestHash: { type: String, required: true, trim: true },
  createdByIp: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  lastError: { type: String, default: '' }
}, { timestamps: true });

registrationIntentSchema.index({ captainUserId: 1, createdAt: -1 });
registrationIntentSchema.index({ tournamentId: 1, status: 1 });
registrationIntentSchema.index({ 'reservation.expiresAt': 1, status: 1 });
registrationIntentSchema.index(
  { tournamentId: 1, teamId: 1, captainUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { blocksNewIntent: true },
    name: 'uniq_live_intent_per_team_captain_tournament'
  }
);
registrationIntentSchema.index(
  { fulfilledRegistrationId: 1 },
  {
    unique: true,
    partialFilterExpression: { fulfilledRegistrationId: { $type: 'objectId' } },
    name: 'uniq_fulfilled_registration'
  }
);
registrationIntentSchema.index(
  { captainUserId: 1, idempotencyKey: 1 },
  { unique: true, name: 'uniq_intent_idempotency_per_captain' }
);

module.exports = mongoose.model('RegistrationIntent', registrationIntentSchema);

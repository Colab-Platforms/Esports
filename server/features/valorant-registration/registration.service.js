const mongoose = require('mongoose');
const Tournament = require('../../models/Tournament');
const Team = require('../../models/Team');
const User = require('../../models/User');
const Registration = require('../../models/TournamentRegistration');
const Claim = require('./registration-claim.model');
const transactions = require('../game-results/result-transactions');
const { validateRegistrationTeam } = require('../game-results/registration-team');
const { createRegistrationError: fail, buildRosterSnapshot, buildValorantRegistrationSnapshot } = require('./roster');
const ACTIVE = ['pending', 'images_uploaded', 'verified'];

async function invalidateTournamentCache(tournamentId) {
  try {
    const redis = require('../../services/redisService');
    await redis.delete(`tournament:${tournamentId}`);
    await redis.deletePattern('tournaments:*');
  } catch { console.warn('Valorant tournament cache refresh unavailable'); }
}

function assertFree(tournament) {
  if (!tournament || tournament.gameType !== 'valorant') throw fail('TOURNAMENT_NOT_FOUND', 'Valorant tournament not found', 404);
  if (typeof tournament.entryFee !== 'number' || !Number.isFinite(tournament.entryFee) || tournament.entryFee !== 0) {
    throw fail('PAID_REGISTRATION_UNAVAILABLE', 'Only free Valorant registration is available', 409);
  }
}

async function assertClaimIndex() {
  let indexes;
  try { indexes = await Claim.collection.listIndexes().toArray(); }
  catch { throw fail('REGISTRATION_INDEX_REQUIRED', 'Registration requires reviewed database provisioning', 503); }
  const index = indexes.find(index => index.name === 'uniq_tournament_registration_claim');
  if (!index || !index.unique || index.partialFilterExpression || index.sparse || index.collation ||
      JSON.stringify(index.key) !== JSON.stringify({ tournamentId: 1, type: 1, value: 1 })) {
    throw fail('REGISTRATION_INDEX_REQUIRED', 'Registration claim index is missing or incompatible', 503);
  }
}

async function register({ tournamentId, teamId, userId }) {
  if (!mongoose.isValidObjectId(tournamentId) || !mongoose.isValidObjectId(teamId)) throw fail('INVALID_ID', 'Valid tournament and team IDs are required');
  await assertClaimIndex();
  try {
    const committed = await transactions.runTournamentMutation(tournamentId, async () => {
      const session = transactions.currentSession();
      const tournament = await Tournament.findById(tournamentId).session(session);
      assertFree(tournament);
      if (!['upcoming', 'registration_open'].includes(tournament.status) || !(tournament.registrationDeadline > new Date())) {
        throw fail('REGISTRATION_CLOSED', 'Registration is closed', 409);
      }
      // Serialize against existing Team edits without changing its schema.
      const team = await Team.findOneAndUpdate({ _id: teamId, game: 'valorant', captain: userId, isActive: true },
        { $inc: { __v: 1 } }, { new: true, session });
      if (!team) throw fail('NOT_TEAM_CAPTAIN', 'An active Valorant team owned by you is required', 403);
      const users = await User.find({ _id: { $in: team.members.map(member => member.userId) }, isActive: true })
        .select('username fullName email phone gameIds').session(session).lean();
      const roster = buildRosterSnapshot({ team, users });
      const captainUser = users.find(user => String(user._id) === String(userId));
      const snapshot = buildValorantRegistrationSnapshot({ team, rosterSnapshot: roster, captainUser });
      if (!/^[6-9]\d{9}$/.test(snapshot.whatsappNumber)) throw fail('CAPTAIN_PHONE_REQUIRED', 'The captain must save a valid phone number in Profile Settings');
      const active = await Registration.find({ tournamentId, status: { $in: ACTIVE } }).session(session).lean();
      if (active.some(row => !Array.isArray(row.roster) || row.roster.length !== 6 || !row.teamId) ||
          tournament.participants.some(participant => !active.some(row => String(row.userId) === String(participant.userId)))) {
        throw fail('LEGACY_VALORANT_REVIEW_REQUIRED', 'Existing Valorant participants require a separate compatibility review', 409);
      }
      if (tournament.currentParticipants !== active.length) throw fail('CAPACITY_STATE_MISMATCH', 'Participant count requires review before registration', 409);
      const userIds = new Set(snapshot.roster.map(member => String(member.userId)));
      const riotIds = new Set(snapshot.roster.map(member => member.normalizedRiotId));
      if (active.some(row => String(row.userId) === String(userId) || String(row.teamId) === String(teamId) ||
          row.roster.some(member => userIds.has(String(member.userId)) || riotIds.has(member.normalizedRiotId)))) {
        throw fail('REGISTRATION_CONFLICT', 'This team, player or Riot ID is already registered', 409);
      }
      const registration = new Registration({ tournamentId, userId, teamId, ...snapshot, status: 'pending' });
      const claims = [{ type: 'team', value: String(teamId) }, ...snapshot.roster.flatMap(member => [
        { type: 'user', value: String(member.userId) }, { type: 'riot', value: member.normalizedRiotId }
      ])].map(claim => ({ tournamentId, registrationId: registration._id, ...claim }));
      const reserved = await Tournament.updateOne({ _id: tournamentId, status: { $in: ['upcoming', 'registration_open'] },
        registrationDeadline: { $gt: new Date() }, currentParticipants: { $lt: tournament.maxParticipants } }, {
        $inc: { currentParticipants: 1 },
        $push: { participants: { userId, gameId: snapshot.roster.find(member => String(member.userId) === String(userId)).riotId, teamName: snapshot.teamName } }
      }, { session });
      if (reserved.modifiedCount !== 1) throw fail('TOURNAMENT_FULL', 'Tournament is full', 409);
      await Claim.insertMany(claims, { session, ordered: true });
      await registration.save({ session });
      return registration.toObject();
    });
    await invalidateTournamentCache(tournamentId);
    return committed;
  } catch (error) {
    if (error.code === 11000) throw fail('REGISTRATION_CONFLICT', 'Registration conflicts with an existing record or index; refresh or request review', 409);
    throw error;
  }
}

async function transition({ registrationId, actor, action, reason = '' }) {
  if (!mongoose.isValidObjectId(registrationId)) throw fail('INVALID_ID', 'Invalid registration ID');
  const source = await Registration.findById(registrationId).select('tournamentId').lean();
  if (!source) throw fail('REGISTRATION_NOT_FOUND', 'Registration not found', 404);
  const committed = await transactions.runTournamentMutation(source.tournamentId, async () => {
    const session = transactions.currentSession();
    const row = await Registration.findById(registrationId).session(session);
    const tournament = await Tournament.findById(source.tournamentId).session(session);
    assertFree(tournament);
    if (!row || !Array.isArray(row.roster) || row.roster.length !== 6) throw fail('LEGACY_VALORANT_REVIEW_REQUIRED', 'Registration requires a compatibility review', 409);
    const cancel = action === 'cancel';
    if (cancel ? String(row.userId) !== String(actor.userId) : !['admin', 'moderator'].includes(actor.role)) {
      throw fail('FORBIDDEN', 'You cannot manage this registration', 403);
    }
    if (!['verify', 'reject', 'cancel'].includes(action)) throw fail('INVALID_ACTION', 'Unknown registration action');
    if (!(cancel ? row.status === 'pending' : ['pending', 'images_uploaded'].includes(row.status))) {
      throw fail('REGISTRATION_LOCKED', 'This registration cannot be changed in its current status', 409);
    }
    if (!cancel && action === 'reject' && (typeof reason !== 'string' || !reason.trim() || reason.length > 500)) {
      throw fail('INVALID_REASON', 'A rejection reason of 1-500 characters is required');
    }
    const status = action === 'verify' ? 'verified' : 'rejected';
    if (status === 'verified') await validateRegistrationTeam(row, 'valorant');
    const update = { status, ...(cancel ? { rejectionReason: 'Cancelled by captain' } : {
      verifiedBy: actor.userId, verificationDate: new Date(), rejectionReason: action === 'reject' ? reason.trim() : ''
    }) };
    await Registration.updateOne({ _id: row._id, status: row.status }, { $set: update }, { session, runValidators: true });
    if (status === 'rejected') {
      const count = await Registration.countDocuments({ tournamentId: tournament._id, status: { $in: ACTIVE } }).session(session);
      // Preserve the same fail-closed counter check used on registration.
      if (tournament.currentParticipants !== count + 1) throw fail('CAPACITY_STATE_MISMATCH', 'Participant count requires review', 409);
      await Claim.deleteMany({ registrationId: row._id }).session(session);
      await Tournament.updateOne({ _id: tournament._id }, { $inc: { currentParticipants: -1 }, $pull: { participants: { userId: row.userId } } }, { session });
    }
    return { ...row.toObject(), ...update };
  });
  await invalidateTournamentCache(source.tournamentId);
  return committed;
}

module.exports = { register, transition, assertFree, assertClaimIndex, ACTIVE };

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const Registration = require('../../models/TournamentRegistration');
const Tournament = require('../../models/Tournament');
const service = require('./registration.service');
const { requireResultManager } = require('../game-results/game-results.utils');
const router = express.Router();
const route = handler => async (req, res) => {
  try { await handler(req, res); }
  catch (error) {
    res.status(error.status || 500).json({ success: false, error: {
      code: typeof error.code === 'string' ? error.code : 'REGISTRATION_FAILED',
      message: error.status ? error.message : 'Registration could not be completed; refresh and retry'
    } });
  }
};
const validId = id => { if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Invalid ID'), { status: 400, code: 'INVALID_ID' }); };

router.get('/my-registrations', auth, route(async (req, res) => {
  const filter = { userId: req.user.userId, 'roster.0': { $exists: true } };
  if (req.query.tournamentId !== undefined) { validId(req.query.tournamentId); filter.tournamentId = req.query.tournamentId; }
  const rows = await Registration.find(filter)
    .select('tournamentId teamId teamName status registeredAt rejectionReason roster payment')
    .populate('tournamentId', 'name gameType status').sort({ registeredAt: -1 }).limit(100).lean();
  const registrations = await Promise.all(rows.filter(row => row.tournamentId?.gameType === 'valorant').map(async row => {
    if (!row.payment?.paymentOrderId) return row;
    const { Receipt, Review } = require('../payments/payment.service').models;
    const [receipt, refundReview] = await Promise.all([
      Receipt.findOne({ paymentOrderId: row.payment.paymentOrderId }).select('receiptNumber amountMinor currency capturedAt').lean(),
      Review.findOne({ paymentOrderId: row.payment.paymentOrderId }).select('status providerStatus refundedAt').lean()
    ]);
    return { ...row, receipt, refundReview };
  }));
  res.json({ success: true, data: { registrations } });
}));

router.get('/tournament/:tournamentId/teams', route(async (req, res) => {
  validId(req.params.tournamentId);
  const tournament = await Tournament.findOne({ _id: req.params.tournamentId, gameType: 'valorant' }).select('_id').lean();
  if (!tournament) return res.status(404).json({ success: false, error: { code: 'TOURNAMENT_NOT_FOUND' } });
  const teams = await Registration.find({ tournamentId: tournament._id, status: { $in: service.ACTIVE } })
    .select('teamName status registeredAt').sort({ registeredAt: 1 }).limit(1000).lean();
  res.json({ success: true, data: { teams } });
}));

router.get('/admin/tournament/:tournamentId', auth, requireResultManager, route(async (req, res) => {
  validId(req.params.tournamentId);
  const tournament = await Tournament.findOne({ _id: req.params.tournamentId, gameType: 'valorant' }).select('_id').lean();
  if (!tournament) return res.status(404).json({ success: false, error: { code: 'TOURNAMENT_NOT_FOUND' } });
  const page = Number(req.query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000) return res.status(400).json({ success: false, error: { code: 'INVALID_PAGE' } });
  const filter = { tournamentId: tournament._id };
  const [registrations, total] = await Promise.all([
    Registration.find(filter).select('userId teamId teamName status registeredAt rejectionReason roster payment')
      .sort({ registeredAt: -1, _id: -1 }).skip((page - 1) * 100).limit(100).lean(),
    Registration.countDocuments(filter)
  ]);
  res.json({ success: true, data: { registrations, pagination: { page, hasNext: total > page * 100 } } });
}));

router.post('/:tournamentId/register', auth, route(async (req, res) => {
  const registration = await service.register({ tournamentId: req.params.tournamentId, teamId: req.body.teamId, userId: req.user.userId });
  res.status(201).json({ success: true, data: { registration }, message: 'Team registered; awaiting admin verification' });
}));
router.post('/:registrationId/:action(verify|reject|cancel)', auth, route(async (req, res) => {
  const registration = await service.transition({ registrationId: req.params.registrationId, actor: req.user, action: req.params.action, reason: req.body.reason });
  res.json({ success: true, data: { registration } });
}));
module.exports = router;

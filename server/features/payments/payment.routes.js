const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const service = require('./payment.service');
const { Intent, Receipt, Review, Order } = service.models;
const router = express.Router();
const safeCodes = new Set(['PAYMENTS_DISABLED', 'PAYMENT_RECOVERY_DISABLED', 'CHECKOUT_PAUSED', 'INVALID_ID', 'INVALID_IDEMPOTENCY_KEY', 'PAYMENT_INDEX_REQUIRED', 'REGISTRATION_INDEX_REQUIRED',
  'IDEMPOTENCY_CONFLICT', 'PAYMENT_NOT_REQUIRED', 'REGISTRATION_CONFLICT', 'TOURNAMENT_FULL', 'FORBIDDEN', 'RESERVATION_EXPIRED',
  'PAYMENT_REQUIRES_RECONCILIATION', 'ORDER_NOT_PAYABLE', 'INVALID_PAYMENT_SIGNATURE', 'PAYMENT_MISMATCH', 'PAYMENT_ID_CONFLICT',
  'INVALID_WEBHOOK_SIGNATURE', 'INVALID_WEBHOOK', 'WEBHOOK_EVENT_CONFLICT', 'EVENT_RETRY_REQUIRED', 'INTENT_NOT_FOUND',
  'REVIEW_NOT_FOUND', 'INVALID_REFUND', 'REFUND_MISMATCH', 'INVALID_DECISION', 'REVIEW_NOT_APPROVED', 'REVIEW_LOCKED', 'INVALID_PAGE',
  'RAZORPAY_NOT_CONFIGURED', 'RAZORPAY_MODE_MISMATCH', 'RAZORPAY_WEBHOOK_SECRET_MISSING', 'REGISTRATION_CLOSED', 'NOT_TEAM_CAPTAIN',
  'MISSING_RIOT_ID', 'CAPTAIN_PHONE_REQUIRED', 'LEGACY_VALORANT_REVIEW_REQUIRED', 'CAPACITY_STATE_MISMATCH', 'INVALID_FEE']);
const route = handler => async (req, res) => {
  try { res.json({ success: true, data: await handler(req) }); }
  catch (error) { res.status(error.status || 503).json({ success: false, error: {
    code: safeCodes.has(error.code) ? error.code : 'PAYMENT_SERVICE_UNAVAILABLE',
    message: safeCodes.has(error.code) ? `Payment operation stopped (${error.code}); refresh status before retrying` : 'Payment operation is unavailable; refresh status before retrying'
  } }); }
};
router.use(auth);
router.post('/intents', route(req => service.createIntent({ ...req.body, userId: req.user.userId })));
router.post('/intents/:intentId/order', route(req => service.createOrder({ intentId: req.params.intentId, userId: req.user.userId, idempotencyKey: req.body.idempotencyKey })));
router.post('/intents/:intentId/recover', route(req => service.recoverCheckout({ intentId: req.params.intentId, userId: req.user.userId })));
router.post('/verify', route(req => service.verify({ ...req.body, userId: req.user.userId })));
router.get('/my-attempts', route(async req => {
  if (!mongoose.isValidObjectId(req.query.tournamentId)) throw Object.assign(new Error('Invalid tournament'), { status: 400, code: 'INVALID_ID' });
  return { attempts: await Intent.find({ captainUserId: req.user.userId, tournamentId: req.query.tournamentId,
    status: { $nin: ['fulfilled', 'expired_unpaid', 'cancelled', 'refunded'] } }).sort({ createdAt: -1 }).limit(10).select('status reservation.expiresAt feeSnapshot') };
}));
router.get('/intents/:intentId', route(async req => {
  if (!mongoose.isValidObjectId(req.params.intentId)) throw Object.assign(new Error('Invalid intent ID'), { status: 400, code: 'INVALID_ID' });
  const intent = await Intent.findOne({ _id: req.params.intentId, captainUserId: req.user.userId })
    .select('status reservation.expiresAt feeSnapshot fulfilledRegistrationId paymentOrderId');
  if (!intent) throw Object.assign(new Error('Reservation not found'), { status: 404, code: 'INTENT_NOT_FOUND' });
  const receipt = intent.paymentOrderId ? await Receipt.findOne({ paymentOrderId: intent.paymentOrderId }).select('receiptNumber amountMinor currency capturedAt') : null;
  return { intent, receipt };
}));
router.get('/active', route(async req => {
  const { tournamentId, teamId } = req.query;
  if (![tournamentId, teamId].every(mongoose.isValidObjectId)) throw Object.assign(new Error('Invalid selection'), { status: 400, code: 'INVALID_ID' });
  let intent = await Intent.findOne({ tournamentId, teamId, captainUserId: req.user.userId,
    status: { $nin: ['expired_unpaid', 'cancelled', 'refunded', 'failed'] } }).sort({ createdAt: -1 }).select('status reservation.expiresAt feeSnapshot fulfilledRegistrationId paymentOrderId');
  if (intent?.fulfilledRegistrationId && !await require('../../models/TournamentRegistration').exists({ _id: intent.fulfilledRegistrationId, status: { $in: ['pending', 'images_uploaded', 'verified'] } })) intent = null;
  return { intent };
}));
router.use((req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } }));
router.get('/refund-reviews', route(async req => {
  const page = Number(req.query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000) throw Object.assign(new Error('Invalid page'), { status: 400, code: 'INVALID_PAGE' });
  const rows = await Review.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(26).lean();
  const reviews = await Promise.all(rows.slice(0, 25).map(async row => ({ ...row, paymentOrder: await Order.findById(row.paymentOrderId).select('amountMinor currency gatewayPaymentId') })));
  return { reviews, hasNext: rows.length > 25 };
}));
router.post('/refund-reviews/:reviewId', route(req => service.reviewRefund({ reviewId: req.params.reviewId, actor: req.user, decision: req.body.decision, reason: req.body.reason, refundId: req.body.refundId })));
module.exports = router;
module.exports.safeRoute = route;

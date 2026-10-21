// Adapted from dev's intent/order/receipt foundation. All financial state writes
// share the candidate's tournament lock; provider calls are outside transactions.
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Tournament = require('../../models/Tournament');
const Registration = require('../../models/TournamentRegistration');
const User = require('../../models/User');
const Claim = require('../valorant-registration/registration-claim.model');
const registration = require('../valorant-registration/registration.service');
const tx = require('../game-results/result-transactions');
const Intent = require('../registration-intents/registration-intent.model');
const Order = require('./payment-order.model');
const Event = require('./payment-event.model');
const Receipt = require('./payment-receipt.model');
const Notification = require('./payment-notification-intent.model');
const Review = require('./refund-review.model');
const features = require('../../config/paymentFeatures');
const ownerPolicy = require('../valorant-registration/owner-index-policy');
const { RazorpayAdapter } = require('./razorpay.adapter');
const { createRegistrationError: fail } = require('../valorant-registration/roster');
const financialModels = [Intent, Order, Event, Receipt, Notification, Review];
const enabled = () => {
  if (!features.enabled()) throw fail('PAYMENTS_DISABLED', 'Paid registration is unavailable', 503);
  if (process.env.VALORANT_PAYMENT_WORKER_ENABLED !== 'true') throw fail('PAYMENT_RECOVERY_DISABLED', 'Payment reconciliation must be enabled before accepting checkout', 503);
};
const validId = value => { if (!mongoose.isValidObjectId(value)) throw fail('INVALID_ID', 'Invalid record ID'); };
const key = value => { if (typeof value !== 'string' || !/^[\w-]{8,128}$/.test(value)) throw fail('INVALID_IDEMPOTENCY_KEY', 'A stable request key is required'); return value; };
const gateway = options => options?.adapter || new RazorpayAdapter();
const session = () => tx.currentSession();
const locked = (tournamentId, action) => tx.runTournamentMutation(tournamentId, action);
const indexesEqual = (actual, expectedKey, options) => actual && actual.unique === true && !actual.sparse && !actual.collation &&
  JSON.stringify(actual.key) === JSON.stringify(expectedKey) &&
  JSON.stringify(actual.partialFilterExpression || null) === JSON.stringify(options.partialFilterExpression || null);

async function assertIndexes() {
  await registration.assertClaimIndex();
  // Never init(), syncIndexes() or createIndexes() on a request path.
  for (const Model of [...financialModels, Registration]) {
    let physical;
    try { physical = await Model.collection.listIndexes().toArray(); }
    catch { throw fail('PAYMENT_INDEX_REQUIRED', 'Reviewed payment database provisioning is required', 503); }
    // A rejected registration is retained. This legacy index would let a retry
    // pay, then prevent inserting its new registration during settlement.
    if (Model === Registration && physical.some(ownerPolicy.isUnconditionalOwnerIndex)) {
      throw fail('PAYMENT_INDEX_REQUIRED', 'Legacy unique registration owner index requires reviewed compatibility resolution', 503);
    }
    for (const [fields, options] of Model.schema.indexes().filter(([, opts]) => opts.unique && opts.name)) {
      if (!indexesEqual(physical.find(i => i.name === options.name), fields, options)) throw fail('PAYMENT_INDEX_REQUIRED', 'A required payment index is missing or incompatible', 503);
    }
  }
}

function amountFor(tournament) {
  const fee = tournament?.entryFee;
  if (tournament?.gameType !== 'valorant' || typeof fee !== 'number' || fee < 0 || fee > 10000 || !Number.isSafeInteger(fee * 100)) throw fail('INVALID_FEE', 'Invalid Valorant registration fee');
  return fee * 100;
}

async function createIntent({ userId, tournamentId, teamId, idempotencyKey }) {
  enabled(); validId(tournamentId); validId(teamId); key(idempotencyKey); await assertIndexes();
  if (features.checkoutPaused()) throw fail('CHECKOUT_PAUSED', 'New checkout is temporarily paused', 503);
  try {
    const result = await locked(tournamentId, async () => {
      const previous = await Intent.findOne({ captainUserId: userId, idempotencyKey }).session(session());
      if (previous) {
        if (String(previous.tournamentId) !== String(tournamentId) || String(previous.teamId) !== String(teamId)) throw fail('IDEMPOTENCY_CONFLICT', 'Request key belongs to another selection', 409);
        return previous;
      }
      const tournament = await Tournament.findById(tournamentId).session(session());
      const amountMinor = amountFor(tournament);
      if (!amountMinor) throw fail('PAYMENT_NOT_REQUIRED', 'Use direct registration for a free tournament', 409);
      const { snapshot } = await registration.prepare(tournament, session(), userId, teamId);
      if (tournament.currentParticipants >= tournament.maxParticipants) throw fail('TOURNAMENT_FULL', 'Tournament is full', 409);
      const expiresAt = new Date(Math.min(Date.now() + features.reservationMs, tournament.registrationDeadline.getTime()));
      const intent = new Intent({ gameType: 'valorant', tournamentId, captainUserId: userId, teamId, idempotencyKey,
        requestHash: crypto.createHash('sha256').update(`${tournamentId}:${teamId}`).digest('hex'),
        status: 'reserved', blocksNewIntent: true,
        rosterSnapshot: { ...snapshot, rosterUserIds: snapshot.roster.map(p => p.userId), normalizedRiotIds: snapshot.roster.map(p => p.normalizedRiotId) },
        feeSnapshot: { amountMinor, currency: 'INR', feeScope: 'team', tournamentFeeVersion: 1 },
        reservation: { capacityReserved: true, capacityReleased: false, reservedAt: new Date(), expiresAt }
      });
      const claims = [{ type: 'team', value: String(teamId) }, ...snapshot.roster.flatMap(p => [
        { type: 'user', value: String(p.userId) }, { type: 'riot', value: p.normalizedRiotId }
      ])].map(c => ({ ...c, tournamentId, intentId: intent._id }));
      await Claim.insertMany(claims, { session: session() });
      await intent.save({ session: session() });
      await Tournament.updateOne({ _id: tournamentId }, { $inc: { currentParticipants: 1 } }, { session: session() });
      return intent;
    });
    await registration.invalidateTournamentCache(tournamentId);
    return result;
  } catch (error) {
    if (error.code === 11000) throw fail('REGISTRATION_CONFLICT', 'Team, player, Riot ID or request is already reserved', 409);
    throw error;
  }
}

function checkProviderPayment(order, payment) {
  if (!payment || payment.order_id !== order.gatewayOrderId || payment.amount !== order.amountMinor || payment.currency !== order.currency || !/^pay_[\w]+$/.test(payment.id || '')) throw fail('PAYMENT_MISMATCH', 'Provider payment does not match this order', 409);
}
function checkProviderOrder(order, remote) {
  if (!remote || remote.amount !== order.amountMinor || remote.currency !== order.currency || remote.receipt !== order.providerReceipt ||
      (order.gatewayOrderId && remote.id !== order.gatewayOrderId) || remote.notes?.paymentOrderId !== String(order._id) || remote.notes?.intentId !== String(order.intentId)) throw fail('ORDER_MISMATCH', 'Provider order does not match this reservation', 409);
}
const checkout = order => ({ paymentOrderId: order._id, razorpayOrderId: order.gatewayOrderId, amountMinor: order.amountMinor, currency: order.currency });

async function createOrder({ userId, intentId, idempotencyKey }, options) {
  enabled(); validId(intentId); key(idempotencyKey); await assertIndexes();
  if (features.checkoutPaused()) throw fail('CHECKOUT_PAUSED', 'New checkout is temporarily paused', 503);
  const adapter = gateway(options);
  const source = await Intent.findById(intentId);
  if (!source || String(source.captainUserId) !== String(userId)) throw fail('FORBIDDEN', 'Reservation is not owned by you', 403);
  let created = false;
  const order = await locked(source.tournamentId, async () => {
    created = false; // MongoDB may retry the transaction callback.
    const intent = await Intent.findById(intentId).session(session());
    const tournament = await Tournament.findById(intent.tournamentId).session(session());
    if (intent.reservation.capacityReleased || intent.reservation.expiresAt <= new Date() || !['reserved', 'payment_order_created'].includes(intent.status) || !['upcoming', 'registration_open'].includes(tournament.status)) throw fail('RESERVATION_EXPIRED', 'Reservation is no longer payable', 409);
    const existing = await Order.findOne({ intentId, isLiveOrder: true }).session(session());
    if (existing) return existing;
    const local = new Order({ intentId, purpose: 'tournament_registration', gameType: 'valorant', tournamentId: intent.tournamentId,
      captainUserId: userId, gateway: 'razorpay', amountMinor: intent.feeSnapshot.amountMinor, currency: 'INR',
      providerReceipt: `valorant_reg_${intentId}`, idempotencyKey });
    await local.save({ session: session() });
    intent.paymentOrderId = local._id; intent.status = 'payment_order_created'; await intent.save({ session: session() });
    created = true; return local;
  });
  if (!created && !order.gatewayOrderId) throw fail('PAYMENT_REQUIRES_RECONCILIATION', 'Order creation is pending or uncertain; do not start another payment', 409);
  if (created) {
    let remote;
    try {
      remote = await adapter.createOrder({ amountMinor: order.amountMinor, currency: order.currency, receipt: order.providerReceipt,
        notes: { paymentOrderId: String(order._id), intentId: String(order.intentId) } });
      checkProviderOrder(order, remote);
      await locked(order.tournamentId, async () => {
        await Order.updateOne({ _id: order._id, gatewayOrderId: null }, { $set: { gatewayOrderId: remote.id, status: 'created' } }, { session: session() });
      });
      order.gatewayOrderId = remote.id;
    } catch {
      await Order.updateOne({ _id: order._id, gatewayOrderId: null }, { $set: { status: 'provider_create_unknown', lastError: 'PROVIDER_CREATE_REQUIRES_RECONCILIATION' } });
      throw fail('PAYMENT_REQUIRES_RECONCILIATION', 'Order outcome is uncertain; do not retry payment until reconciled', 409);
    }
  }
  const remote = await adapter.fetchOrder(order.gatewayOrderId); checkProviderOrder(order, remote);
  if (!['created', 'attempted'].includes(remote.status)) throw fail('ORDER_NOT_PAYABLE', 'Refresh the existing payment status', 409);
  return { ...checkout(order), keyId: adapter.getPublicConfig().keyId };
}

async function release(intent, reason) {
  if (!intent.reservation.capacityReserved || intent.reservation.capacityReleased || intent.status === 'fulfilled') return;
  const removed = await Claim.deleteMany({ intentId: intent._id }).session(session());
  if (removed.deletedCount !== 13) throw fail('CLAIM_STATE_MISMATCH', 'Reservation claims require review', 409);
  const updated = await Tournament.updateOne({ _id: intent.tournamentId, currentParticipants: { $gt: 0 } }, { $inc: { currentParticipants: -1 } }, { session: session() });
  if (updated.modifiedCount !== 1) throw fail('CAPACITY_STATE_MISMATCH', 'Reservation count requires review', 409);
  intent.reservation.capacityReleased = true; intent.reservation.releasedAt = new Date(); intent.reservation.releaseReason = reason;
  intent.status = 'expired_unpaid'; intent.blocksNewIntent = false; await intent.save({ session: session() });
}

async function settle(orderId, payment, options = {}) {
  const source = await Order.findById(orderId);
  if (!source) throw fail('ORDER_NOT_FOUND', 'Payment order not found', 404);
  checkProviderPayment(source, payment);
  // Preserve captured-money evidence even if registration/receipt persistence
  // subsequently rolls back. Recovery must not depend on the browser returning.
  if (payment.status === 'captured') await locked(source.tournamentId, async () => {
    const fresh = await Order.findById(orderId).session(session());
    if (fresh.gatewayPaymentId && fresh.gatewayPaymentId !== payment.id) throw fail('PAYMENT_ID_CONFLICT', 'Another payment is associated with this order', 409);
    fresh.gatewayPaymentId = payment.id; fresh.status = 'captured'; fresh.capturedAt = fresh.capturedAt || new Date();
    if (fresh.fulfillmentStatus !== 'fulfilled') fresh.fulfillmentStatus = 'captured_unfulfilled';
    await fresh.save({ session: session() });
  });
  const result = await locked(source.tournamentId, async () => {
    const order = await Order.findById(orderId).session(session()); checkProviderPayment(order, payment);
    const intent = await Intent.findById(order.intentId).session(session());
    if (!intent || String(intent.paymentOrderId) !== String(order._id) || intent.feeSnapshot.amountMinor !== order.amountMinor || intent.feeSnapshot.currency !== order.currency) throw fail('PAYMENT_MISMATCH', 'Reservation and payment disagree', 409);
    const existing = await Registration.findOne({ 'payment.paymentOrderId': order._id }).session(session());
    // Failed attempts and older authorized events can never downgrade captured money.
    if (existing) return { registrationId: existing._id, registrationStatus: existing.status, alreadyProcessed: true };
    if (payment.status !== 'captured') {
      if (order.status !== 'captured') {
        order.status = payment.status === 'authorized' ? 'authorized' : 'created'; order.lastVerifiedAt = new Date();
        await order.save({ session: session() });
      }
      return { paymentStatus: payment.status, registrationId: null };
    }
    if (order.gatewayPaymentId && order.gatewayPaymentId !== payment.id) throw fail('PAYMENT_ID_CONFLICT', 'Payment requires operational review', 409);
    order.gatewayPaymentId = payment.id; order.status = 'captured'; order.capturedAt = order.capturedAt || new Date(); order.lastVerifiedAt = new Date();
    const tournament = await Tournament.findById(intent.tournamentId).session(session());
    const expired = intent.reservation.expiresAt <= new Date() || intent.reservation.capacityReleased || !['upcoming', 'registration_open'].includes(tournament.status);
    if (expired) {
      if (!intent.reservation.capacityReleased) await release(intent, 'late_capture');
      intent.status = 'capture_late_review'; intent.blocksNewIntent = true; await intent.save({ session: session() });
      order.fulfillmentStatus = 'captured_unfulfilled'; await order.save({ session: session() });
      await Review.findOneAndUpdate({ paymentOrderId: order._id }, { $setOnInsert: { reason: 'late_capture' } }, { session: session(), upsert: true, new: true });
      return { paymentStatus: 'captured', reviewRequired: true, registrationId: null };
    }
    if (tournament.currentParticipants !== await Registration.countDocuments({ tournamentId: tournament._id, status: { $in: registration.ACTIVE } }).session(session()) + await registration.heldReservations(tournament._id, session())) throw fail('CAPACITY_STATE_MISMATCH', 'Capacity requires review before settlement', 409);
    const row = new Registration({ tournamentId: intent.tournamentId, userId: intent.captainUserId, teamId: intent.teamId,
      ...intent.rosterSnapshot.toObject(), registrationFlow: ownerPolicy.flow, status: 'pending', payment: { status: 'paid', intentId: intent._id, paymentOrderId: order._id, amountMinor: order.amountMinor, currency: 'INR', paidAt: order.capturedAt } });
    const held = await Claim.find({ intentId: intent._id, registrationId: null }).session(session()).lean();
    const expected = new Set([`team:${intent.teamId}`, ...row.roster.flatMap(p => [`user:${p.userId}`, `riot:${p.normalizedRiotId}`])]);
    if (held.length !== 13 || expected.size !== 13 || held.some(c => String(c.tournamentId) !== String(intent.tournamentId) || !expected.has(`${c.type}:${c.value}`))) throw fail('CLAIM_STATE_MISMATCH', 'Roster claims do not match the payment reservation', 409);
    const transferred = await Claim.updateMany({ intentId: intent._id, registrationId: null }, { $set: { registrationId: row._id }, $unset: { intentId: '' } }, { session: session() });
    if (transferred.modifiedCount !== 13) throw fail('CLAIM_STATE_MISMATCH', 'All thirteen claims are required', 409);
    if (options.failDuringFulfillment) throw fail('SIMULATED_FAILURE', 'Disposable test rollback probe', 500);
    await row.save({ session: session() });
    await Tournament.updateOne({ _id: tournament._id, 'participants.userId': { $ne: intent.captainUserId } }, { $push: { participants: {
      userId: intent.captainUserId, gameId: row.roster.find(p => String(p.userId) === String(intent.captainUserId)).riotId, teamName: row.teamName
    } } }, { session: session() });
    intent.status = 'fulfilled'; intent.blocksNewIntent = false; intent.fulfilledRegistrationId = row._id; await intent.save({ session: session() });
    order.fulfillmentStatus = 'fulfilled'; await order.save({ session: session() });
    const receipt = await Receipt.findOneAndUpdate({ paymentOrderId: order._id }, { $setOnInsert: {
      receiptNumber: `CE-${order._id}`, registrationIntentId: intent._id, tournamentRegistrationId: row._id,
      tournamentId: intent.tournamentId, captainUserId: intent.captainUserId, teamName: row.teamName,
      amountMinor: order.amountMinor, currency: 'INR', gateway: 'razorpay', gatewayPaymentId: payment.id, capturedAt: order.capturedAt
    } }, { upsert: true, new: true, session: session() });
    const captain = await User.findById(intent.captainUserId).session(session()).select('email');
    if (captain?.email) await Notification.findOneAndUpdate({ type: 'payment_receipt_email', paymentOrderId: order._id, recipientUserId: intent.captainUserId },
      { $setOnInsert: { receiptId: receipt._id, recipientEmail: captain.email, status: 'pending', maxAttempts: features.paymentReceiptEmailMaxAttempts } }, { session: session(), upsert: true, new: true });
    return { paymentStatus: 'captured', registrationId: row._id, registrationStatus: 'pending' };
  });
  await registration.invalidateTournamentCache(source.tournamentId); return result;
}

async function verify({ userId, paymentOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }, options) {
  enabled(); validId(paymentOrderId); await assertIndexes();
  const order = await Order.findById(paymentOrderId);
  if (!order || String(order.captainUserId) !== String(userId)) throw fail('FORBIDDEN', 'Payment is not owned by you', 403);
  const adapter = gateway(options);
  if (order.gatewayOrderId !== razorpay_order_id || !adapter.verifyCheckoutSignature({ orderId: order.gatewayOrderId, paymentId: razorpay_payment_id, signature: razorpay_signature })) throw fail('INVALID_PAYMENT_SIGNATURE', 'Invalid payment signature');
  return settle(order._id, await adapter.fetchPayment(razorpay_payment_id), options);
}

async function processEvent(eventId, options) {
  const now = new Date();
  const event = await Event.findOneAndUpdate({ _id: eventId, processingStatus: { $nin: ['processed', 'ignored'] },
    $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] }, { $set: { processingStatus: 'processing', lockedUntil: new Date(now.getTime() + 120000) }, $inc: { processingAttempts: 1 } }, { new: true });
  if (!event) return;
  const lease = { _id: event._id, processingStatus: 'processing', lockedUntil: event.lockedUntil };
  try {
    if (!['payment.captured', 'payment.authorized', 'payment.failed'].includes(event.eventType)) {
      await Event.updateOne(lease, { $set: { processingStatus: 'ignored', lockedUntil: null } }); return;
    }
    const adapter = gateway(options);
    const payment = await adapter.fetchPayment(event.gatewayPaymentId);
    let order = await Order.findOne({ gatewayOrderId: payment.order_id });
    if (!order) {
      const remote = await adapter.fetchOrder(payment.order_id);
      validId(remote.notes?.paymentOrderId);
      order = await Order.findById(remote.notes.paymentOrderId);
      if (!order) throw fail('ORDER_NOT_FOUND', 'Webhook order is not yet associated', 409);
      checkProviderOrder(order, remote);
      await locked(order.tournamentId, async () => {
        await Order.updateOne({ _id: order._id, gatewayOrderId: null }, { $set: { gatewayOrderId: remote.id } }, { session: session() });
      }); order = await Order.findById(order._id);
    }
    await settle(order._id, payment, options);
    await Event.updateOne(lease, { $set: { processingStatus: 'processed', processedAt: new Date(), lockedUntil: null, paymentOrderId: order._id, intentId: order.intentId, lastError: '' } });
  } catch {
    await Event.updateOne(lease, { $set: { processingStatus: 'failed', lockedUntil: null, lastError: 'EVENT_RETRY_REQUIRED' } });
    throw fail('EVENT_RETRY_REQUIRED', 'Webhook saved for reconciliation', 503);
  }
}

async function webhook({ rawBody, signature, eventId }, options) {
  enabled(); await assertIndexes(); const adapter = gateway(options);
  if (!Buffer.isBuffer(rawBody) || !adapter.verifyWebhookSignature(rawBody, signature)) throw fail('INVALID_WEBHOOK_SIGNATURE', 'Invalid webhook signature');
  let payload; try { payload = JSON.parse(rawBody.toString('utf8')); } catch { throw fail('INVALID_WEBHOOK', 'Invalid webhook body'); }
  const payment = payload.payload?.payment?.entity;
  const hash = crypto.createHash('sha256').update(rawBody).digest('hex');
  if (eventId !== undefined && (typeof eventId !== 'string' || !/^[\w-]{1,200}$/.test(eventId))) throw fail('INVALID_WEBHOOK', 'Invalid event identifier');
  const id = eventId || hash;
  let event;
  try { event = await Event.create({ gateway: 'razorpay', gatewayEventId: id, eventType: payload.event || 'unknown',
    gatewayPaymentId: payment?.id || null, gatewayOrderId: payment?.order_id || null, signatureVerified: true, payloadHash: hash }); }
  catch (error) { if (error.code !== 11000) throw error; event = await Event.findOne({ gateway: 'razorpay', gatewayEventId: id }); }
  if (event.payloadHash !== hash) throw fail('WEBHOOK_EVENT_CONFLICT', 'Event identity conflicts with its original payload', 409);
  await processEvent(event._id, options);
  return { accepted: true };
}

async function reconcile(options = {}) {
  enabled(); await assertIndexes(); const adapter = gateway(options); const outcomes = [];
  const events = await Event.find({ processingStatus: { $nin: ['processed', 'ignored'] }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: new Date() } }] }).sort({ createdAt: 1 }).limit(25);
  for (const event of events) { try { await processEvent(event._id, options); } catch { /* durable next scan */ } }
  const intents = await Intent.find({ $or: [
    { status: { $nin: ['fulfilled', 'expired_unpaid', 'cancelled', 'refunded', 'refund_pending'] } },
    { status: 'expired_unpaid', paymentOrderId: { $ne: null } }
  ] }).sort({ updatedAt: 1, _id: 1 }).limit(25);
  for (const source of intents) {
    try {
      // Once the deadline passes no settlement path may confirm this attempt.
      // Release its slot even during a provider outage; keep the financial order
      // for reconciliation and route any later captured money to manual review.
      if (source.reservation.expiresAt <= new Date()) await locked(source.tournamentId, async () => {
        const fresh = await Intent.findById(source._id).session(session());
        if (fresh.status !== 'fulfilled') await release(fresh, 'expired_unpaid');
      });
      let order = await Order.findOne({ intentId: source._id });
      if (order && !order.gatewayOrderId) {
        const response = await adapter.findOrdersByReceipt(order.providerReceipt);
        if (!Array.isArray(response?.items) || response.items.length !== 1) throw fail('ORDER_UNKNOWN', 'Provider order needs review', 409);
        const remote = response.items[0]; checkProviderOrder(order, remote);
        await locked(source.tournamentId, async () => { await Order.updateOne({ _id: order._id, gatewayOrderId: null }, { $set: { gatewayOrderId: remote.id, status: 'created' } }, { session: session() }); });
        order = await Order.findById(order._id);
      }
      if (order) {
        const remote = await adapter.fetchOrder(order.gatewayOrderId); checkProviderOrder(order, remote);
        const payments = await adapter.fetchOrderPayments(order.gatewayOrderId);
        if (!Array.isArray(payments?.items) || !Number.isInteger(payments.count) || payments.items.length !== payments.count) throw fail('PROVIDER_STATE_UNKNOWN', 'Incomplete provider payment response', 409);
        for (const payment of payments.items) checkProviderPayment(order, payment);
        const captured = payments.items.find(p => p.status === 'captured');
        if (captured) { await settle(order._id, captured, options); outcomes.push({ intentId: source._id, result: 'capture_processed' }); continue; }
        if (payments.items.some(p => !['failed', 'refunded'].includes(p.status)) || remote.amount_paid > 0) throw fail('PROVIDER_STATE_UNKNOWN', 'Payment remains unsettled', 409);
      }
      if (source.reservation.expiresAt <= new Date()) await locked(source.tournamentId, async () => {
        const fresh = await Intent.findById(source._id).session(session());
        if (!order && await Order.exists({ intentId: source._id }).session(session())) return;
        if (fresh.status !== 'fulfilled') await release(fresh, 'expired_unpaid');
      });
      await Intent.updateOne({ _id: source._id }, { $set: { lastError: '', updatedAt: new Date() } });
      outcomes.push({ intentId: source._id, result: 'checked' });
    } catch { await Intent.updateOne({ _id: source._id }, { $set: { lastError: 'RECONCILIATION_REVIEW_REQUIRED', updatedAt: new Date() } }); outcomes.push({ intentId: source._id, result: 'review_required' }); }
  }
  return outcomes;
}

async function changeFee(tournamentId, fee) {
  validId(tournamentId);
  await locked(tournamentId, async () => {
    const tournament = await Tournament.findById(tournamentId).session(session());
    amountFor({ gameType: 'valorant', entryFee: fee });
    if (tournament.gameType !== 'valorant') throw fail('INVALID_GAME', 'Only Valorant supports paid entry');
    if (await Registration.exists({ tournamentId }).session(session()) || await Intent.exists({ tournamentId }).session(session()) || tournament.currentParticipants) throw fail('TOURNAMENT_FEE_LOCKED', 'Fee cannot change after registration or checkout activity', 409);
    tournament.entryFee = fee; await tournament.save({ session: session(), validateModifiedOnly: true });
  });
}

async function saveTournamentUpdate(document) {
  // Apply only requested fields to a fresh locked document. Saving a stale fee
  // outside this lock could otherwise overwrite a new reservation's fee snapshot.
  const proposed = document.toObject();
  const paths = [...new Set(document.modifiedPaths().map(path => path.split('.')[0]))]
    .filter(path => !['_id', '__v', 'resultRevision', 'participants', 'currentParticipants'].includes(path));
  return locked(document._id, async () => {
    const fresh = await Tournament.findById(document._id).session(session());
    if (paths.includes('entryFee') && proposed.entryFee !== fresh.entryFee) {
      amountFor({ gameType: 'valorant', entryFee: proposed.entryFee });
      if (await Registration.exists({ tournamentId: fresh._id }).session(session()) || await Intent.exists({ tournamentId: fresh._id }).session(session()) || fresh.currentParticipants) throw fail('TOURNAMENT_FEE_LOCKED', 'Fee cannot change after registration or checkout activity', 409);
    }
    for (const path of paths) fresh.set(path, proposed[path]);
    await fresh.save({ session: session(), validateModifiedOnly: true }); return fresh;
  });
}

async function deleteUnusedTournament(tournamentId) {
  await locked(tournamentId, async () => {
    if (await Intent.exists({ tournamentId }).session(session()) || await Registration.exists({ tournamentId, 'payment.status': 'paid' }).session(session())) throw fail('PAYMENT_ACTIVITY_EXISTS', 'Retain tournaments with payment activity for settlement and refund review', 409);
    await Tournament.deleteOne({ _id: tournamentId }, { session: session() });
  });
}

async function reviewRefund({ actor, reviewId, decision, reason, refundId }, options) {
  enabled(); validId(reviewId);
  if (actor.role !== 'admin') throw fail('FORBIDDEN', 'Only administrators can manage refund reviews', 403);
  const source = await Review.findById(reviewId);
  if (!source) throw fail('REVIEW_NOT_FOUND', 'Refund review not found', 404);
  const order = await Order.findById(source.paymentOrderId);
  let remote;
  if (decision === 'check_refund') {
    if (typeof refundId !== 'string' || !/^rfnd_[\w]+$/.test(refundId)) throw fail('INVALID_REFUND', 'A valid Razorpay refund ID is required');
    remote = await gateway(options).fetchRefund(refundId);
    if (remote.id !== refundId || remote.payment_id !== order.gatewayPaymentId || remote.amount !== order.amountMinor || remote.currency !== order.currency) throw fail('REFUND_MISMATCH', 'Refund does not match this payment', 409);
  } else if (!['approve', 'decline'].includes(decision) || typeof reason !== 'string' || !reason.trim() || reason.length > 500) throw fail('INVALID_DECISION', 'Decision and reason are required');
  return locked(order.tournamentId, async () => {
    const review = await Review.findById(reviewId).session(session());
    if (decision === 'check_refund') {
      if (!['approved', 'processed'].includes(review.status)) throw fail('REVIEW_NOT_APPROVED', 'Approve the refund review first', 409);
      if (review.gatewayRefundId && review.gatewayRefundId !== refundId) throw fail('REFUND_MISMATCH', 'Another refund is already recorded', 409);
      review.gatewayRefundId = refundId;
      if (review.status !== 'processed') { review.providerStatus = remote.status; if (remote.status === 'processed') { review.status = 'processed'; review.refundedAt = new Date(); } }
    } else {
      if (review.status !== 'requested') throw fail('REVIEW_LOCKED', 'Review has already been decided', 409);
      review.status = decision === 'approve' ? 'approved' : 'declined'; review.decisionBy = actor.userId; review.decisionAt = new Date(); review.decisionReason = reason.trim();
    }
    await review.save({ session: session() });
    if (review.status === 'processed') await Intent.updateOne({ _id: order.intentId, status: 'capture_late_review' }, { $set: { status: 'refunded', blocksNewIntent: false } }, { session: session() });
    return review;
  });
}

module.exports = { createIntent, createOrder, verify, webhook, reconcile, reviewRefund, changeFee, saveTournamentUpdate, deleteUnusedTournament, assertIndexes, amountFor,
  models: { Intent, Order, Event, Receipt, Notification, Review } };

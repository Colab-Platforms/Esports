const mongoose = require('mongoose');

const paymentFeatures = require('../../config/paymentFeatures');
const {
  processReceiptNotificationBatch
} = require('./payment-receipt-email.service');

const summarizeResults = (results = []) => results.reduce((summary, result) => {
  const action = result.action || 'unknown';
  summary[action] = (summary[action] || 0) + 1;
  return summary;
}, {});

class PaymentReceiptEmailScheduler {
  constructor({
    connection = mongoose.connection,
    features = paymentFeatures,
    logger = console,
    processBatch = processReceiptNotificationBatch,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  } = {}) {
    this.connection = connection;
    this.features = features;
    this.logger = logger;
    this.processBatch = processBatch;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;

    this.started = false;
    this.running = false;
    this.scanRequested = false;
    this.timer = null;
  }

  getExpectedDbName() {
    return String(process.env.PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME || '').trim();
  }

  getPollMs() {
    return Math.max(1, Number(this.features.paymentReceiptEmailInProcessPollSeconds || 60)) * 1000;
  }

  getBatchSize() {
    return Math.max(1, Number(this.features.paymentReceiptEmailInProcessBatchSize || 1));
  }

  validateStartup() {
    if (process.env.NODE_ENV === 'test') {
      return { ok: false, reason: 'test_environment' };
    }
    if (!this.features.paymentReceiptEmailInProcessEnabled) {
      return { ok: false, reason: 'in_process_disabled' };
    }
    if (!this.features.paymentReceiptEmailDeliveryEnabled) {
      return { ok: false, reason: 'delivery_disabled' };
    }
    if (this.connection.readyState !== 1) {
      return { ok: false, reason: 'database_not_connected' };
    }

    const expectedDbName = this.getExpectedDbName();
    if (!expectedDbName) {
      return { ok: false, reason: 'expected_db_missing' };
    }
    if (this.connection.name !== expectedDbName) {
      return {
        ok: false,
        reason: 'unexpected_database',
        actualDbName: this.connection.name,
        expectedDbName
      };
    }

    return { ok: true, expectedDbName };
  }

  start() {
    if (this.started) return { started: true, alreadyStarted: true };

    const validation = this.validateStartup();
    if (!validation.ok) {
      this.logger.warn('payment_receipt_email_scheduler_not_started', {
        reason: validation.reason,
        actualDbName: validation.actualDbName,
        expectedDbName: validation.expectedDbName
      });
      return { started: false, reason: validation.reason };
    }

    this.started = true;
    this.logger.info('payment_receipt_email_scheduler_started', {
      dbName: this.connection.name,
      pollSeconds: this.features.paymentReceiptEmailInProcessPollSeconds,
      batchSize: this.getBatchSize()
    });
    this.requestScan('startup');
    return { started: true };
  }

  stop() {
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = null;
    }
    const wasStarted = this.started;
    this.started = false;
    this.scanRequested = false;
    if (wasStarted) {
      this.logger.info('payment_receipt_email_scheduler_stopped');
    }
  }

  requestScan(reason = 'manual') {
    if (!this.started) return { queued: false, reason: 'not_started' };

    this.scanRequested = true;
    if (this.running) return { queued: true, coalesced: true };
    if (!this.timer) {
      this.timer = this.setTimeoutFn(() => {
        this.timer = null;
        return this.runPendingScan();
      }, 0);
    }
    return { queued: true, reason };
  }

  scheduleNext(delayMs) {
    if (!this.started || this.timer) return;
    this.timer = this.setTimeoutFn(() => {
      this.timer = null;
      return this.runPendingScan();
    }, delayMs);
  }

  async runPendingScan() {
    if (!this.started) return;
    if (this.running) {
      this.scanRequested = true;
      return;
    }

    this.running = true;
    this.scanRequested = false;

    try {
      const results = await this.processBatch({
        options: {
          batchSize: this.getBatchSize()
        }
      });
      const summary = summarizeResults(results);
      this.logger.info('payment_receipt_email_scheduler_batch_processed', {
        total: results.length,
        sent: summary.sent || 0,
        retryScheduled: summary.retry_scheduled || 0,
        needsAttention: summary.needs_attention || 0,
        deliveryUncertain: summary.delivery_uncertain || 0,
        skippedDisabled: summary.skipped_disabled || 0,
        targetNotEligible: summary.target_not_eligible || 0,
        actions: summary
      });
    } catch (error) {
      this.logger.error('payment_receipt_email_scheduler_error', {
        message: error.message,
        code: error.code || ''
      });
    } finally {
      this.running = false;
      if (!this.started) return;
      if (this.scanRequested) {
        this.scanRequested = false;
        this.scheduleNext(0);
      } else {
        this.scheduleNext(this.getPollMs());
      }
    }
  }
}

const defaultScheduler = new PaymentReceiptEmailScheduler();

module.exports = {
  PaymentReceiptEmailScheduler,
  defaultScheduler,
  requestReceiptEmailScan: (reason) => defaultScheduler.requestScan(reason),
  startReceiptEmailScheduler: () => defaultScheduler.start(),
  stopReceiptEmailScheduler: () => defaultScheduler.stop()
};

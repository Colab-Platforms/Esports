const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaymentReceiptEmailScheduler,
  defaultScheduler
} = require('./payment-receipt-email.scheduler');

const makeLogger = () => {
  const entries = [];
  return {
    entries,
    info: (message, meta) => entries.push({ level: 'info', message, meta }),
    warn: (message, meta) => entries.push({ level: 'warn', message, meta }),
    error: (message, meta) => entries.push({ level: 'error', message, meta })
  };
};

const makeTimers = () => {
  const timers = [];
  return {
    timers,
    setTimeoutFn: (fn, delay) => {
      const timer = { fn, delay, active: true };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn: (timer) => {
      if (timer) timer.active = false;
    },
    runNext: async () => {
      const timer = timers.shift();
      if (timer?.active) {
        await timer.fn();
      }
    }
  };
};

const makeFeatures = (overrides = {}) => ({
  paymentReceiptEmailInProcessEnabled: true,
  paymentReceiptEmailDeliveryEnabled: true,
  paymentReceiptEmailInProcessPollSeconds: 60,
  paymentReceiptEmailInProcessBatchSize: 1,
  ...overrides
});

const withExpectedDb = async (value, fn) => {
  const previous = process.env.PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME;
  if (value === undefined) {
    delete process.env.PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME;
  } else {
    process.env.PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME = value;
  }
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME;
    } else {
      process.env.PAYMENT_RECEIPT_EMAIL_EXPECTED_DB_NAME = previous;
    }
  }
};

const createScheduler = ({
  connection = { readyState: 1, name: 'colab-esports-dev' },
  features = makeFeatures(),
  processBatch = async () => [],
  logger = makeLogger(),
  timers = makeTimers()
} = {}) => ({
  scheduler: new PaymentReceiptEmailScheduler({
    connection,
    features,
    processBatch,
    logger,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn
  }),
  logger,
  timers
});

test('default scheduler is inert at import time', () => {
  assert.equal(defaultScheduler.started, false);
});

test('in-process scheduler is disabled by default', async () => withExpectedDb('colab-esports-dev', async () => {
  let batchCalls = 0;
  const { scheduler, timers } = createScheduler({
    features: makeFeatures({ paymentReceiptEmailInProcessEnabled: false }),
    processBatch: async () => {
      batchCalls += 1;
      return [];
    }
  });

  const result = scheduler.start();

  assert.deepEqual(result, { started: false, reason: 'in_process_disabled' });
  assert.equal(timers.timers.length, 0);
  assert.equal(batchCalls, 0);
}));

test('scheduler refuses startup in test environment', async () => withExpectedDb('colab-esports-dev', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    let batchCalls = 0;
    const { scheduler, timers } = createScheduler({
      processBatch: async () => {
        batchCalls += 1;
        return [];
      }
    });

    const result = scheduler.start();

    assert.deepEqual(result, { started: false, reason: 'test_environment' });
    assert.equal(timers.timers.length, 0);
    assert.equal(batchCalls, 0);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
}));

test('missing expected database name prevents startup and processing', async () => withExpectedDb(undefined, async () => {
  let batchCalls = 0;
  const { scheduler, timers } = createScheduler({
    processBatch: async () => {
      batchCalls += 1;
      return [];
    }
  });

  const result = scheduler.start();

  assert.deepEqual(result, { started: false, reason: 'expected_db_missing' });
  assert.equal(timers.timers.length, 0);
  assert.equal(batchCalls, 0);
}));

test('wrong connected database prevents startup and processing', async () => withExpectedDb('colab-esports-dev', async () => {
  let batchCalls = 0;
  const { scheduler, timers } = createScheduler({
    connection: { readyState: 1, name: 'colab-esports-prod' },
    processBatch: async () => {
      batchCalls += 1;
      return [];
    }
  });

  const result = scheduler.start();

  assert.deepEqual(result, { started: false, reason: 'unexpected_database' });
  assert.equal(timers.timers.length, 0);
  assert.equal(batchCalls, 0);
}));

test('scheduler does not poll before database readiness', async () => withExpectedDb('colab-esports-dev', async () => {
  let batchCalls = 0;
  const { scheduler, timers } = createScheduler({
    connection: { readyState: 0, name: 'colab-esports-dev' },
    processBatch: async () => {
      batchCalls += 1;
      return [];
    }
  });

  const result = scheduler.start();

  assert.deepEqual(result, { started: false, reason: 'database_not_connected' });
  assert.equal(timers.timers.length, 0);
  assert.equal(batchCalls, 0);
}));

test('correct development database permits initial scan with batch size one', async () => withExpectedDb('colab-esports-dev', async () => {
  const calls = [];
  const { scheduler, timers, logger } = createScheduler({
    processBatch: async (args) => {
      calls.push(args);
      return [{ action: 'sent' }];
    }
  });

  const result = scheduler.start();
  await timers.runNext();

  assert.deepEqual(result, { started: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.batchSize, 1);
  assert.equal(logger.entries.some((entry) => entry.message === 'payment_receipt_email_scheduler_started'), true);
  assert.equal(logger.entries.some((entry) => entry.message === 'payment_receipt_email_scheduler_batch_processed'), true);
  scheduler.stop();
}));

test('concurrent wake-ups coalesce and do not overlap processing', async () => withExpectedDb('colab-esports-dev', async () => {
  let resolveFirstBatch;
  const calls = [];
  const { scheduler, timers } = createScheduler({
    processBatch: async () => {
      calls.push(new Date());
      if (calls.length === 1) {
        await new Promise((resolve) => {
          resolveFirstBatch = resolve;
        });
      }
      return [];
    }
  });

  scheduler.start();
  const firstRun = timers.runNext();
  assert.equal(scheduler.running, true);

  scheduler.requestScan('payment_fulfilled');
  scheduler.requestScan('payment_fulfilled');
  resolveFirstBatch();
  await firstRun;
  await timers.runNext();

  assert.equal(calls.length, 2);
  scheduler.stop();
}));

test('processing errors are logged and do not throw out of scheduler', async () => withExpectedDb('colab-esports-dev', async () => {
  const { scheduler, logger } = createScheduler({
    processBatch: async () => {
      throw Object.assign(new Error('provider unavailable'), { code: 'PROVIDER_DOWN' });
    }
  });
  scheduler.started = true;

  await assert.doesNotReject(() => scheduler.runPendingScan());

  assert.equal(logger.entries.some((entry) => entry.message === 'payment_receipt_email_scheduler_error'), true);
  scheduler.stop();
}));

test('shutdown stops polling and future wake-ups become no-ops', async () => withExpectedDb('colab-esports-dev', async () => {
  let batchCalls = 0;
  const { scheduler, timers } = createScheduler({
    processBatch: async () => {
      batchCalls += 1;
      return [];
    }
  });

  scheduler.start();
  scheduler.stop();
  const wakeup = scheduler.requestScan('payment_fulfilled');
  await timers.runNext();

  assert.deepEqual(wakeup, { queued: false, reason: 'not_started' });
  assert.equal(batchCalls, 0);
}));

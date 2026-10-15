const assert = require('node:assert/strict');
const test = require('node:test');

const { RazorpayAdapter, wrapProviderError } = require('./razorpay.adapter');

test('RazorpayAdapter fetchOrderPayments uses the SDK promise signature without a callback argument', async () => {
  const response = { entity: 'collection', count: 0, items: [] };
  const adapter = new RazorpayAdapter({
    keyId: 'rzp_test_local',
    keySecret: 'test_secret',
    client: {
      orders: {
        fetchPayments: function (orderId, callback) {
          assert.equal(orderId, 'order_test');
          assert.equal(arguments.length, 1);
          assert.equal(callback, undefined);
          return Promise.resolve(response);
        }
      }
    }
  });

  assert.equal(await adapter.fetchOrderPayments('order_test'), response);
});

test('wrapProviderError converts Razorpay plain-object errors into safe Error instances', () => {
  const wrapped = wrapProviderError(
    {
      statusCode: 401,
      error: {
        code: 'BAD_REQUEST_ERROR',
        description: 'Authentication failed'
      }
    },
    'RAZORPAY_ORDER_CREATE_FAILED',
    'Razorpay order creation failed'
  );

  assert.equal(wrapped instanceof Error, true);
  assert.equal(wrapped.code, 'RAZORPAY_ORDER_CREATE_FAILED');
  assert.equal(wrapped.status, 401);
  assert.equal(wrapped.message, 'Authentication failed');
  assert.equal(wrapped.providerCode, 'BAD_REQUEST_ERROR');
});

test('wrapProviderError preserves unknown-provider-outcome classification', () => {
  const wrapped = wrapProviderError(
    { code: 'ETIMEDOUT' },
    'RAZORPAY_ORDER_CREATE_FAILED',
    'Razorpay order creation failed'
  );

  assert.equal(wrapped.providerOutcomeUnknown, true);
  assert.equal(wrapped.message, 'Razorpay order creation failed');
});

test('RazorpayAdapter createOrder wraps SDK object rejection with actionable error', async () => {
  const adapter = new RazorpayAdapter({
    keyId: 'rzp_test_local',
    keySecret: 'test_secret',
    client: {
      orders: {
        create: async () => {
          throw {
            statusCode: 400,
            error: {
              code: 'BAD_REQUEST_ERROR',
              description: 'The amount must be at least INR 1.00'
            }
          };
        }
      }
    }
  });

  await assert.rejects(
    () => adapter.createOrder({
      amountMinor: 50,
      currency: 'INR',
      receipt: 'receipt_test',
      notes: {}
    }),
    (error) => (
      error.code === 'RAZORPAY_ORDER_CREATE_FAILED' &&
      error.status === 400 &&
      error.message === 'The amount must be at least INR 1.00'
    )
  );
});

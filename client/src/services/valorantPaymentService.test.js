import api from './api';
import { registerPaidTeam } from './valorantPaymentService';
jest.mock('./api');
const args = { tournament: { _id: 'cup', name: 'Fiction Cup' }, team: { _id: 'team' }, user: { username: 'Fiction' } };
let checkout, opened;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => 'fictional-test-request-key' } });
  window.Razorpay = jest.fn().mockImplementation(config => { checkout = config; return { on: jest.fn(), open: () => { opened?.(); } }; });
  api.get.mockResolvedValue({ data: { intent: null } });
  api.post.mockImplementation(path => Promise.resolve({ data: path.endsWith('/intents') ? { _id: 'intent' } : path.endsWith('/order') ? {
    paymentOrderId: 'local-order', razorpayOrderId: 'order_fiction', keyId: 'rzp_test_fiction', amountMinor: 50000, currency: 'INR'
  } : { registrationId: 'registration', registrationStatus: 'pending' } }));
  opened = undefined;
});
afterEach(() => { delete window.Razorpay; });
test('checkout uses server order and confirms only through backend verification', async () => {
  opened = () => checkout.handler({ razorpay_order_id: 'order_fiction', razorpay_payment_id: 'pay_fiction', razorpay_signature: 'fiction-signature' });
  await expect(registerPaidTeam(args)).resolves.toEqual({ registrationId: 'registration', registrationStatus: 'pending' });
  expect(window.Razorpay).toHaveBeenCalledWith(expect.objectContaining({ amount: 50000, order_id: 'order_fiction', currency: 'INR' }));
  expect(api.post).toHaveBeenCalledWith('/api/valorant-payments/verify', expect.objectContaining({ paymentOrderId: 'local-order' }));
  expect(api.post).not.toHaveBeenCalledWith(expect.stringContaining('/api/valorant-registration/'), expect.anything());
});
test('existing reservation resumes without creating another intent', async () => {
  api.get.mockResolvedValue({ data: { intent: { _id: 'old-intent', status: 'payment_order_created' } } });
  opened = () => checkout.modal.ondismiss();
  await expect(registerPaidTeam(args)).rejects.toThrow(/check registration status/);
  expect(api.post).toHaveBeenCalledTimes(1); expect(api.post).toHaveBeenCalledWith('/api/valorant-payments/intents/old-intent/order', expect.anything());
});
test('fulfilled reservation avoids another checkout', async () => {
  api.get.mockResolvedValue({ data: { intent: { fulfilledRegistrationId: 'existing' } } });
  await expect(registerPaidTeam(args)).resolves.toEqual({ registrationId: 'existing' });
  expect(api.post).not.toHaveBeenCalled(); expect(window.Razorpay).not.toHaveBeenCalled();
});
test('late payment review blocks another checkout', async () => {
  api.get.mockResolvedValue({ data: { intent: { status: 'capture_late_review' } } });
  await expect(registerPaidTeam(args)).rejects.toThrow(/do not pay again/); expect(api.post).not.toHaveBeenCalled();
});
test('frontend success callback without confirmed registration remains unsuccessful', async () => {
  const post = api.post.getMockImplementation(); api.post.mockImplementation(path => path.endsWith('/verify') ? Promise.resolve({ data: { paymentStatus: 'authorized', registrationId: null } }) : post(path));
  opened = () => checkout.handler({ razorpay_payment_id: 'pay_fiction' });
  await expect(registerPaidTeam(args)).rejects.toThrow(/not captured/);
});
test('callback verification failure never starts a replacement order', async () => {
  const post = api.post.getMockImplementation(); api.post.mockImplementation(path => path.endsWith('/verify') ? Promise.reject(new Error('Network unavailable')) : post(path));
  opened = () => checkout.handler({ razorpay_payment_id: 'pay_fiction' });
  await expect(registerPaidTeam(args)).rejects.toThrow('Network unavailable'); expect(api.post.mock.calls.filter(([url]) => url.endsWith('/order'))).toHaveLength(1);
});

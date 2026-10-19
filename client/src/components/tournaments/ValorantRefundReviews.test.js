import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../services/api';
import Reviews from './ValorantRefundReviews';
jest.mock('../../services/api');
beforeEach(() => { jest.clearAllMocks(); api.post.mockResolvedValue({ success: true }); api.get.mockResolvedValue({ data: { reviews: [{ _id: 'review', reason: 'late_capture', status: 'requested', paymentOrder: { amountMinor: 50000, gatewayPaymentId: 'pay_fiction' } }] } }); });
test.each(['user', 'designer', 'moderator'])('%s cannot see or load refund administration', role => {
  render(<Reviews role={role} />); expect(screen.queryByText('Manual refund reviews')).not.toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled();
});
test('approval records a decision without calling a refund-creation endpoint', async () => {
  render(<Reviews role="admin" />); const button = await screen.findByRole('button', { name: 'Approve refund review' });
  expect(button).toBeDisabled(); fireEvent.change(screen.getByLabelText('Refund decision reason'), { target: { value: 'Approved full refund' } });
  fireEvent.click(button); await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/valorant-payments/refund-reviews/review', { decision: 'approve', reason: 'Approved full refund', refundId: '' }));
  await waitFor(() => expect(button).toBeEnabled()); expect(api.post).toHaveBeenCalledTimes(1);
});
test('approved review exposes provider verification with an explicit refund ID', async () => {
  api.get.mockResolvedValue({ data: { reviews: [{ _id: 'review', reason: 'roster_rejected', status: 'approved' }] } });
  render(<Reviews role="admin" />); const button = await screen.findByRole('button', { name: 'Verify Razorpay refund' });
  expect(button).toBeDisabled(); fireEvent.change(screen.getByLabelText('Razorpay refund ID'), { target: { value: 'rfnd_fiction' } });
  fireEvent.click(button); await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/valorant-payments/refund-reviews/review', expect.objectContaining({ decision: 'check_refund', refundId: 'rfnd_fiction' })));
  await waitFor(() => expect(button).toBeEnabled());
});

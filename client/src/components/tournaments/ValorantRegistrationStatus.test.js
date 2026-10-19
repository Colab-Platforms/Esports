import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth from '../../store/slices/authSlice';
import api from '../../services/api';
import Status from './ValorantRegistrationStatus';
jest.mock('../../services/api');
const renderStatus = (authenticated = true, onChanged = jest.fn()) => render(<Provider store={configureStore({ reducer: { auth }, preloadedState: { auth: { isAuthenticated: authenticated } } })}><Status tournamentId="cup" revision={1} onChanged={onChanged} /></Provider>);
beforeEach(() => { jest.clearAllMocks(); api.post.mockResolvedValue({ success: true }); });
test('anonymous page does not fetch private registration history', () => {
  renderStatus(false); expect(api.get).not.toHaveBeenCalled();
});
test('pending cancellation preserves the API lifecycle and refreshes the parent', async () => {
  api.get.mockResolvedValue({ data: { registrations: [{ _id: 'row', status: 'pending', tournamentId: { _id: 'cup' } }] } });
  const changed = jest.fn(); renderStatus(true, changed);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel pending registration' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/valorant-registration/row/cancel', {}));
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
});
test('verified registration has no cancellation control', async () => {
  api.get.mockResolvedValue({ data: { registrations: [{ _id: 'row', status: 'verified', tournamentId: 'cup' }] } });
  renderStatus(); expect(await screen.findByText(/registration: verified/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel pending registration' })).not.toBeInTheDocument();
});

test('paid rejected history displays receipt and provider-verified refund review status', async () => {
  api.get.mockResolvedValue({ data: { registrations: [{ _id: 'paid', tournamentId: 'cup', status: 'rejected', payment: { status: 'paid', amountMinor: 50000 }, receipt: { receiptNumber: 'CE-fiction' }, refundReview: { status: 'approved', providerStatus: 'pending' } }] } });
  renderStatus(); expect(await screen.findByText('Receipt: CE-fiction')).toBeInTheDocument();
  expect(screen.getByText('Refund review: approved (pending)')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel pending registration' })).not.toBeInTheDocument();
});

test('unfulfilled payment reservation is not displayed as a registered team', async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('my-attempts') ? { attempts: [{ status: 'payment_order_created' }] } : { registrations: [] } }));
  renderStatus(); expect(await screen.findByText(/Payment reservation: payment_order_created/)).toBeInTheDocument();
  expect(screen.queryByText(/Your team registration:/)).not.toBeInTheDocument();
});

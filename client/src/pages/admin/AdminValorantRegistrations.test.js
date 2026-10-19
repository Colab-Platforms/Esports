import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth from '../../store/slices/authSlice';
import api from '../../services/api';
import AdminValorantRegistrations from './AdminValorantRegistrations';
jest.mock('../../services/api');
const renderAs = role => render(<Provider store={configureStore({ reducer: { auth }, preloadedState: { auth: { user: { role }, isAuthenticated: true } } })}><AdminValorantRegistrations /></Provider>);
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('/admin/tournament/') ? {
    registrations: [{ _id: 'registration', teamName: 'Fiction Team', status: 'pending', roster: [{ userId: 'fiction', username: 'Fiction', riotId: 'Player#TAG', role: 'starter' }] }]
  } : { tournaments: [{ _id: 'cup', name: 'Free Cup', gameType: 'valorant', entryFee: 0 }, { _id: 'paid', name: 'Paid Cup', gameType: 'valorant', entryFee: 100 }] } }));
  api.post.mockResolvedValue({ success: true });
});
test.each(['user', 'designer'])('%s cannot view roster-management controls or issue requests', role => {
  renderAs(role); expect(screen.getByText(/Admin or moderator access/)).toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled();
});
test.each(['admin', 'moderator'])('%s can review free and paid registrations through the isolated API', async role => {
  renderAs(role); await screen.findByRole('option', { name: 'Free Cup' });
  expect(screen.getByRole('option', { name: 'Paid Cup' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tournament'), { target: { value: 'cup' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Verify roster' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/valorant-registration/registration/verify', { reason: '' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Verify roster' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Reject registration' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Rejection reason'), { target: { value: 'Fictional rejection reason' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reject registration' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/valorant-registration/registration/reject', { reason: 'Fictional rejection reason' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Verify roster' })).toBeEnabled());
});

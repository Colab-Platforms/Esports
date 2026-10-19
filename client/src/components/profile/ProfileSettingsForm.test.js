import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth from '../../store/slices/authSlice';
import axios from 'axios';
import ProfileSettingsForm from './ProfileSettingsForm';
jest.mock('axios');
const user = { id: 'fiction', username: 'fictional-user', role: 'user', profileVisibility: 'private', gameIds: {
  valorant: 'Existing#TAG', bgmi: { ign: 'Mobile', uid: '123' }, freefire: { ign: 'Other', uid: '456' }, steam: '76561198123456789'
} };
function setup() {
  const store = configureStore({ reducer: { auth }, preloadedState: { auth: { user, token: 'synthetic-token', isAuthenticated: true } } });
  render(<Provider store={store}><ProfileSettingsForm initialTab="gameids" /></Provider>);
  return store;
}
beforeEach(() => { jest.clearAllMocks(); });

test('loads saved Riot ID, saves through the existing API, and preserves other IDs/privacy in Redux', async () => {
  const updated = { ...user, gameIds: { ...user.gameIds, valorant: 'Updated#TAG' } };
  axios.put.mockResolvedValue({ data: { success: true, data: { user: updated } } });
  const store = setup(); const input = screen.getByLabelText('Valorant Riot ID');
  expect(input).toHaveValue('Existing#TAG'); expect(input).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  fireEvent.change(input, { target: { value: 'Updated#TAG' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/api/auth/profile'), expect.objectContaining({
    gameIds: { ...user.gameIds, valorant: 'Updated#TAG' }, profileVisibility: 'private'
  }), expect.objectContaining({ headers: { Authorization: 'Bearer synthetic-token' } })));
  await waitFor(() => expect(store.getState().auth.user.gameIds.valorant).toBe('Updated#TAG'));
  expect(screen.getByLabelText('Valorant Riot ID')).toBeDisabled();
});
test('invalid Riot ID prevents a profile request', () => {
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  fireEvent.change(screen.getByLabelText('Valorant Riot ID'), { target: { value: 'MissingTag' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(screen.getByText(/must use PlayerName#TAG/)).toBeInTheDocument(); expect(axios.put).not.toHaveBeenCalled();
});
test('explicit clearing is sent without replacing other game IDs', async () => {
  axios.put.mockResolvedValue({ data: { success: true, data: { user: { ...user, gameIds: { ...user.gameIds, valorant: '' } } } } });
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  fireEvent.change(screen.getByLabelText('Valorant Riot ID'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(axios.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ gameIds: { ...user.gameIds, valorant: '' } }), expect.any(Object)));
});

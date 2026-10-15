import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth from '../../store/slices/authSlice';
import api from '../../services/api';
import AdminGameResults from './AdminGameResults';

jest.mock('../../services/api');

const renderAdmin = role => {
  const store = configureStore({ reducer: { auth }, preloadedState: { auth: { isAuthenticated: true, user: { role } } } });
  return render(<Provider store={store}><AdminGameResults /></Provider>);
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes('result-registrations')
    ? { registrations: [{ _id: 'registration', teamName: 'Approved Team', status: 'verified' }] }
    : { tournaments: [{ _id: 'tournament', name: 'Approved Cup', gameType: 'freefire' }] } }));
  api.getFreeFireTournamentResults.mockResolvedValue({ data: { results: [] } });
  api.getAdminTournamentFinalResult.mockResolvedValue({ data: { finalResult: { status: 'unpublished', standings: [], evidence: [] } } });
  api.createFreeFireResult.mockResolvedValue({ success: true });
});

test('manual draft entry uses existing verified registrations without an OCR workflow', async () => {
  renderAdmin('admin');
  expect(await screen.findByRole('button', { name: 'Save Draft' })).toBeEnabled();
  fireEvent.change(screen.getByDisplayValue('Select verified registration'), { target: { value: 'registration' } });
  fireEvent.change(screen.getByPlaceholderText('Placement'), { target: { value: '1' } });
  fireEvent.change(screen.getByPlaceholderText('Kills'), { target: { value: '4' } });
  fireEvent.change(screen.getByPlaceholderText('Placement points'), { target: { value: '12' } });
  fireEvent.change(screen.getByPlaceholderText('Kill points'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
  await waitFor(() => expect(api.createFreeFireResult).toHaveBeenCalledWith(expect.objectContaining({
    tournamentId: 'tournament', teamResults: [{ registrationId: 'registration', placement: 1, kills: 4, placementPoints: 12, killPoints: 4, totalPoints: 16 }]
  })));
  expect(screen.queryByText('Upload Scoreboard')).not.toBeInTheDocument();
  expect(screen.queryByText('Extract Scoreboard')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
});

test('result management does not expose write controls to a non-manager role', async () => {
  renderAdmin('designer');
  expect(screen.getByText(/Admin or moderator access is required/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(api.createFreeFireResult).not.toHaveBeenCalled();
});

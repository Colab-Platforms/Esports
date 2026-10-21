import React, { StrictMode } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import api from '../services/api';

jest.mock('../services/api');
const emptyDashboard = () => ({ success: true, data: {
  player: { username: 'fictional-player', displayName: 'Fictional Player', primaryGames: [] },
  overview: { tournamentsJoined: 0, activeRegistrations: 0, teams: 0, completedCompetitions: 0 },
  verifiedAccounts: [], upcomingCompetitions: [], teams: [], registrations: [], recentActivity: [],
  wallet: { balance: 0, totalEarned: 0, totalSpent: 0 }
} });
const mount = (strict = false) => render(<MemoryRouter>{strict ? <StrictMode><DashboardPage /></StrictMode> : <DashboardPage />}</MemoryRouter>);

beforeAll(() => {
  window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
});
beforeEach(() => jest.clearAllMocks());

test('empty dashboard explains each empty state and links to existing routes', async () => {
  api.getCompetitionDashboard.mockResolvedValue(emptyDashboard());
  mount();
  expect(await screen.findByRole('heading', { name: 'Fictional Player' })).toBeInTheDocument();
  expect(screen.getByText('No competitions on your radar yet')).toBeInTheDocument();
  expect(screen.getByText('No active registrations')).toBeInTheDocument();
  expect(screen.getByText('No teams yet')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Connect accounts' })).toHaveAttribute('href', '/connected-accounts');
  expect(screen.getByRole('link', { name: 'Open wallet' })).toHaveAttribute('href', '/wallet');
});

test('populated dashboard keeps saved IDs unverified and displays own competitions and balance', async () => {
  const response = emptyDashboard();
  Object.assign(response.data, {
    verifiedAccounts: [{ provider: 'valorant', label: 'Valorant', identifier: 'SavedPlayer#TEST', connectionStatus: 'profile_game_id', verificationStatus: 'unverified' }],
    upcomingCompetitions: [{ id: 'cup-a', name: 'Upcoming Cup', gameLabel: 'Valorant', status: 'registration_open', prizePool: 100 }],
    teams: [{ id: 'team-a', name: 'My Team', gameLabel: 'Valorant', role: 'captain', memberCount: 6, maxMembers: 6 }],
    registrations: [{ id: 'reg-a', tournament: { id: 'cup-a', name: 'Upcoming Cup' }, teamName: 'My Team', status: 'pending' }],
    recentActivity: [{ id: 'notice-a', title: 'Match notice', message: 'Your match starts soon', createdAt: 'invalid-date', actionUrl: '/tournaments/cup-a' }],
    wallet: { balance: 123, totalEarned: 140, totalSpent: 17 }
  });
  api.getCompetitionDashboard.mockResolvedValue(response);
  mount();
  expect(await screen.findByText('Valorant: Saved ID')).toBeInTheDocument();
  expect(screen.queryByText(/Valorant: Verified/)).not.toBeInTheDocument();
  expect(screen.getByText('123 coins')).toBeInTheDocument();
  expect(screen.getByText('Match notice')).toBeInTheDocument();
  expect(screen.getAllByText('TBA').length).toBeGreaterThan(0);
  expect(screen.getAllByRole('link').filter(link => link.getAttribute('href') === '/tournaments/cup-a')).toHaveLength(3);
});

test('failed request offers retry and recovers without displaying misleading zero data', async () => {
  api.getCompetitionDashboard.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(emptyDashboard());
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('heading', { name: 'Fictional Player' })).toBeInTheDocument();
  expect(api.getCompetitionDashboard).toHaveBeenCalledTimes(2);
});

test('a stale StrictMode response cannot replace the current successful result', async () => {
  let rejectOld;
  api.getCompetitionDashboard.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
    .mockResolvedValueOnce(emptyDashboard());
  mount(true);
  expect(await screen.findByRole('heading', { name: 'Fictional Player' })).toBeInTheDocument();
  await act(async () => { rejectOld(new Error('Stale request')); });
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Fictional Player' })).toBeInTheDocument();
});

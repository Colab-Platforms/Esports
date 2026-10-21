import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicProfile from './PublicProfile';
import api from '../services/api';

jest.mock('../services/api');
const profile = (username = 'public-player') => ({ success: true, data: {
  player: { username, displayName: username, joinedAt: 'invalid-date', level: 1 },
  accounts: [], games: [], teams: [], tournamentHistory: [], achievements: [],
  overview: { tournamentsJoined: 0, completedTournaments: 0, activeTeams: 0, achievements: 0 }
} });
const mount = (strict = false) => render(<MemoryRouter initialEntries={['/player/public-player']}>
  <Routes><Route path="/player/:username" element={strict ? <StrictMode><PublicProfile /></StrictMode> : <PublicProfile />} /></Routes>
</MemoryRouter>);
beforeAll(() => { window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); });
beforeEach(() => {
  jest.resetAllMocks();
  api.getPlayerCompetitiveProfile.mockResolvedValue(profile());
  api.getPlayerCompetitiveHistory.mockResolvedValue({ success: true, data: { history: [] } });
  api.getPlayerStatistics.mockResolvedValue({ success: true, data: { games: {} } });
});

test('renders the public competitive profile with honest empty states and invalid dates', async () => {
  mount();
  expect(await screen.findByRole('heading', { name: 'public-player' })).toBeInTheDocument();
  expect(screen.getByText('Joined TBA')).toBeInTheDocument();
  expect(screen.getByText('No public teams yet')).toBeInTheDocument();
  expect(screen.getByText('No verified statistics yet')).toBeInTheDocument();
  expect(screen.getByText('No competitive history yet')).toBeInTheDocument();
  expect(api.getPlayerCompetitiveProfile).toHaveBeenCalledWith('public-player');
});

test('saved IDs stay unverified and tournament navigation uses the real tournament ID', async () => {
  const response = profile();
  response.data.accounts = [{ provider: 'valorant', label: 'Valorant ID', identifier: 'Player#TEST', status: 'Saved ID' }];
  response.data.tournamentHistory = [{ id: 'registration-one', tournamentId: 'cup-one', tournamentName: 'Public Cup', gameLabel: 'Valorant', status: 'completed' }];
  api.getPlayerCompetitiveProfile.mockResolvedValue(response);
  mount();
  expect(await screen.findByText('Saved ID')).toBeInTheDocument();
  expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Public Cup/ })).toHaveAttribute('href', '/tournaments/cup-one');
});

test('a private or missing profile displays no stale public data and offers retry', async () => {
  api.getPlayerCompetitiveProfile.mockRejectedValueOnce(new Error('Profile not found'));
  mount();
  expect(await screen.findByText('Player profile unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'public-player' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('heading', { name: 'public-player' })).toBeInTheDocument();
});

test('statistics failure does not hide the profile or fabricate zero statistics', async () => {
  api.getPlayerStatistics.mockRejectedValueOnce(new Error('Unavailable'));
  mount();
  expect(await screen.findByRole('heading', { name: 'public-player' })).toBeInTheDocument();
  expect(screen.getByText(/Statistics are temporarily unavailable/)).toBeInTheDocument();
  expect(screen.queryByText('No verified statistics yet')).not.toBeInTheDocument();
});

test('a stale StrictMode request cannot replace the newest profile', async () => {
  let resolveOld;
  api.getPlayerCompetitiveProfile.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce(profile('latest-player'));
  mount(true);
  expect(await screen.findByRole('heading', { name: 'latest-player' })).toBeInTheDocument();
  await act(async () => { resolveOld(profile('stale-player')); });
  expect(screen.queryByRole('heading', { name: 'stale-player' })).not.toBeInTheDocument();
});

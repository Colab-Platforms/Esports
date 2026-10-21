import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProfilePage from './ProfilePage';
import api from '../services/api';
jest.mock('../components/profile/ProfileSettingsForm', () => () => <div>Profile settings</div>);
jest.mock('../services/api');
beforeAll(() => { window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); });
beforeEach(() => {
  jest.clearAllMocks();
  api.getCompetitionDashboard.mockResolvedValue({ success: true, data: {
    player: { username: 'own-player', displayName: 'Competition player', primaryGames: [] },
    overview: {}, verifiedAccounts: [], upcomingCompetitions: [], teams: [], registrations: [], recentActivity: [], wallet: {}
  } });
  api.checkInActivityStreak.mockResolvedValue({ success: true });
  api.getActivityStreakLeaderboard.mockResolvedValue({ success: true, data: { leaderboard: [] } });
  api.getUserTournaments.mockResolvedValue({ data: [] });
});
test.each(['public', 'private'])('own %s profile links to discovery and respects public visibility', visibility => {
  const store = configureStore({ reducer: { auth: () => ({ user: {
    username: 'own-player', profileVisibility: visibility, activityStreak: 3, gameIds: {}, socialAccounts: {}, createdAt: new Date().toISOString()
  } }) } });
  render(<Provider store={store}><MemoryRouter><ProfilePage /></MemoryRouter></Provider>);
  expect(screen.getByRole('link', { name: 'Players & Teams' })).toHaveAttribute('href', '/teams');
  if (visibility === 'public') expect(screen.getByRole('link', { name: 'View public profile' })).toHaveAttribute('href', '/player/own-player');
  else expect(screen.queryByRole('link', { name: 'View public profile' })).not.toBeInTheDocument();
  expect(screen.getByText('Activity Streak')).toBeInTheDocument();
});

test('competition dashboard loads only when selected and other profile sections remain accessible', async () => {
  const store = configureStore({ reducer: { auth: () => ({ user: { username: 'own-player', activityStreak: 3 } }) } });
  render(<Provider store={store}><MemoryRouter><ProfilePage /></MemoryRouter></Provider>);
  expect(api.getCompetitionDashboard).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Competition Dashboard' }));
  expect(await screen.findByRole('heading', { name: 'Competition player' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Competition Dashboard' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Profile Settings' }));
  expect(screen.getByText('Profile settings')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Competition player' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'My Tournaments' }));
  expect(await screen.findByText('No tournaments participated yet.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'General' }));
  expect(screen.getByText('Activity Streak')).toBeInTheDocument();
});

test('a profile dashboard link opens the selected section directly', async () => {
  const store = configureStore({ reducer: { auth: () => ({ user: { username: 'own-player' } }) } });
  render(<Provider store={store}><MemoryRouter initialEntries={['/profile?tab=dashboard']}><ProfilePage /></MemoryRouter></Provider>);
  expect(await screen.findByRole('heading', { name: 'Competition player' })).toBeInTheDocument();
});

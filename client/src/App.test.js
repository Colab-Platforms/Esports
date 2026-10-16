import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App';
import { configureStore } from '@reduxjs/toolkit';
import auth from './store/slices/authSlice';

jest.mock('./utils/socket', () => ({ initializeSocket: jest.fn(), disconnectSocket: jest.fn() }));
jest.mock('./services/notificationService', () => ({ init: jest.fn(), requestNotificationPermission: jest.fn(), stopTournamentMonitoring: jest.fn() }));
jest.mock('./hooks/useDailyStreak', () => () => ({ showToast: false }));
jest.mock('./components/layout/Navbar', () => () => <nav>Site navigation</nav>);
jest.mock('./components/layout/Footer', () => () => <footer>Site footer</footer>);
jest.mock('./components/common/InstallPWA', () => () => null);
jest.mock('./pages/auth/LoginPage', () => () => <h1>Sign in</h1>);
jest.mock('./pages/LeaderboardPage', () => () => <h1>Player and CS2 leaderboards</h1>);
jest.mock('./features/explore/pages/ExplorePage', () => () => <h1>Explore feed</h1>);
jest.mock('./pages/CompetitiveLeaderboardPage', () => () => <h1>Competitive team rankings</h1>);
jest.mock('./pages/TournamentResultsPage', () => () => <h1>Tournament results</h1>);
jest.mock('./pages/HomePage', () => () => <h1>Home</h1>);
jest.mock('./pages/admin/AdminGameResults', () => () => <h1>Result Management</h1>);
jest.mock('./features/explore/pages/ExploreContentManagement', () => () => <h1>Explore Content</h1>);

beforeEach(() => { sessionStorage.setItem('hasSeenSplash', 'true'); });

test.each([
  ['/login', 'Sign in'], ['/explore', 'Explore feed'], ['/leaderboard', 'Player and CS2 leaderboards'],
  ['/competitive-leaderboards', 'Competitive team rankings'], ['/tournament-results', 'Tournament results'],
  ['/admin/results', 'Sign in'], ['/admin/explore', 'Sign in']
])('preserves route %s and its access boundary', (route, title) => {
  render(<Provider store={store}><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></Provider>);
  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
});

test.each([
  ['admin', '/admin/results', 'Result Management'],
  ['moderator', '/admin/results', 'Result Management'],
  ['admin', '/admin/explore', 'Explore Content'],
  ['moderator', '/admin/explore', 'Explore Content'],
  ['designer', '/admin/explore', 'Explore Content'],
  ['user', '/admin/results', 'Home'],
  ['user', '/admin/explore', 'Home']
])('resolves %s access to %s through the existing route guard', (role, route, title) => {
  const roleStore = configureStore({ reducer: { auth }, preloadedState: {
    auth: { isAuthenticated: true, isLoading: false, user: { role } }
  } });
  render(<Provider store={roleStore}><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></Provider>);
  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
});

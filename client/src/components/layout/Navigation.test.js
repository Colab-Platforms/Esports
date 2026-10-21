import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth from '../../store/slices/authSlice';
import Navbar from './Navbar';
import AdminDashboard from '../../pages/admin/AdminDashboard';
import api from '../../services/api';

jest.mock('../../services/api');
jest.mock('../notifications/NotificationPanel', () => () => null);
jest.mock('../common/UserAvatar', () => () => null);

const renderForRole = (Component, role) => {
  const store = configureStore({ reducer: { auth }, preloadedState: {
    auth: { isAuthenticated: Boolean(role), user: role ? { role, username: 'fictional-user' } : null }
  } });
  return render(<Provider store={store}><MemoryRouter><Component /></MemoryRouter></Provider>);
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: { balance: 0, games: [] } });
});

test.each([null, 'user', 'designer', 'moderator', 'admin'])('navigation preserves access boundaries for %s on desktop and mobile', async role => {
  renderForRole(Navbar, role);
  await act(async () => {});
  expect(screen.getByRole('link', { name: 'EXPLORE' })).toHaveAttribute('href', '/explore');
  const privileged = ['admin', 'moderator', 'designer'].includes(role);
  if (privileged) fireEvent.click(screen.getByRole('button', { name: 'CONTROLS' }));
  else expect(screen.queryByRole('button', { name: 'CONTROLS' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));
  expect(screen.getAllByRole('link', { name: 'EXPLORE' })).toHaveLength(2);
  const dashboardLinks = screen.queryAllByRole('link', { name: 'DASHBOARD' });
  expect(dashboardLinks).toHaveLength(0);
  const resultLinks = screen.queryAllByRole('link', { name: /result management/i });
  expect(resultLinks).toHaveLength(['admin', 'moderator'].includes(role) ? 2 : 0);
  resultLinks.forEach(link => expect(link).toHaveAttribute('href', '/admin/results'));
  const valorantLinks = screen.queryAllByRole('link', { name: /valorant registrations/i });
  expect(valorantLinks).toHaveLength(['admin', 'moderator'].includes(role) ? 2 : 0);
  valorantLinks.forEach(link => expect(link).toHaveAttribute('href', '/admin/valorant-registrations'));
  const exploreLinks = screen.queryAllByRole('link', { name: /explore content/i });
  expect(exploreLinks).toHaveLength(privileged ? 2 : 0);
  exploreLinks.forEach(link => expect(link).toHaveAttribute('href', '/admin/explore'));
  expect(screen.getAllByRole('link', { name: 'GAMES' }).filter(link => link.getAttribute('href') === '/games')).toHaveLength(2);
});

test.each(['user', 'designer', 'moderator', 'admin'])('dashboard links use the existing feature roles for %s', async role => {
  renderForRole(AdminDashboard, role);
  expect(screen.queryByRole('link', { name: /Result Management/ }) !== null).toBe(['admin', 'moderator'].includes(role));
  expect(screen.queryByRole('link', { name: /Explore Content/ }) !== null).toBe(['admin', 'moderator', 'designer'].includes(role));
  expect(screen.getByRole('link', { name: /Games Management/ })).toHaveAttribute('href', '/admin/games');
  expect(await screen.findByText('Admin Dashboard')).toBeInTheDocument();
  await act(async () => {});
});

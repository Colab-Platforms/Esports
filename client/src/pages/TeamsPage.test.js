import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import TeamsPage from './TeamsPage';

jest.mock('axios');
jest.mock('react-redux', () => ({ useSelector: jest.fn() }));
jest.mock('../components/teams/MyTeamsTab', () => () => null);

test.each([false, true])('player emails are absent when authenticated=%s, even in an older API response', async isAuthenticated => {
  useSelector.mockReturnValue({ user: { _id: 'viewer' }, token: 'token', isAuthenticated });
  axios.get.mockResolvedValue({ data: { success: true, data: {
    players: [{ _id: 'player', username: 'VisiblePlayer', email: 'private@example.test' }],
    pagination: { totalPages: 1, totalPlayers: 1 }, requests: [], friends: []
  } } });
  render(<MemoryRouter><TeamsPage /></MemoryRouter>);
  expect(await screen.findByText('VisiblePlayer')).toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Email' })).not.toBeInTheDocument();
  expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
  expect(screen.getByTitle('View Profile')).toBeInTheDocument();
});

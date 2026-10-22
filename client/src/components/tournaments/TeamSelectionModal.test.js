import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth from '../../store/slices/authSlice';
import axios from 'axios';
import TeamSelectionModal from './TeamSelectionModal';
jest.mock('axios');
jest.mock('../common/UserAvatar', () => () => null);
jest.mock('../teams/CreateTeamModal', () => () => null);
const members = Array.from({ length: 6 }, (_, i) => ({
  _id: `member-${i}`, userId: { _id: `user-${i}`, username: `Fiction ${i}`, gameIds: { valorant: `Player${i}#TAG` } },
  role: i === 0 ? 'captain' : 'member', isSubstitute: i === 5
}));
const setup = (teamMembers = members, entryFee = 0) => {
  axios.get.mockResolvedValue({ data: { success: true, data: { teams: [
    { _id: 'team', name: 'Owned Team', game: 'valorant', captain: 'user-0', maxMembers: 6, members: teamMembers },
    { _id: 'other-team', name: 'Another Captain Team', game: 'valorant', captain: 'user-1', members }
  ] } } });
  const onRegister = jest.fn();
  render(<Provider store={configureStore({ reducer: { auth }, preloadedState: { auth: { user: { id: 'user-0' } } } })}>
    <TeamSelectionModal tournament={{ gameType: 'valorant', name: 'Fiction Cup', entryFee }} token="synthetic" onRegister={onRegister} />
  </Provider>);
  return onRegister;
};
beforeEach(() => { jest.clearAllMocks(); });
test('shows captain-owned Valorant teams and allows a complete free 5+1 roster', async () => {
  const onRegister = setup();
  expect(await screen.findByText('Free registration')).toBeInTheDocument();
  expect(screen.getByText('FREE')).toBeInTheDocument();
  expect(screen.getByText('Select a team')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('heading', { name: 'Owned Team' }));
  expect(screen.queryByText('Another Captain Team')).not.toBeInTheDocument();
  expect(screen.queryByText('Select a team')).not.toBeInTheDocument();
  const registerButton = screen.getByRole('button', { name: /register/i });
  expect(registerButton).toBeEnabled(); fireEvent.click(registerButton);
  expect(onRegister).toHaveBeenCalledWith(expect.objectContaining({ _id: 'team' }), expect.any(String), {});
});
test.each([
  ['missing substitute', members.slice(0, 5), 0, /five starters and one substitute/],
  ['invalid fee', members, -1, /Tournament fee is invalid/]
])('blocks %s before submitting', async (_, roster, fee, message) => {
  const onRegister = setup(roster, fee); fireEvent.click(await screen.findByRole('heading', { name: 'Owned Team' }));
  expect((await screen.findAllByText(message)).length).toBeGreaterThan(0);
  await waitFor(() => expect(screen.getByRole('button', { name: /register/i })).toBeDisabled());
  expect(onRegister).not.toHaveBeenCalled();
});

test('complete paid Valorant roster can proceed to server-owned checkout', async () => {
  const onRegister = setup(members, 500);
  expect(await screen.findByText('Entry fee per team')).toBeInTheDocument();
  expect(screen.getByText('₹500')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('heading', { name: 'Owned Team' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pay ₹500' }));
  expect(onRegister).toHaveBeenCalledTimes(1);
});

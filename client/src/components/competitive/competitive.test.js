import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import api from '../../services/api';
import axios from 'axios';
import TournamentFinalResults from './TournamentFinalResults';
import PlayerCompetitivePanels from './PlayerCompetitivePanels';
import CompetitiveLeaderboardPage from '../../pages/CompetitiveLeaderboardPage';
import PublicProfile from '../../pages/PublicProfile';

jest.mock('../../services/api');
jest.mock('axios');
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

test('final standings keep unlinked teams readable and label stale results', async () => {
  api.getTournamentFinalResult.mockResolvedValue({ data: { finalResult: { status: 'needs_republish', coverage: {},
    standings: [{ rank: 1, registrationId: 'registration', canonicalTeamId: null, teamName: 'Private team', totalPoints: 16 }], evidence: [] } } });
  render(<MemoryRouter><TournamentFinalResults tournamentId="tournament" /></MemoryRouter>);
  expect(await screen.findByText('Private team')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Private team' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('awaiting review');
});

test('final standings show only canonical links supplied by the public API', async () => {
  api.getTournamentFinalResult.mockResolvedValue({ data: { finalResult: { status: 'published', coverage: {},
    standings: [{ rank: 1, canonicalTeamId: 'public-team', teamName: 'Public team' }], evidence: [] } } });
  render(<MemoryRouter><TournamentFinalResults tournamentId="tournament" /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'Public team' })).toHaveAttribute('href', '/team/public-team');
});

test('competitive profile respects a private-profile API rejection', async () => {
  api.getPlayerCompetitiveProfile.mockRejectedValue(new Error('Player not found'));
  api.getPlayerCompetitiveHistory.mockResolvedValue({ data: { history: [] } });
  api.getPlayerStatistics.mockResolvedValue({ data: {} });
  render(<MemoryRouter><PlayerCompetitivePanels username="private-player" /></MemoryRouter>);
  expect(await screen.findByText(/available for public profiles only/)).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Competitive profile' })).not.toBeInTheDocument();
});

test('player panels render real numeric statistics and avoid unsupported CS2 team links', async () => {
  api.getPlayerCompetitiveProfile.mockResolvedValue({ data: {
    overview: { tournamentsJoined: 2, activeTeams: 1 }, accounts: [],
    teams: [{ id: 'cs2-team', name: 'CS2 Team', game: 'cs2' }]
  } });
  api.getPlayerCompetitiveHistory.mockResolvedValue({ data: { history: [] } });
  api.getPlayerStatistics.mockResolvedValue({ data: { coverage: { note: 'Verified results only' }, games: {
    freefire: { performance: { matchesPlayed: 3, wins: 1, individualKills: { supported: false, value: null } } }
  } } });
  render(<MemoryRouter><PlayerCompetitivePanels username="public-player" /></MemoryRouter>);
  expect(await screen.findByText('matches Played')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('CS2 Team')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'CS2 Team' })).not.toBeInTheDocument();
  expect(screen.queryByText('individual Kills')).not.toBeInTheDocument();
});

test('competitive ranking game changes reset pagination and retain legacy navigation', async () => {
  api.getCompetitiveLeaderboard.mockResolvedValue({ data: { coverage: { note: 'Verified results only' }, entries: [], pagination: { hasMore: true } } });
  render(<MemoryRouter><CompetitiveLeaderboardPage /></MemoryRouter>);
  expect(await screen.findByText('No verified results for public teams yet.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.getCompetitiveLeaderboard).toHaveBeenLastCalledWith('bgmi', { page: 2 }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'valorant' } });
  await waitFor(() => expect(api.getCompetitiveLeaderboard).toHaveBeenLastCalledWith('valorant', { page: 1 }));
  expect(screen.getByRole('link', { name: 'Player and CS2 leaderboards' })).toHaveAttribute('href', '/leaderboard');
});

test('public profile retains its existing friend-request action beside competitive panels', async () => {
  localStorage.setItem('token', 'test-token');
  axios.get.mockImplementation(url => Promise.resolve(url.includes('tournament-history')
    ? { data: { success: true, data: { tournaments: [] } } }
    : { data: { _id: 'friend-user', username: 'friend-player', fullName: 'Friend Player', games: [], friends: [], stats: {}, gameIds: {} } }));
  axios.post.mockResolvedValue({ data: { success: true } });
  api.getPlayerCompetitiveProfile.mockResolvedValue({ success: true, data: {
    player: { username: 'friend-player', displayName: 'Friend Player' },
    accounts: [], games: [], overview: {}, teams: [], tournamentHistory: [], achievements: []
  } });
  api.getPlayerCompetitiveHistory.mockResolvedValue({ success: true, data: { history: [] } });
  api.getPlayerStatistics.mockResolvedValue({ data: {} });
  render(<MemoryRouter initialEntries={['/player/friend-player']}><Routes><Route path="/player/:username" element={<PublicProfile />} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /add friend/i }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/users/friend-request'), { recipientId: 'friend-user' }, expect.any(Object)));
  expect(await screen.findByRole('button', { name: /request pending/i })).toBeDisabled();
});

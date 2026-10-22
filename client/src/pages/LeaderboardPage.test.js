import React, { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LeaderboardPage from './LeaderboardPage';
import api from '../services/api';
jest.mock('../services/api');
const image = (name = 'Legacy Cup') => ({ _id: name, imageUrl: 'https://images.example.test/score.png',
  description: 'Historical scoreboard', uploadedAt: 'invalid-date', tournament: { id: 'cup-one', name } });
const boards = (rows = []) => ({ success: true, data: { scoreboards: rows, pagination: { page: 1, total: rows.length, hasMore: false } } });
const directory = () => ({ success: true, data: { tournaments: [], pagination: { page: 1, total: 0, hasMore: false } } });
const mount = (path = '/leaderboard', strict = false) => render(<MemoryRouter initialEntries={[path]}>{strict ? <StrictMode><LeaderboardPage /></StrictMode> : <LeaderboardPage />}</MemoryRouter>);
beforeAll(() => { window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} }); });
beforeEach(() => { jest.resetAllMocks(); api.get.mockResolvedValue(boards()); api.getTournamentResultsDirectory.mockResolvedValue(directory()); });

test('legacy images are the default and do not require a publication request', async () => {
  api.get.mockResolvedValue(boards([image()])); mount();
  expect(await screen.findByRole('link', { name: 'Open scoreboard: Legacy Cup' })).toHaveAttribute('href', 'https://images.example.test/score.png');
  expect(screen.getByText('Uploaded: Date unavailable')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Scoreboards' })).toHaveAttribute('aria-selected', 'true');
  expect(api.getTournamentResultsDirectory).not.toHaveBeenCalled();
});
test.each([['BGMI', 'bgmi'], ['Free Fire', 'freefire'], ['Valorant', 'valorant']])('%s has separate images and published results views', async (label, game) => {
  mount('/leaderboard?game=' + game);
  expect(await screen.findByText(`No scoreboard images uploaded yet for ${label}.`)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Published Results' }));
  expect(await screen.findByText('No published tournament results yet')).toBeInTheDocument();
  expect(api.getTournamentResultsDirectory).toHaveBeenLastCalledWith({ gameType: game, page: 1, limit: 12 });
  fireEvent.click(screen.getByRole('tab', { name: 'Scoreboards' }));
  expect(await screen.findByText(`No scoreboard images uploaded yet for ${label}.`)).toBeInTheDocument();
});
test('published results show ranks, safe team links and the existing full-results route', async () => {
  const data = directory(); data.data.tournaments = [{ tournamentId: 'cup-one', name: 'Published Cup', gameType: 'bgmi', resultStatus: 'needs_republish',
    winner: { teamName: 'Private Winner', canonicalTeamId: null }, topStandings: [{ rank: 1, teamName: 'Private Winner', canonicalTeamId: null }],
    scoreboardAvailable: true, scoreboardCount: 2 }];
  api.getTournamentResultsDirectory.mockResolvedValue(data);
  mount('/leaderboard?game=bgmi&view=published');
  fireEvent.click(await screen.findByRole('button', { name: /Published Cup/ }));
  expect(screen.getByText('#1')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Private Winner' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /View Full Results/ })).toHaveAttribute('href', '/tournament/cup-one?tab=results');
});
test('gallery failures can retry and stale responses cannot replace the active game', async () => {
  let resolveOld;
  api.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(boards([image('Free Fire Cup')]));
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Free Fire' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry scoreboards' }));
  expect(await screen.findByRole('link', { name: 'Free Fire Cup' })).toBeInTheDocument();
  await act(async () => { resolveOld(boards([image('Stale BGMI Cup')])); });
  expect(screen.queryByRole('link', { name: 'Stale BGMI Cup' })).not.toBeInTheDocument();
});
test('gallery pagination resets when games change and unsafe image URLs are not linked', async () => {
  const first = boards([image()]); first.data.pagination.hasMore = true;
  api.get.mockResolvedValueOnce(first).mockResolvedValue(boards([{ ...image('Next Cup'), imageUrl: 'javascript:alert(1)' }]));
  mount(); fireEvent.click(await screen.findByRole('button', { name: 'Next scoreboards' }));
  expect(await screen.findByText('Image unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Open scoreboard/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Valorant' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/tournaments/scoreboards-gallery', { params: { gameType: 'valorant', page: 1, limit: 12 } }));
});
test('CS2 rankings and competitive team navigation stay accessible', async () => {
  api.get.mockImplementation(path => Promise.resolve(path.includes('all-players') ? { success: true, leaderboard: [{ accountid: 'player', rank: 1, displayName: 'CS2 Player', stats: { total_kills: 12 } }] } : { success: true, stats: { total_matches: 3 } }));
  mount('/leaderboard?game=cs2');
  expect(await screen.findByText('CS2 Player')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Competitive team rankings' })).toHaveAttribute('href', '/competitive-leaderboards');
});

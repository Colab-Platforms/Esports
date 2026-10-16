import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GamesPage from './GamesPage';
import api from '../services/api';
import imageService from '../services/imageService';

jest.mock('../services/api');
jest.mock('../services/imageService');
jest.mock('../components/common/GameIcon', () => () => null);
jest.mock('../assets/gameAssets', () => ({ getGameAsset: () => '' }));

const bgmi = { id: 'bgmi', name: 'BGMI', description: 'Fictional mobile game' };
const valorant = { id: 'valorant', name: 'Valorant', description: 'Fictional tactical game' };
const cache = games => localStorage.setItem('games_cache', JSON.stringify({ data: games, timestamp: Date.now() }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  imageService.getAllImages.mockResolvedValue({ success: true, data: {} });
});

test('renders cached games immediately, refreshes the catalogue, and preserves the selected card', async () => {
  cache([bgmi]);
  localStorage.setItem('site_images_cache', JSON.stringify({ data: {}, timestamp: Date.now() }));
  let resolveGames;
  api.getGames.mockReturnValue(new Promise(resolve => { resolveGames = resolve; }));
  render(<MemoryRouter><GamesPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { name: 'BGMI' })).toBeInTheDocument();
  expect(api.getGames).toHaveBeenCalledTimes(1);
  await act(async () => resolveGames({ data: { games: [bgmi, valorant] } }));
  expect(screen.getByRole('heading', { name: 'BGMI' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /VALORANT/ }));
  expect(await screen.findByRole('heading', { name: 'Valorant' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('games_cache')).data).toEqual([bgmi, valorant]);
  expect(screen.getByRole('link', { name: /Valorant/ })).toHaveAttribute('href', '/tournaments');
});

test('a background failure preserves cached games even without cached images', async () => {
  cache([bgmi]);
  api.getGames.mockRejectedValue(new Error('Synthetic offline failure'));
  render(<MemoryRouter><GamesPage /></MemoryRouter>);
  await act(async () => {});
  expect(screen.getByRole('heading', { name: 'BGMI' })).toBeInTheDocument();
  expect(screen.queryByText(/Failed to load games/)).not.toBeInTheDocument();
});

test('an image-service failure does not prevent a fresh catalogue from loading', async () => {
  api.getGames.mockResolvedValue({ data: { games: [valorant] } });
  imageService.getAllImages.mockRejectedValue(new Error('Synthetic image failure'));
  render(<MemoryRouter><GamesPage /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Valorant' })).toBeInTheDocument();
});

test('expired catalogue entries are replaced and uncached errors remain visible', async () => {
  localStorage.setItem('games_cache', JSON.stringify({ data: [bgmi], timestamp: Date.now() - 301000 }));
  api.getGames.mockRejectedValue(new Error('Synthetic offline failure'));
  render(<MemoryRouter><GamesPage /></MemoryRouter>);
  expect(await screen.findByText(/Failed to load games/)).toBeInTheDocument();
  expect(localStorage.getItem('games_cache')).toBeNull();
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GamesManagement from './GamesManagement';
import toast from 'react-hot-toast';

jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));
const game = { id: 'bgmi', name: 'BGMI', fullName: 'Fictional Game', description: 'Synthetic', isActive: true };
let mutationOK;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('games_cache', 'old catalogue');
  mutationOK = true;
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  global.fetch = jest.fn((url, options = {}) => Promise.resolve(options.method
    ? { ok: mutationOK }
    : { json: async () => ({ data: { games: [game] } }) }));
});
afterEach(() => { jest.restoreAllMocks(); });

test.each(['POST', 'PUT', 'DELETE'])('successful %s invalidates the browser catalogue and bypasses HTTP caching', async method => {
  const { container } = render(<GamesManagement />);
  await screen.findByRole('heading', { name: 'BGMI' });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/games'), { cache: 'no-store' });
  if (method === 'POST') fireEvent.click(screen.getByRole('button', { name: 'Add Game' }));
  else {
    const buttons = container.querySelector('.card-gaming').querySelectorAll('button');
    fireEvent.click(buttons[method === 'PUT' ? 0 : 1]);
  }
  if (method !== 'DELETE') fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(localStorage.getItem('games_cache')).toBeNull());
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/games'), expect.objectContaining({ method }));
  expect(toast.success).toHaveBeenCalledTimes(1);
});

test.each(['POST', 'PUT', 'DELETE'])('failed %s retains the browser cache', async method => {
  mutationOK = false;
  const { container } = render(<GamesManagement />);
  await screen.findByRole('heading', { name: 'BGMI' });
  if (method === 'POST') fireEvent.click(screen.getByRole('button', { name: 'Add Game' }));
  else fireEvent.click(container.querySelector('.card-gaming').querySelectorAll('button')[method === 'PUT' ? 0 : 1]);
  if (method !== 'DELETE') fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method })));
  expect(localStorage.getItem('games_cache')).toBe('old catalogue');
  expect(toast.success).not.toHaveBeenCalled();
});

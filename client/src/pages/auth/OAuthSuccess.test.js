import React, { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth from '../../store/slices/authSlice';
import api from '../../services/api';
import OAuthSuccess from './OAuthSuccess';

jest.mock('../../services/api');
jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

const mount = path => {
  const store = configureStore({ reducer: { auth } });
  render(<StrictMode><Provider store={store}><MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/auth/success" element={<OAuthSuccess />} />
      <Route path="/" element={<p>Signed in</p>} />
      <Route path="/login" element={<p>Try signing in again</p>} />
    </Routes>
  </MemoryRouter></Provider></StrictMode>);
  return store;
};

test('single-use code is exchanged once in StrictMode and authenticated user is stored', async () => {
  api.post.mockResolvedValue({ data: { token: 'synthetic-token' } });
  api.get.mockResolvedValue({ data: { user: { _id: 'user-a', username: 'fictional-user' } } });
  const store = mount('/auth/success?code=synthetic-code&provider=google');
  expect(await screen.findByText('Signed in')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/api/auth/exchange', { code: 'synthetic-code', provider: 'google' });
  expect(store.getState().auth.user._id).toBe('user-a');
  expect(localStorage.getItem('token')).toBe('synthetic-token');
});

test('expired code returns to login without creating an authenticated session', async () => {
  api.post.mockRejectedValue(new Error('Expired code'));
  const store = mount('/auth/success?code=expired-code&provider=google');
  await waitFor(() => expect(screen.getByText('Try signing in again')).toBeInTheDocument());
  expect(store.getState().auth.isAuthenticated).toBe(false);
  expect(localStorage.getItem('token')).toBe(null);
});

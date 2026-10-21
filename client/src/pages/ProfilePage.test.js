import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProfilePage from './ProfilePage';
jest.mock('../components/profile/ProfileSettingsForm', () => () => <div>Profile settings</div>);
jest.mock('../services/api');
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

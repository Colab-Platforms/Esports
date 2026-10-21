import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import auth, { logout, loginSuccess } from '../store/slices/authSlice';
import api from '../services/api';
import useActivityStreakCheckIn, { getActivityDayKey } from './useActivityStreakCheckIn';

jest.mock('../services/api');
const success = (day = '2026-01-01', streak = 1) => ({ success: true, data: {
  checkedInToday: true, activityStreak: streak, longestActivityStreak: streak, totalActiveDays: streak, lastActivityDayKey: day
} });
let store;
const mount = () => renderHook(() => useActivityStreakCheckIn(), {
  wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
});
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-01-01T18:29:30Z'));
  jest.clearAllMocks(); localStorage.clear();
  store = configureStore({ reducer: { auth }, preloadedState: { auth: {
    isAuthenticated: true, user: { id: 'player-one', loginStreak: 6 }, token: 'synthetic-token'
  } } });
});
afterEach(() => jest.useRealTimers());

test('checks in once, updates profile without changing reward streak and checks again after IST midnight', async () => {
  api.checkInActivityStreak.mockResolvedValueOnce(success()).mockResolvedValueOnce(success('2026-01-02', 2));
  mount();
  await act(async () => {});
  expect(store.getState().auth.user.activityStreak).toBe(1);
  expect(store.getState().auth.user.loginStreak).toBe(6);
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(api.checkInActivityStreak).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(api.checkInActivityStreak).toHaveBeenCalledTimes(2);
  expect(store.getState().auth.user.activityStreak).toBe(2);
  expect(getActivityDayKey(new Date('2026-01-01T18:30:00Z'))).toBe('2026-01-02');
});

test('failure retries on focus and requests in flight do not duplicate', async () => {
  let finish;
  api.checkInActivityStreak.mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(); await act(async () => {});
  await act(async () => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')); });
  expect(api.checkInActivityStreak).toHaveBeenCalledTimes(2);
  await act(async () => { finish(success()); });
  expect(store.getState().auth.user.activityStreak).toBe(1);
});

test('logout and account switching discard a stale response', async () => {
  let finish;
  api.checkInActivityStreak.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(success('2026-01-01', 3));
  mount();
  act(() => { store.dispatch(logout()); });
  act(() => { store.dispatch(loginSuccess({ user: { id: 'player-two' }, token: 'other-synthetic-token' })); });
  await act(async () => {});
  await act(async () => { finish(success('2026-01-01', 99)); });
  expect(store.getState().auth.user.id).toBe('player-two');
  expect(store.getState().auth.user.activityStreak).toBe(3);
});

test('anonymous sessions never check in and unmount removes timers and listeners', async () => {
  act(() => { store.dispatch(logout()); });
  const { unmount } = mount();
  await act(async () => {});
  expect(api.checkInActivityStreak).not.toHaveBeenCalled();
  unmount();
  await act(async () => { jest.advanceTimersByTime(120000); window.dispatchEvent(new Event('focus')); });
  expect(api.checkInActivityStreak).not.toHaveBeenCalled();
});

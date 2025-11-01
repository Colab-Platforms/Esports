import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authSlice from './slices/authSlice';
import tournamentSlice from './slices/tournamentSlice';
import matchSlice from './slices/matchSlice';
import leaderboardSlice from './slices/leaderboardSlice';
import walletSlice from './slices/walletSlice';
import notificationSlice from './slices/notificationSlice';
import { apiSlice } from './api/apiSlice';

export const store = configureStore({
  reducer: {
    // API slice
    [apiSlice.reducerPath]: apiSlice.reducer,
    
    // Feature slices
    auth: authSlice,
    tournaments: tournamentSlice,
    matches: matchSlice,
    leaderboard: leaderboardSlice,
    wallet: walletSlice,
    notifications: notificationSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(apiSlice.middleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Enable listener behavior for the store
setupListeners(store.dispatch);

export default store;
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks for leaderboard operations
export const fetchLeaderboard = createAsyncThunk(
  'leaderboard/fetchLeaderboard',
  async ({ gameType = 'bgmi', leaderboardType = 'overall', tournamentId, page = 1, limit = 50 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('gameType', gameType);
      params.append('leaderboardType', leaderboardType);
      params.append('page', page);
      params.append('limit', limit);
      
      if (tournamentId) {
        params.append('tournamentId', tournamentId);
      }

      const response = await axios.get(`/api/leaderboard?${params}`);
      
      return { ...response.data.data, gameType, leaderboardType, tournamentId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch leaderboard' });
    }
  }
);

export const fetchUserPosition = createAsyncThunk(
  'leaderboard/fetchUserPosition',
  async ({ userId, gameType = 'bgmi', leaderboardType = 'overall', tournamentId }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('gameType', gameType);
      params.append('leaderboardType', leaderboardType);
      
      if (tournamentId) {
        params.append('tournamentId', tournamentId);
      }

      const response = await axios.get(`/api/leaderboard/user/${userId}?${params}`);
      return response.data.data.userPosition;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch user position' });
    }
  }
);

export const fetchMyPosition = createAsyncThunk(
  'leaderboard/fetchMyPosition',
  async ({ gameType = 'bgmi', leaderboardType = 'overall', tournamentId }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('gameType', gameType);
      params.append('leaderboardType', leaderboardType);
      
      if (tournamentId) {
        params.append('tournamentId', tournamentId);
      }

      const response = await axios.get(`/api/leaderboard/me?${params}`);
      return response.data.data.userPosition;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch user position' });
    }
  }
);

export const fetchTopPerformers = createAsyncThunk(
  'leaderboard/fetchTopPerformers',
  async ({ gameType = 'bgmi', leaderboardType = 'overall', limit = 10 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.append('gameType', gameType);
      params.append('leaderboardType', leaderboardType);
      params.append('limit', limit);

      const response = await axios.get(`/api/leaderboard/top-performers?${params}`);
      
      return response.data.data.topPerformers;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch top performers' });
    }
  }
);

export const fetchLeaderboardStats = createAsyncThunk(
  'leaderboard/fetchLeaderboardStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/leaderboard/stats');
      return response.data.data.stats;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch leaderboard stats' });
    }
  }
);

const initialState = {
  leaderboard: [],
  userPosition: null,
  topPerformers: [],
  stats: [],
  currentFilters: {
    gameType: 'bgmi',
    leaderboardType: 'overall',
    tournamentId: null
  },
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  },
  loading: {
    leaderboard: false,
    userPosition: false,
    topPerformers: false,
    stats: false
  },
  error: {
    leaderboard: null,
    userPosition: null,
    topPerformers: null,
    stats: null
  }
};

const leaderboardSlice = createSlice({
  name: 'leaderboard',
  initialState,
  reducers: {
    clearLeaderboardError: (state, action) => {
      const errorType = action.payload;
      if (errorType && state.error[errorType]) {
        state.error[errorType] = null;
      } else {
        // Clear all errors
        Object.keys(state.error).forEach(key => {
          state.error[key] = null;
        });
      }
    },
    setLeaderboardFilters: (state, action) => {
      state.currentFilters = { ...state.currentFilters, ...action.payload };
    },
    clearLeaderboard: (state) => {
      state.leaderboard = [];
      state.userPosition = null;
      state.topPerformers = [];
    },
    updateUserRank: (state, action) => {
      const { userId, newRank } = action.payload;
      
      // Update in leaderboard
      const userIndex = state.leaderboard.findIndex(entry => entry.userId._id === userId);
      if (userIndex !== -1) {
        state.leaderboard[userIndex].rank = newRank;
      }
      
      // Update user position if it's the same user
      if (state.userPosition && state.userPosition.userId._id === userId) {
        state.userPosition.rank = newRank;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch leaderboard
      .addCase(fetchLeaderboard.pending, (state) => {
        state.loading.leaderboard = true;
        state.error.leaderboard = null;
      })
      .addCase(fetchLeaderboard.fulfilled, (state, action) => {
        state.loading.leaderboard = false;
        state.leaderboard = action.payload.leaderboard;
        state.pagination = action.payload.pagination;
        state.currentFilters = {
          gameType: action.payload.gameType,
          leaderboardType: action.payload.leaderboardType,
          tournamentId: action.payload.tournamentId
        };
      })
      .addCase(fetchLeaderboard.rejected, (state, action) => {
        state.loading.leaderboard = false;
        state.error.leaderboard = action.payload;
      })
      
      // Fetch user position
      .addCase(fetchUserPosition.pending, (state) => {
        state.loading.userPosition = true;
        state.error.userPosition = null;
      })
      .addCase(fetchUserPosition.fulfilled, (state, action) => {
        state.loading.userPosition = false;
        state.userPosition = action.payload;
      })
      .addCase(fetchUserPosition.rejected, (state, action) => {
        state.loading.userPosition = false;
        state.error.userPosition = action.payload;
      })
      
      // Fetch my position
      .addCase(fetchMyPosition.pending, (state) => {
        state.loading.userPosition = true;
        state.error.userPosition = null;
      })
      .addCase(fetchMyPosition.fulfilled, (state, action) => {
        state.loading.userPosition = false;
        state.userPosition = action.payload;
      })
      .addCase(fetchMyPosition.rejected, (state, action) => {
        state.loading.userPosition = false;
        state.error.userPosition = action.payload;
      })
      
      // Fetch top performers
      .addCase(fetchTopPerformers.pending, (state) => {
        state.loading.topPerformers = true;
        state.error.topPerformers = null;
      })
      .addCase(fetchTopPerformers.fulfilled, (state, action) => {
        state.loading.topPerformers = false;
        state.topPerformers = action.payload;
      })
      .addCase(fetchTopPerformers.rejected, (state, action) => {
        state.loading.topPerformers = false;
        state.error.topPerformers = action.payload;
      })
      
      // Fetch leaderboard stats
      .addCase(fetchLeaderboardStats.pending, (state) => {
        state.loading.stats = true;
        state.error.stats = null;
      })
      .addCase(fetchLeaderboardStats.fulfilled, (state, action) => {
        state.loading.stats = false;
        state.stats = action.payload;
      })
      .addCase(fetchLeaderboardStats.rejected, (state, action) => {
        state.loading.stats = false;
        state.error.stats = action.payload;
      });
  }
});

export const {
  clearLeaderboardError,
  setLeaderboardFilters,
  clearLeaderboard,
  updateUserRank
} = leaderboardSlice.actions;

// Selectors
export const selectLeaderboard = (state) => state.leaderboard.leaderboard;
export const selectUserPosition = (state) => state.leaderboard.userPosition;
export const selectTopPerformers = (state) => state.leaderboard.topPerformers;
export const selectLeaderboardStats = (state) => state.leaderboard.stats;
export const selectLeaderboardLoading = (state) => state.leaderboard.loading;
export const selectLeaderboardError = (state) => state.leaderboard.error;
export const selectLeaderboardFilters = (state) => state.leaderboard.currentFilters;
export const selectLeaderboardPagination = (state) => state.leaderboard.pagination;

// Get user rank from leaderboard
export const selectUserRank = (userId) => (state) => {
  const entry = state.leaderboard.leaderboard.find(entry => entry.userId._id === userId);
  return entry ? entry.rank : null;
};

// Get top N players from current leaderboard
export const selectTopNPlayers = (limit = 10) => (state) => {
  return state.leaderboard.leaderboard.slice(0, limit);
};

export default leaderboardSlice.reducer;
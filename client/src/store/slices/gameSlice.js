import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Get API base URL from environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Create axios instance with timeout
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000 // 10 second timeout
});

// Store for cancel tokens - use Map to track per-thunk requests
const cancelTokens = new Map();
let lastRequestTime = 0;

// Async thunks for game operations
export const fetchGames = createAsyncThunk(
  'games/fetchGames',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const thunkName = 'games/fetchGames';
      const now = Date.now();
      
      // Only cancel previous request if it was initiated more than 100ms ago
      // This prevents cancelling on React strict mode double renders
      if (cancelTokens.has(thunkName) && (now - lastRequestTime) > 100) {
        const previousToken = cancelTokens.get(thunkName);
        previousToken.cancel('New request initiated');
      }
      
      lastRequestTime = now;
      
      // Create new cancel token for this request
      const newCancelToken = axios.CancelToken.source();
      cancelTokens.set(thunkName, newCancelToken);

      const params = new URLSearchParams();
      if (filters.featured) params.append('featured', filters.featured);
      if (filters.isActive !== undefined) params.append('isActive', filters.isActive);

      console.log('🎮 Fetching games with timeout: 10s, cancelToken enabled');
      
      const response = await axiosInstance.get(`/api/games?${params}`, {
        cancelToken: newCancelToken.token
      });
      
      console.log('✅ Games fetched successfully:', response.data.data.games.length);
      // Clean up cancel token after successful request
      cancelTokens.delete('games/fetchGames');
      return response.data.data;
    } catch (error) {
      // Handle different error types
      if (axios.isCancel(error)) {
        console.log('⚠️ Games request cancelled');
        // Clean up cancel token
        cancelTokens.delete('games/fetchGames');
        return rejectWithValue({ 
          code: 'CANCELLED',
          message: 'Request was cancelled' 
        });
      }
      
      if (error.code === 'ECONNABORTED') {
        console.error('❌ Games request timeout (10s exceeded)');
        return rejectWithValue({ 
          code: 'TIMEOUT',
          message: 'Request took too long. Please check your internet connection and try again.' 
        });
      }
      
      if (error.response?.status === 503) {
        console.error('❌ Server temporarily unavailable');
        return rejectWithValue({ 
          code: 'SERVICE_UNAVAILABLE',
          message: 'Server is temporarily unavailable. Please try again in a moment.' 
        });
      }
      
      console.error('❌ Games fetch error:', error.message);
      return rejectWithValue(error.response?.data?.error || { 
        code: 'FETCH_FAILED',
        message: 'Failed to fetch games. Please check your internet connection.' 
      });
    }
  }
);

export const fetchGameById = createAsyncThunk(
  'games/fetchGameById',
  async (gameId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/games/${gameId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch game details' });
    }
  }
);

const initialState = {
  games: [],
  currentGame: null,
  isLoading: false,
  error: null
};

const gameSlice = createSlice({
  name: 'games',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setGames: (state, action) => {
      state.games = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setCurrentGame: (state, action) => {
      state.currentGame = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    clearCurrentGame: (state) => {
      state.currentGame = null;
    },
    resetGames: (state) => {
      // Clear all game data to force fresh fetch
      state.games = [];
      state.currentGame = null;
      state.error = null;
      state.isLoading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch games
      .addCase(fetchGames.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGames.fulfilled, (state, action) => {
        state.isLoading = false;
        state.games = action.payload.games;
      })
      .addCase(fetchGames.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Fetch game by ID
      .addCase(fetchGameById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGameById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentGame = action.payload;
      })
      .addCase(fetchGameById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  }
});

export const {
  setLoading,
  setError,
  clearError,
  setGames,
  setCurrentGame,
  clearCurrentGame,
  resetGames
} = gameSlice.actions;

// Selectors
export const selectGames = (state) => state.games.games || [];
export const selectCurrentGame = (state) => state.games.currentGame;
export const selectGameLoading = (state) => state.games.isLoading;
export const selectGameError = (state) => state.games.error;

export default gameSlice.reducer;

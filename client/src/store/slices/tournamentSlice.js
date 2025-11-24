import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Get API base URL from environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Async thunks for tournament operations
export const fetchTournaments = createAsyncThunk(
  'tournaments/fetchTournaments',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (filters.gameType && filters.gameType !== 'all') params.append('gameType', filters.gameType);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.entryFeeMin) params.append('entryFeeMin', filters.entryFeeMin);
      if (filters.entryFeeMax) params.append('entryFeeMax', filters.entryFeeMax);
      if (filters.prizePoolMin) params.append('prizePoolMin', filters.prizePoolMin);
      if (filters.prizePoolMax) params.append('prizePoolMax', filters.prizePoolMax);
      if (filters.page) params.append('page', filters.page);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await axios.get(`${API_BASE_URL}/api/tournaments?${params}`);
      
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch tournaments' });
    }
  }
);

export const fetchTournamentById = createAsyncThunk(
  'tournaments/fetchTournamentById',
  async (tournamentId, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const headers = {};
      if (auth.token) {
        headers.Authorization = `Bearer ${auth.token}`;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/tournaments/${tournamentId}`, { headers });
      return {
        tournament: response.data.data.tournament,
        isUserRegistered: response.data.data.isUserRegistered,
        roomDetails: response.data.data.roomDetails
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch tournament details' });
    }
  }
);

export const joinTournament = createAsyncThunk(
  'tournaments/joinTournament',
  async ({ tournamentId, gameId, teamName }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/tournaments/${tournamentId}/join`, {
        gameId,
        teamName
      });
      return response.data.data.tournament;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to join tournament' });
    }
  }
);

const initialState = {
  tournaments: [],
  currentTournament: null,
  filters: {
    gameType: 'all',
    status: 'all',
    entryFee: 'all',
    prizePool: 'all'
  },
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  }
};

const tournamentSlice = createSlice({
  name: 'tournaments',
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
    setTournaments: (state, action) => {
      state.tournaments = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    addTournament: (state, action) => {
      state.tournaments.unshift(action.payload);
    },
    updateTournament: (state, action) => {
      const index = state.tournaments.findIndex(t => t._id === action.payload._id);
      if (index !== -1) {
        state.tournaments[index] = { ...state.tournaments[index], ...action.payload };
      }
      if (state.currentTournament?._id === action.payload._id) {
        state.currentTournament = { ...state.currentTournament, ...action.payload };
      }
    },
    removeTournament: (state, action) => {
      state.tournaments = state.tournaments.filter(t => t._id !== action.payload);
      if (state.currentTournament?._id === action.payload) {
        state.currentTournament = null;
      }
    },
    setCurrentTournament: (state, action) => {
      state.currentTournament = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    clearCurrentTournament: (state) => {
      state.currentTournament = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    resetTournaments: (state) => {
      // Clear all tournament data to force fresh fetch
      state.tournaments = [];
      state.currentTournament = null;
      state.error = null;
      state.isLoading = false;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    joinTournamentLocal: (state, action) => {
      const { tournamentId, userId } = action.payload;
      const tournament = state.tournaments.find(t => t._id === tournamentId);
      if (tournament) {
        tournament.participants = tournament.participants || [];
        if (!tournament.participants.includes(userId)) {
          tournament.participants.push(userId);
          tournament.currentParticipants = (tournament.currentParticipants || 0) + 1;
        }
      }
      if (state.currentTournament?._id === tournamentId) {
        state.currentTournament.participants = state.currentTournament.participants || [];
        if (!state.currentTournament.participants.includes(userId)) {
          state.currentTournament.participants.push(userId);
          state.currentTournament.currentParticipants = (state.currentTournament.currentParticipants || 0) + 1;
        }
      }
    },
    leaveTournament: (state, action) => {
      const { tournamentId, userId } = action.payload;
      const tournament = state.tournaments.find(t => t._id === tournamentId);
      if (tournament && tournament.participants) {
        tournament.participants = tournament.participants.filter(p => p !== userId);
        tournament.currentParticipants = Math.max(0, (tournament.currentParticipants || 0) - 1);
      }
      if (state.currentTournament?._id === tournamentId && state.currentTournament.participants) {
        state.currentTournament.participants = state.currentTournament.participants.filter(p => p !== userId);
        state.currentTournament.currentParticipants = Math.max(0, (state.currentTournament.currentParticipants || 0) - 1);
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch tournaments
      .addCase(fetchTournaments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTournaments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tournaments = action.payload.tournaments;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchTournaments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Fetch tournament by ID
      .addCase(fetchTournamentById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTournamentById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTournament = action.payload;
      })
      .addCase(fetchTournamentById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Join tournament
      .addCase(joinTournament.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(joinTournament.fulfilled, (state, action) => {
        state.isLoading = false;
        const updatedTournament = action.payload;
        
        // Update in tournaments array
        const index = state.tournaments.findIndex(t => t._id === updatedTournament._id);
        if (index !== -1) {
          state.tournaments[index] = updatedTournament;
        }
        
        // Update current tournament if it's the same
        if (state.currentTournament && state.currentTournament._id === updatedTournament._id) {
          state.currentTournament = updatedTournament;
        }
      })
      .addCase(joinTournament.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  }
});

export const {
  setLoading,
  setError,
  clearError,
  setTournaments,
  addTournament,
  updateTournament,
  removeTournament,
  setCurrentTournament,
  clearCurrentTournament,
  setFilters,
  resetFilters,
  resetTournaments,
  setPagination,
  joinTournamentLocal,
  leaveTournament
} = tournamentSlice.actions;

// Selectors
export const selectTournaments = (state) => state.tournaments.tournaments || [];
export const selectCurrentTournament = (state) => state.tournaments.currentTournament;
export const selectTournamentFilters = (state) => state.tournaments.filters;
export const selectTournamentLoading = (state) => state.tournaments.isLoading;
export const selectTournamentError = (state) => state.tournaments.error;
export const selectTournamentPagination = (state) => state.tournaments.pagination;

// Filtered tournaments selector
export const selectFilteredTournaments = (state) => {
  const { tournaments = [], filters } = state.tournaments;
  
  return tournaments.filter(tournament => {
    if (filters.gameType !== 'all' && tournament.gameType !== filters.gameType) {
      return false;
    }
    if (filters.status !== 'all' && tournament.status !== filters.status) {
      return false;
    }
    if (filters.entryFee !== 'all') {
      const fee = tournament.entryFee;
      switch (filters.entryFee) {
        case 'free':
          if (fee > 0) return false;
          break;
        case 'low':
          if (fee < 1 || fee > 500) return false;
          break;
        case 'medium':
          if (fee < 501 || fee > 2000) return false;
          break;
        case 'high':
          if (fee < 2001) return false;
          break;
        default:
          break;
      }
    }
    if (filters.prizePool !== 'all') {
      const prize = tournament.prizePool;
      switch (filters.prizePool) {
        case 'small':
          if (prize > 10000) return false;
          break;
        case 'medium':
          if (prize < 10001 || prize > 50000) return false;
          break;
        case 'large':
          if (prize < 50001) return false;
          break;
        default:
          break;
      }
    }
    return true;
  });
};

export default tournamentSlice.reducer;
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks for match operations
export const fetchUserMatches = createAsyncThunk(
  'matches/fetchUserMatches',
  async ({ status, gameType, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (gameType) params.append('gameType', gameType);
      params.append('page', page);
      params.append('limit', limit);

      const response = await axios.get(`/api/matches?${params}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch matches' });
    }
  }
);

export const fetchMatchDetails = createAsyncThunk(
  'matches/fetchMatchDetails',
  async (matchId, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/api/matches/${matchId}`);
      return response.data.data.match;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch match details' });
    }
  }
);

export const fetchTournamentMatches = createAsyncThunk(
  'matches/fetchTournamentMatches',
  async ({ tournamentId, roundNumber, status }, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (roundNumber) params.append('roundNumber', roundNumber);
      if (status) params.append('status', status);

      const response = await axios.get(`/api/matches/tournament/${tournamentId}?${params}`);
      return response.data.data.matches;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to fetch tournament matches' });
    }
  }
);

export const generateRoomCredentials = createAsyncThunk(
  'matches/generateRoomCredentials',
  async (matchId, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/matches/${matchId}/room-credentials`);
      return { matchId, credentials: response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to generate room credentials' });
    }
  }
);

export const startMatch = createAsyncThunk(
  'matches/startMatch',
  async (matchId, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/matches/${matchId}/start`);
      return response.data.data.match;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to start match' });
    }
  }
);

export const submitMatchResult = createAsyncThunk(
  'matches/submitMatchResult',
  async ({ matchId, resultData }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/matches/${matchId}/submit-result`, resultData);
      return response.data.data.match;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to submit result' });
    }
  }
);

export const uploadScreenshot = createAsyncThunk(
  'matches/uploadScreenshot',
  async ({ matchId, screenshotFile }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('screenshot', screenshotFile);

      const response = await axios.post(`/api/matches/${matchId}/upload-screenshot`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return { matchId, screenshotData: response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to upload screenshot' });
    }
  }
);

export const createDispute = createAsyncThunk(
  'matches/createDispute',
  async ({ matchId, reason }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/matches/${matchId}/dispute`, { reason });
      return response.data.data.match;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to create dispute' });
    }
  }
);

export const resolveDispute = createAsyncThunk(
  'matches/resolveDispute',
  async ({ matchId, resolution, adminNotes }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/matches/${matchId}/resolve-dispute`, {
        resolution,
        adminNotes
      });
      return response.data.data.match;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || { message: 'Failed to resolve dispute' });
    }
  }
);

const initialState = {
  matches: [],
  currentMatch: null,
  tournamentMatches: [],
  loading: {
    matches: false,
    matchDetails: false,
    tournamentMatches: false,
    roomCredentials: false,
    startMatch: false,
    submitResult: false,
    uploadScreenshot: false,
    createDispute: false,
    resolveDispute: false
  },
  error: {
    matches: null,
    matchDetails: null,
    tournamentMatches: null,
    roomCredentials: null,
    startMatch: null,
    submitResult: null,
    uploadScreenshot: null,
    createDispute: null,
    resolveDispute: null
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0
  },
  filters: {
    status: '',
    gameType: ''
  },
  roomCredentials: {},
  uploadProgress: 0
};

const matchSlice = createSlice({
  name: 'matches',
  initialState,
  reducers: {
    clearMatchError: (state, action) => {
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
    setMatchFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentMatch: (state) => {
      state.currentMatch = null;
    },
    clearTournamentMatches: (state) => {
      state.tournamentMatches = [];
    },
    updateMatchStatus: (state, action) => {
      const { matchId, status } = action.payload;
      
      // Update in matches array
      const matchIndex = state.matches.findIndex(match => match._id === matchId);
      if (matchIndex !== -1) {
        state.matches[matchIndex].status = status;
      }
      
      // Update current match if it's the same
      if (state.currentMatch && state.currentMatch._id === matchId) {
        state.currentMatch.status = status;
      }
      
      // Update in tournament matches
      const tournamentMatchIndex = state.tournamentMatches.findIndex(match => match._id === matchId);
      if (tournamentMatchIndex !== -1) {
        state.tournamentMatches[tournamentMatchIndex].status = status;
      }
    },
    updateParticipantResult: (state, action) => {
      const { matchId, userId, resultData } = action.payload;
      
      const updateParticipant = (match) => {
        if (match && match._id === matchId) {
          const participant = match.participants.find(p => p.userId._id === userId);
          if (participant) {
            Object.assign(participant, resultData);
          }
        }
      };
      
      // Update in current match
      updateParticipant(state.currentMatch);
      
      // Update in matches array
      const match = state.matches.find(match => match._id === matchId);
      updateParticipant(match);
      
      // Update in tournament matches
      const tournamentMatch = state.tournamentMatches.find(match => match._id === matchId);
      updateParticipant(tournamentMatch);
    },
    setUploadProgress: (state, action) => {
      state.uploadProgress = action.payload;
    },
    resetUploadProgress: (state) => {
      state.uploadProgress = 0;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch user matches
      .addCase(fetchUserMatches.pending, (state) => {
        state.loading.matches = true;
        state.error.matches = null;
      })
      .addCase(fetchUserMatches.fulfilled, (state, action) => {
        state.loading.matches = false;
        state.matches = action.payload.matches;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchUserMatches.rejected, (state, action) => {
        state.loading.matches = false;
        state.error.matches = action.payload;
      })
      
      // Fetch match details
      .addCase(fetchMatchDetails.pending, (state) => {
        state.loading.matchDetails = true;
        state.error.matchDetails = null;
      })
      .addCase(fetchMatchDetails.fulfilled, (state, action) => {
        state.loading.matchDetails = false;
        state.currentMatch = action.payload;
      })
      .addCase(fetchMatchDetails.rejected, (state, action) => {
        state.loading.matchDetails = false;
        state.error.matchDetails = action.payload;
      })
      
      // Fetch tournament matches
      .addCase(fetchTournamentMatches.pending, (state) => {
        state.loading.tournamentMatches = true;
        state.error.tournamentMatches = null;
      })
      .addCase(fetchTournamentMatches.fulfilled, (state, action) => {
        state.loading.tournamentMatches = false;
        state.tournamentMatches = action.payload;
      })
      .addCase(fetchTournamentMatches.rejected, (state, action) => {
        state.loading.tournamentMatches = false;
        state.error.tournamentMatches = action.payload;
      })
      
      // Generate room credentials
      .addCase(generateRoomCredentials.pending, (state) => {
        state.loading.roomCredentials = true;
        state.error.roomCredentials = null;
      })
      .addCase(generateRoomCredentials.fulfilled, (state, action) => {
        state.loading.roomCredentials = false;
        const { matchId, credentials } = action.payload;
        state.roomCredentials[matchId] = credentials;
        
        // Update current match if it's the same
        if (state.currentMatch && state.currentMatch._id === matchId) {
          state.currentMatch.roomId = credentials.roomId;
          state.currentMatch.roomPassword = credentials.roomPassword;
          state.currentMatch.serverDetails = credentials.serverDetails;
        }
      })
      .addCase(generateRoomCredentials.rejected, (state, action) => {
        state.loading.roomCredentials = false;
        state.error.roomCredentials = action.payload;
      })
      
      // Start match
      .addCase(startMatch.pending, (state) => {
        state.loading.startMatch = true;
        state.error.startMatch = null;
      })
      .addCase(startMatch.fulfilled, (state, action) => {
        state.loading.startMatch = false;
        const updatedMatch = action.payload;
        
        // Update current match
        if (state.currentMatch && state.currentMatch._id === updatedMatch._id) {
          state.currentMatch = updatedMatch;
        }
        
        // Update in matches array
        const matchIndex = state.matches.findIndex(match => match._id === updatedMatch._id);
        if (matchIndex !== -1) {
          state.matches[matchIndex] = updatedMatch;
        }
      })
      .addCase(startMatch.rejected, (state, action) => {
        state.loading.startMatch = false;
        state.error.startMatch = action.payload;
      })
      
      // Submit match result
      .addCase(submitMatchResult.pending, (state) => {
        state.loading.submitResult = true;
        state.error.submitResult = null;
      })
      .addCase(submitMatchResult.fulfilled, (state, action) => {
        state.loading.submitResult = false;
        const updatedMatch = action.payload;
        
        // Update current match
        if (state.currentMatch && state.currentMatch._id === updatedMatch._id) {
          state.currentMatch = updatedMatch;
        }
        
        // Update in matches array
        const matchIndex = state.matches.findIndex(match => match._id === updatedMatch._id);
        if (matchIndex !== -1) {
          state.matches[matchIndex] = updatedMatch;
        }
      })
      .addCase(submitMatchResult.rejected, (state, action) => {
        state.loading.submitResult = false;
        state.error.submitResult = action.payload;
      })
      
      // Upload screenshot
      .addCase(uploadScreenshot.pending, (state) => {
        state.loading.uploadScreenshot = true;
        state.error.uploadScreenshot = null;
      })
      .addCase(uploadScreenshot.fulfilled, (state, action) => {
        state.loading.uploadScreenshot = false;
        const { matchId, screenshotData } = action.payload;
        
        // Update current match if it's the same
        if (state.currentMatch && state.currentMatch._id === matchId) {
          // Find current user's participant entry and update screenshot URL
          // This would need the current user ID from auth state
        }
        
        state.uploadProgress = 0;
      })
      .addCase(uploadScreenshot.rejected, (state, action) => {
        state.loading.uploadScreenshot = false;
        state.error.uploadScreenshot = action.payload;
        state.uploadProgress = 0;
      })
      
      // Create dispute
      .addCase(createDispute.pending, (state) => {
        state.loading.createDispute = true;
        state.error.createDispute = null;
      })
      .addCase(createDispute.fulfilled, (state, action) => {
        state.loading.createDispute = false;
        const updatedMatch = action.payload;
        
        // Update current match
        if (state.currentMatch && state.currentMatch._id === updatedMatch._id) {
          state.currentMatch = updatedMatch;
        }
      })
      .addCase(createDispute.rejected, (state, action) => {
        state.loading.createDispute = false;
        state.error.createDispute = action.payload;
      })
      
      // Resolve dispute
      .addCase(resolveDispute.pending, (state) => {
        state.loading.resolveDispute = true;
        state.error.resolveDispute = null;
      })
      .addCase(resolveDispute.fulfilled, (state, action) => {
        state.loading.resolveDispute = false;
        const updatedMatch = action.payload;
        
        // Update current match
        if (state.currentMatch && state.currentMatch._id === updatedMatch._id) {
          state.currentMatch = updatedMatch;
        }
      })
      .addCase(resolveDispute.rejected, (state, action) => {
        state.loading.resolveDispute = false;
        state.error.resolveDispute = action.payload;
      });
  }
});

export const {
  clearMatchError,
  setMatchFilters,
  clearCurrentMatch,
  clearTournamentMatches,
  updateMatchStatus,
  updateParticipantResult,
  setUploadProgress,
  resetUploadProgress
} = matchSlice.actions;

// Selectors
export const selectMatches = (state) => state.matches.matches;
export const selectCurrentMatch = (state) => state.matches.currentMatch;
export const selectTournamentMatches = (state) => state.matches.tournamentMatches;
export const selectMatchLoading = (state) => state.matches.loading;
export const selectMatchError = (state) => state.matches.error;
export const selectMatchPagination = (state) => state.matches.pagination;
export const selectMatchFilters = (state) => state.matches.filters;
export const selectRoomCredentials = (state) => state.matches.roomCredentials;
export const selectUploadProgress = (state) => state.matches.uploadProgress;

export default matchSlice.reducer;
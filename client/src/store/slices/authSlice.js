import { createSlice } from '@reduxjs/toolkit';

// Get initial state from localStorage
const getInitialState = () => {
  try {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      return {
        token,
        user: JSON.parse(user),
        isAuthenticated: true,
        isLoading: false,
        error: null
      };
    }
  } catch (error) {
    console.error('Error parsing stored auth data:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  
  return {
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null
  };
};

const authSlice = createSlice({
  name: 'auth',
  initialState: getInitialState(),
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      const { token, user } = action.payload;
      state.token = token;
      state.user = user;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      
      // Store in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    loginFailure: (state, action) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = action.payload;
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    registerStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    registerSuccess: (state, action) => {
      const { token, user } = action.payload;
      state.token = token;
      state.user = user;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      
      // Store in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    },
    registerFailure: (state, action) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = action.payload;
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    updateProfile: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    updateUserStats: (state, action) => {
      if (state.user) {
        const { totalEarnings, tournamentsWon, level, experience, achievements } = action.payload;
        state.user = {
          ...state.user,
          totalEarnings: totalEarnings ?? state.user.totalEarnings,
          tournamentsWon: tournamentsWon ?? state.user.tournamentsWon,
          level: level ?? state.user.level,
          experience: experience ?? state.user.experience,
          achievements: achievements ?? state.user.achievements
        };
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
    updateLoginStreak: (state, action) => {
      if (state.user) {
        state.user.loginStreak = action.payload;
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    }
  }
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  registerStart,
  registerSuccess,
  registerFailure,
  logout,
  updateProfile,
  clearError,
  updateUserStats,
  updateLoginStreak
} = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.isLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectUserRole = (state) => state.auth.user?.role;
export const selectUserLevel = (state) => state.auth.user?.level;
export const selectUserRank = (state) => {
  const level = state.auth.user?.level || 1;
  if (level >= 50) return 'Diamond';
  if (level >= 30) return 'Gold';
  if (level >= 15) return 'Silver';
  return 'Bronze';
};

export default authSlice.reducer;
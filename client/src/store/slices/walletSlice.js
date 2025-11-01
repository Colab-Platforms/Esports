import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Configure axios base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Async thunks for wallet operations
export const fetchWalletDetails = createAsyncThunk(
  'wallet/fetchDetails',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch wallet details');
    }
  }
);

export const fetchTransactionHistory = createAsyncThunk(
  'wallet/fetchTransactions',
  async ({ page = 1, limit = 20, type = null }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page, limit });
      if (type) params.append('type', type);
      
      const response = await axios.get(`${API_BASE_URL}/wallet/transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch transactions');
    }
  }
);

export const createDepositOrder = createAsyncThunk(
  'wallet/createDepositOrder',
  async (amount, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/wallet/deposit/create-order`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create deposit order');
    }
  }
);

export const verifyPayment = createAsyncThunk(
  'wallet/verifyPayment',
  async (paymentData, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/wallet/deposit/verify`,
        paymentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Payment verification failed');
    }
  }
);

export const createWithdrawalRequest = createAsyncThunk(
  'wallet/createWithdrawal',
  async ({ amount, bankDetails }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/wallet/withdraw`,
        { amount, bankDetails },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create withdrawal request');
    }
  }
);

export const checkBalance = createAsyncThunk(
  'wallet/checkBalance',
  async (amount, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/wallet/check-balance`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to check balance');
    }
  }
);

const initialState = {
  wallet: null,
  stats: null,
  transactions: [],
  transactionsPagination: null,
  currentOrder: null,
  balanceCheck: null,
  loading: {
    wallet: false,
    transactions: false,
    deposit: false,
    withdrawal: false,
    balanceCheck: false
  },
  error: {
    wallet: null,
    transactions: null,
    deposit: null,
    withdrawal: null,
    balanceCheck: null
  }
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    clearWalletError: (state, action) => {
      const errorType = action.payload;
      if (errorType) {
        state.error[errorType] = null;
      } else {
        state.error = { ...initialState.error };
      }
    },
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
    },
    clearBalanceCheck: (state) => {
      state.balanceCheck = null;
    },
    resetWallet: (state) => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch wallet details
      .addCase(fetchWalletDetails.pending, (state) => {
        state.loading.wallet = true;
        state.error.wallet = null;
      })
      .addCase(fetchWalletDetails.fulfilled, (state, action) => {
        state.loading.wallet = false;
        state.wallet = action.payload.wallet;
        state.stats = action.payload.stats;
      })
      .addCase(fetchWalletDetails.rejected, (state, action) => {
        state.loading.wallet = false;
        state.error.wallet = action.payload;
      })

      // Fetch transaction history
      .addCase(fetchTransactionHistory.pending, (state) => {
        state.loading.transactions = true;
        state.error.transactions = null;
      })
      .addCase(fetchTransactionHistory.fulfilled, (state, action) => {
        state.loading.transactions = false;
        state.transactions = action.payload.transactions;
        state.transactionsPagination = {
          currentPage: action.payload.currentPage,
          totalPages: action.payload.totalPages,
          total: action.payload.total
        };
      })
      .addCase(fetchTransactionHistory.rejected, (state, action) => {
        state.loading.transactions = false;
        state.error.transactions = action.payload;
      })

      // Create deposit order
      .addCase(createDepositOrder.pending, (state) => {
        state.loading.deposit = true;
        state.error.deposit = null;
      })
      .addCase(createDepositOrder.fulfilled, (state, action) => {
        state.loading.deposit = false;
        state.currentOrder = action.payload;
      })
      .addCase(createDepositOrder.rejected, (state, action) => {
        state.loading.deposit = false;
        state.error.deposit = action.payload;
      })

      // Verify payment
      .addCase(verifyPayment.pending, (state) => {
        state.loading.deposit = true;
        state.error.deposit = null;
      })
      .addCase(verifyPayment.fulfilled, (state, action) => {
        state.loading.deposit = false;
        state.currentOrder = null;
        // Wallet balance will be updated when we fetch wallet details again
      })
      .addCase(verifyPayment.rejected, (state, action) => {
        state.loading.deposit = false;
        state.error.deposit = action.payload;
      })

      // Create withdrawal request
      .addCase(createWithdrawalRequest.pending, (state) => {
        state.loading.withdrawal = true;
        state.error.withdrawal = null;
      })
      .addCase(createWithdrawalRequest.fulfilled, (state, action) => {
        state.loading.withdrawal = false;
        // Add the new withdrawal transaction to the list
        state.transactions.unshift(action.payload);
      })
      .addCase(createWithdrawalRequest.rejected, (state, action) => {
        state.loading.withdrawal = false;
        state.error.withdrawal = action.payload;
      })

      // Check balance
      .addCase(checkBalance.pending, (state) => {
        state.loading.balanceCheck = true;
        state.error.balanceCheck = null;
      })
      .addCase(checkBalance.fulfilled, (state, action) => {
        state.loading.balanceCheck = false;
        state.balanceCheck = action.payload;
      })
      .addCase(checkBalance.rejected, (state, action) => {
        state.loading.balanceCheck = false;
        state.error.balanceCheck = action.payload;
      });
  }
});

export const { clearWalletError, clearCurrentOrder, clearBalanceCheck, resetWallet } = walletSlice.actions;

export default walletSlice.reducer;
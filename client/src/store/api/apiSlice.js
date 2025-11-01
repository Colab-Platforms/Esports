import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: (headers, { getState }) => {
    // Get token from auth state
    const token = getState().auth.token;
    
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    
    headers.set('content-type', 'application/json');
    return headers;
  },
});

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);
  
  // If we get a 401, logout the user
  if (result.error && result.error.status === 401) {
    api.dispatch({ type: 'auth/logout' });
  }
  
  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'User', 
    'Tournament', 
    'Match', 
    'Leaderboard', 
    'Wallet', 
    'Transaction',
    'Notification'
  ],
  endpoints: (builder) => ({
    // Health check
    healthCheck: builder.query({
      query: () => '/health',
    }),
  }),
});

export const { useHealthCheckQuery } = apiSlice;
/**
 * API Configuration Utility
 * Handles dynamic API URL resolution for different environments
 */
import api from '../services/api';

// Get the API base URL from environment or construct from window.location
export const getApiBaseUrl = () => {
  // If environment variable is set, use it
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // In production/network access, construct from current host
  // This allows the app to work when accessed via IP address
  if (window.location.hostname !== 'localhost') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = '5001'; // Backend port
    return `${protocol}//${hostname}:${port}/api`;
  }

  // Default to localhost for development
  return 'http://localhost:5001/api';
};

// Get the server base URL (without /api) for OAuth redirects
export const getServerBaseUrl = () => {
  // If environment variable is set, use it
  if (process.env.REACT_APP_SERVER_URL) {
    return process.env.REACT_APP_SERVER_URL;
  }

  // In production/network access, construct from current host
  if (window.location.hostname !== 'localhost') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = '5001'; // Backend port
    return `${protocol}//${hostname}:${port}`;
  }

  // Default to localhost for development
  return 'http://localhost:5001';
};

// Get the client base URL for redirects
export const getClientBaseUrl = () => {
  // If environment variable is set, use it
  if (process.env.REACT_APP_CLIENT_URL) {
    return process.env.REACT_APP_CLIENT_URL;
  }

  // Use current origin
  return window.location.origin;
};

// Helper to construct full API endpoint
export const getApiEndpoint = (path) => {
  const baseUrl = getApiBaseUrl();
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${baseUrl}/${cleanPath}`;
};

// Starts a "connect <provider> to my account" flow: records the intent
// server-side (authenticated via the normal Bearer header) then hands back
// a URL to full-page-redirect to. Works for any provider (google, facebook,
// steam, xbox) - identifies the user via the session set by this
// authenticated call, not a client-supplied id (unlike the old Steam-only
// getSteamAuthUrl, which used an unauthenticated `?state=<userId>` query
// param that anyone could pass any user's id into).
export const startProviderConnect = async (provider, redirectPath = '') => {
  const response = await api.post(`/api/accounts/${provider}/connect/start`, { redirectPath });
  const connectUrl = response && response.data && response.data.connectUrl;

  if (!connectUrl) {
    throw new Error(`Failed to start ${provider} connection`);
  }

  window.location.href = connectUrl;
};

// Kept for the existing Steam call sites (SteamSettingsPage,
// SteamConnectionModal/Widget, tournament registration flows) - a thin
// wrapper so none of them need to change.
export const startSteamConnect = (redirectPath = '') => startProviderConnect('steam', redirectPath);

export default {
  getApiBaseUrl,
  getServerBaseUrl,
  getClientBaseUrl,
  getApiEndpoint,
  startProviderConnect,
  startSteamConnect
};

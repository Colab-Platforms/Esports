/**
 * API Configuration Utility
 * Handles dynamic API URL resolution for different environments
 */

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

// Helper to construct Steam OAuth URL
export const getSteamAuthUrl = (userId, redirectPath = '') => {
  const serverUrl = getServerBaseUrl();
  let url = `${serverUrl}/api/steam/auth?state=${userId}`;
  
  if (redirectPath) {
    url += `&redirect=${redirectPath}`;
  }
  
  return url;
};

export default {
  getApiBaseUrl,
  getServerBaseUrl,
  getClientBaseUrl,
  getApiEndpoint,
  getSteamAuthUrl
};

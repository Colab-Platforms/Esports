// Simple API service for making HTTP requests
import apiCallTracker from '../utils/apiCallTracker';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    // Use API call tracker to prevent rate limiting
    return apiCallTracker.throttledCall(async () => {
      const url = `${this.baseURL}${endpoint}`;
      const token = localStorage.getItem('token');

      const config = {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        cache: 'no-store', // Disable browser caching
        ...options,
      };

      // Handle different body types
      if (config.body) {
        if (config.body instanceof FormData) {
          // Don't set Content-Type for FormData - browser will set it with boundary
          delete config.headers['Content-Type'];
        } else if (typeof config.body === 'object') {
          // Set Content-Type for JSON and stringify
          config.headers['Content-Type'] = 'application/json';
          config.body = JSON.stringify(config.body);
        }
      } else {
        // Set default Content-Type for non-FormData requests
        config.headers['Content-Type'] = 'application/json';
      }

      try {
        const response = await fetch(url, config);

        // Clone response to read body multiple times if needed
        const responseClone = response.clone();

        // Try to parse as JSON
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          // If JSON parsing fails, it might be HTML (404 page)
          const text = await responseClone.text();
          console.error('❌ Failed to parse response as JSON:', text.substring(0, 200));
          throw new Error(`Invalid response format. Status: ${response.status}`);
        }

        // Handle token expiry or invalid token
        if (response.status === 401 && (
          data.error?.code === 'TOKEN_EXPIRED' ||
          data.error?.code === 'INVALID_TOKEN'
        )) {
          // Clear auth data
          localStorage.removeItem('token');
          localStorage.removeItem('user');

          // Redirect to login with appropriate message
          const reason = data.error?.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid';
          window.location.href = `/login?${reason}=true`;

          throw new Error(data.error?.message || 'Session expired. Please login again.');
        }

        if (!response.ok) {
          console.error('❌ API request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: data.error,
            url,
            method: config.method
          });
          throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
        }

        return data;
      } catch (error) {
        console.error('❌ API request failed:', error);
        throw error;
      }
    });
  }

  async get(endpoint, options = {}) {
    // Handle query parameters
    let url = endpoint;
    if (options.params) {
      const queryString = new URLSearchParams(options.params).toString();
      url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${queryString}`;
      delete options.params; // Remove params from options as we've added them to URL
    }
    return this.request(url, { method: 'GET', ...options });
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
      ...options
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
      ...options
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }

  // Games API
  async getGames() {
    return this.get('/api/games');
  }

  async getFeaturedGames() {
    return this.get('/api/games/featured');
  }

  async getGame(gameId) {
    return this.get(`/api/games/${gameId}`);
  }

  // Steam API
  async getSteamStatus() {
    return this.get('/api/steam/status');
  }

  async getCS2Eligibility() {
    return this.get('/api/steam/cs2/eligibility');
  }

  async syncSteamData() {
    return this.post('/api/steam/sync');
  }

  async disconnectSteam() {
    return this.post('/api/steam/disconnect');
  }

  async getUserTournaments() {
    return this.get('/api/tournaments/my-tournaments');
  }

  // Profile API
  async updateProfile(profileData) {
    try {
      const response = await this.put('/api/auth/profile', profileData);

      // Update localStorage with new user data
      if (response.success && response.data.user) {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = { ...currentUser, ...response.data.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      return response;
    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  }
}

// Clan API
async function createClan(clanData) {
  return this.post('/api/clans', clanData);
}

async function getClan(clanId) {
  return this.get(`/api/clans/${clanId}`);
}

async function getClans(params = {}) {
  return this.get('/api/clans', { params });
}

async function updateClan(clanId, clanData) {
  return this.put(`/api/clans/${clanId}`, clanData);
}

async function deleteClan(clanId) {
  return this.delete(`/api/clans/${clanId}`);
}

async function getClanMembers(clanId) {
  return this.get(`/api/clans/${clanId}/members`);
}

async function getClanMember(clanId, userId) {
  return this.get(`/api/clans/${clanId}/members/${userId}`);
}

async function addClanMember(clanId, userId, role) {
  return this.post(`/api/clans/${clanId}/members`, { userId, role });
}

async function removeClanMember(clanId, userId) {
  return this.delete(`/api/clans/${clanId}/members/${userId}`);
}

async function updateClanMember(clanId, userId, role) {
  return this.put(`/api/clans/${clanId}/members/${userId}`, { role });
}

async function getClanMessages(clanId, params = {}) {
  return this.get(`/api/clans/${clanId}/messages`, { params });
}

async function sendClanMessage(clanId, message) {
  return this.post(`/api/clans/${clanId}/messages`, { message });
}

async function deleteClanMessage(clanId, messageId) {
  return this.delete(`/api/clans/${clanId}/messages/${messageId}`);
}

async function createClanAnnouncement(clanId, announcementData) {
  return this.post(`/api/clans/${clanId}/announcements`, announcementData);
}

async function getClanAnnouncements(clanId) {
  return this.get(`/api/clans/${clanId}/announcements`);
}

async function deleteClanAnnouncement(clanId, announcementId) {
  return this.delete(`/api/clans/${clanId}/announcements/${announcementId}`);
}

const api = new ApiService();
export default api;
// Simple API service for making HTTP requests
const API_BASE_URL = process.env.REACT_APP_API_URL || '';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      cache: 'no-store', // Disable browser caching
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
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

const api = new ApiService();
export default api;
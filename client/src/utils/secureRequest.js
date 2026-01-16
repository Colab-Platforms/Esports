// Utility for making secure API requests that hide sensitive data from network tab

class SecureRequest {
  constructor() {
    // Auto-detect API URL based on current domain
    if (process.env.REACT_APP_API_URL) {
      this.API_URL = process.env.REACT_APP_API_URL;
    } else if (typeof window !== 'undefined') {
      // Use current domain for API calls
      const protocol = window.location.protocol; // http: or https:
      const hostname = window.location.hostname; // localhost, colabesports.in, etc
      const port = window.location.port; // 3000, 5001, etc
      
      // For production (colabesports.in), use same domain with /api
      // For development (localhost:3000), use localhost:5001
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        this.API_URL = 'http://localhost:5001';
      } else {
        // Production: use same domain
        this.API_URL = `${protocol}//${hostname}`;
      }
    } else {
      this.API_URL = 'http://localhost:5001';
    }
    
    console.log('🔗 API URL configured:', this.API_URL);
  }

  // Encode sensitive data to make it less readable in network tab
  encodeSensitiveData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const encoded = { ...data };
    const sensitiveFields = ['password', 'confirmPassword', 'currentPassword', 'newPassword'];

    sensitiveFields.forEach(field => {
      if (encoded[field]) {
        // Base64 encode sensitive fields (basic obfuscation)
        encoded[field] = btoa(encoded[field]);
        encoded[`${field}_encoded`] = true;
      }
    });

    return encoded;
  }

  // Make secure POST request
  async post(endpoint, data, options = {}) {
    try {
      // Encode sensitive data
      const encodedData = this.encodeSensitiveData(data);

      const response = await fetch(`${this.API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest', // Add security header
          ...options.headers
        },
        body: JSON.stringify(encodedData),
        ...options
      });

      return await response.json();
    } catch (error) {
      console.error('Secure request error:', error);
      throw error;
    }
  }

  // Make secure GET request
  async get(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.API_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers
        },
        ...options
      });

      return await response.json();
    } catch (error) {
      console.error('Secure request error:', error);
      throw error;
    }
  }

  // Make secure PUT request
  async put(endpoint, data, options = {}) {
    try {
      const encodedData = this.encodeSensitiveData(data);

      const response = await fetch(`${this.API_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...options.headers
        },
        body: JSON.stringify(encodedData),
        ...options
      });

      return await response.json();
    } catch (error) {
      console.error('Secure request error:', error);
      throw error;
    }
  }
}

export default new SecureRequest();
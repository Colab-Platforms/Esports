// Utility for making secure API requests that hide sensitive data from network tab

class SecureRequest {
  constructor() {
    // Priority: 
    // 1. REACT_APP_API_URL from .env
    // 2. Current window location (with /api logic)
    // 3. Fallback to localhost:5003
    
    if (process.env.REACT_APP_API_URL) {
      this.API_URL = process.env.REACT_APP_API_URL;
      console.log('📝 Using API URL from environment:', this.API_URL);
    } else if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.')) {
        // Development fallback - use the same origin but check for standard ports
        // If we are on 3000, the backend is likely on 5001 or 5003
        this.API_URL = `${protocol}//${hostname}:5003`;
      } else {
        this.API_URL = `${protocol}//${hostname}`;
      }
    } else {
      this.API_URL = 'http://localhost:5003';
    }
    
    console.log('🔗 API URL configured:', this.API_URL);
    console.log('🔗 Frontend hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
    this.pendingRequests = new Map(); // Track pending requests for cancellation
    this.REQUEST_TIMEOUT = 90000; // 90 seconds timeout
    this.MAX_RETRIES = 2; // Retry up to 2 times
  }

  // Cancel previous request if new one is made to same endpoint
  cancelPreviousRequest(endpoint) {
    if (this.pendingRequests.has(endpoint)) {
      const controller = this.pendingRequests.get(endpoint);
      controller.abort();
      console.log(`🛑 Cancelled previous request to ${endpoint}`);
      this.pendingRequests.delete(endpoint);
    }
  }

  // Retry logic with exponential backoff
  async retryWithBackoff(fn, retries = this.MAX_RETRIES) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries) {
          throw error; // Final attempt failed
        }
        
        // Don't retry on abort errors (user cancelled)
        if (error.name === 'AbortError') {
          throw error;
        }
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000;
        console.log(`⏳ Retry attempt ${i + 1}/${retries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
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

      console.log(`🔗 POST ${this.API_URL}${endpoint}`);
      console.log(`🔗 Full URL: ${this.API_URL}${endpoint}`);
      
      // Use retry logic for POST requests
      return await this.retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
        
        try {
          const response = await fetch(`${this.API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              ...options.headers
            },
            body: JSON.stringify(encodedData),
            signal: controller.signal,
            ...options
          });

          clearTimeout(timeoutId);
          console.log(`📊 Response status: ${response.status}`);
          
          if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            const errorData = await response.json();
            console.error('❌ Error response:', errorData);
            return errorData;
          }

          const result = await response.json();
          console.log('✅ Response data:', result);
          return result;
        } finally {
          clearTimeout(timeoutId);
        }
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ Request timeout or cancelled - took longer than 90 seconds');
        throw new Error('Request timeout. Please check your internet connection and try again.');
      }
      console.error('❌ Secure request error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  // Make secure GET request
  async get(endpoint, options = {}) {
    try {
      // Cancel previous request to same endpoint
      this.cancelPreviousRequest(endpoint);
      
      // Use retry logic for GET requests
      return await this.retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
        
        // Store controller for potential cancellation
        this.pendingRequests.set(endpoint, controller);
        
        try {
          const response = await fetch(`${this.API_URL}${endpoint}`, {
            method: 'GET',
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              ...options.headers
            },
            signal: controller.signal,
            ...options
          });

          clearTimeout(timeoutId);
          this.pendingRequests.delete(endpoint);
          
          if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            const errorData = await response.json();
            return errorData;
          }

          return await response.json();
        } finally {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(endpoint);
        }
      });
    } catch (error) {
      this.pendingRequests.delete(endpoint);
      
      if (error.name === 'AbortError') {
        console.error('❌ Request timeout or cancelled - took longer than 90 seconds');
        throw new Error('Request timeout. Please check your internet connection and try again.');
      }
      console.error('❌ Secure request error:', error);
      throw error;
    }
  }

  // Make secure PUT request
  async put(endpoint, data, options = {}) {
    try {
      // Cancel previous request to same endpoint
      this.cancelPreviousRequest(endpoint);
      
      const encodedData = this.encodeSensitiveData(data);
      
      // Use retry logic for PUT requests
      return await this.retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
        
        // Store controller for potential cancellation
        this.pendingRequests.set(endpoint, controller);

        try {
          const response = await fetch(`${this.API_URL}${endpoint}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              ...options.headers
            },
            body: JSON.stringify(encodedData),
            signal: controller.signal,
            ...options
          });

          clearTimeout(timeoutId);
          this.pendingRequests.delete(endpoint);
          
          if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            const errorData = await response.json();
            return errorData;
          }

          return await response.json();
        } finally {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(endpoint);
        }
      });
    } catch (error) {
      this.pendingRequests.delete(endpoint);
      
      if (error.name === 'AbortError') {
        console.error('❌ Request timeout or cancelled - took longer than 90 seconds');
        throw new Error('Request timeout. Please check your internet connection and try again.');
      }
      console.error('❌ Secure request error:', error);
      throw error;
    }
  }
}

export default new SecureRequest();
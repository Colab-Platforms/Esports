// API Call Tracker to prevent rate limiting
class ApiCallTracker {
  constructor() {
    this.calls = [];
    this.maxCallsPerMinute = 50; // Conservative limit
    this.windowMs = 60 * 1000; // 1 minute
  }

  canMakeCall() {
    const now = Date.now();
    
    // Remove calls older than window
    this.calls = this.calls.filter(callTime => now - callTime < this.windowMs);
    
    // Check if we're under the limit
    return this.calls.length < this.maxCallsPerMinute;
  }

  recordCall() {
    this.calls.push(Date.now());
  }

  async throttledCall(apiCall) {
    if (!this.canMakeCall()) {
      console.warn('⚠️ API call throttled - too many requests');
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!this.canMakeCall()) {
        throw new Error('Rate limit exceeded - please try again later');
      }
    }

    this.recordCall();
    return apiCall();
  }

  getStats() {
    const now = Date.now();
    const recentCalls = this.calls.filter(callTime => now - callTime < this.windowMs);
    
    return {
      callsInLastMinute: recentCalls.length,
      maxCalls: this.maxCallsPerMinute,
      canMakeCall: this.canMakeCall()
    };
  }
}

// Create singleton instance
const apiCallTracker = new ApiCallTracker();

export default apiCallTracker;
// Middleware to sanitize responses and hide sensitive data from network tab

const sanitizeResponse = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override json method to sanitize response
  res.json = function(data) {
    // Don't sanitize in development for debugging
    if (process.env.NODE_ENV === 'development') {
      return originalJson.call(this, data);
    }
    
    // Sanitize response data
    const sanitizedData = sanitizeData(data);
    return originalJson.call(this, sanitizedData);
  };
  
  next();
};

const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sanitized = { ...data };
  
  // Remove sensitive fields from response
  const sensitiveFields = [
    'passwordHash',
    'password',
    'resetPasswordToken',
    'resetPasswordExpires',
    'socialAccounts.google.id',
    'socialAccounts.steam.steamId',
    'phone', // Hide phone numbers in production
    'email' // Partially hide email in production
  ];
  
  // Recursively sanitize object
  const sanitizeObject = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if current path matches sensitive field
      if (sensitiveFields.some(field => currentPath.includes(field))) {
        if (key === 'email' && typeof value === 'string') {
          // Partially hide email: test@example.com -> t***@e***.com
          const [username, domain] = value.split('@');
          result[key] = `${username[0]}***@${domain[0]}***.${domain.split('.').pop()}`;
        } else if (key === 'phone' && typeof value === 'string') {
          // Partially hide phone: 9876543210 -> 98***43210
          result[key] = `${value.slice(0, 2)}***${value.slice(-5)}`;
        } else {
          // Remove completely sensitive fields
          result[key] = '[HIDDEN]';
        }
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value, currentPath);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  };
  
  return sanitizeObject(sanitized);
};

module.exports = sanitizeResponse;
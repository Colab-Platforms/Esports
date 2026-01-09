// Proper HTTP headers middleware for performance, security, and compatibility
const headers = (req, res, next) => {
  // Cache Control Headers
  if (req.path.startsWith('/api/')) {
    // API routes - no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (req.path.match(/\.(js|css|woff|woff2|ttf|eot|svg|png|jpg|jpeg|gif|webp)$/i)) {
    // Static assets - long cache (1 year)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.path === '/' || req.path === '/index.html') {
    // HTML - short cache (1 hour) but with ETag for validation
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  } else {
    // Other files - short cache (1 hour)
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content Security Policy - Allow localhost for development
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' localhost:3000 localhost:5001; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://gameplayscassi.com.br https://accounts.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: http://localhost:*; frame-ancestors 'self'; form-action 'self' https://accounts.google.com;"
  );

  // Remove deprecated headers
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');

  next();
};

module.exports = headers;

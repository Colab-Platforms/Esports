/**
 * No-Cache Middleware
 * Prevents browser and proxy caching of API responses
 * This ensures fresh data is always fetched from the server
 */

const noCache = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
};

module.exports = noCache;

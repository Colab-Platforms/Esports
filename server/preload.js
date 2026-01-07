// Preload script - runs before any other code
// Disables console in production

// Check if we should disable console
// Disable by default UNLESS explicitly in development mode
const shouldDisableConsole = process.env.NODE_ENV !== 'development' && process.env.DEBUG !== 'true';

if (shouldDisableConsole) {
  // Create a no-op function
  const noop = () => {};
  
  // Override all console methods
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
  console.assert = noop;
  console.clear = noop;
  console.count = noop;
  console.dir = noop;
  console.dirxml = noop;
  console.group = noop;
  console.groupCollapsed = noop;
  console.groupEnd = noop;
  console.profile = noop;
  console.profileEnd = noop;
  console.table = noop;
  console.time = noop;
  console.timeEnd = noop;
  console.timeLog = noop;
  console.timeStamp = noop;
}

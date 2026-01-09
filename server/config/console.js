// Global console configuration
// Disables console in production, enables in development

const noop = () => {};

// TEMPORARILY ENABLE CONSOLE FOR DEBUGGING
// TODO: Disable this after debugging is complete
const ENABLE_DEBUG_LOGGING = true;

// Only disable console in production (unless debug logging is enabled)
if (process.env.NODE_ENV === 'production' && !ENABLE_DEBUG_LOGGING) {
  // Override all console methods in production
  global.console = {
    log: noop,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    trace: noop,
    assert: noop,
    clear: noop,
    count: noop,
    dir: noop,
    dirxml: noop,
    group: noop,
    groupCollapsed: noop,
    groupEnd: noop,
    profile: noop,
    profileEnd: noop,
    table: noop,
    time: noop,
    timeEnd: noop,
    timeLog: noop,
    timeStamp: noop
  };
} else {
  // Keep console enabled in development and for debugging
  console.log('🔍 DEBUG LOGGING ENABLED - Console output is active');
}


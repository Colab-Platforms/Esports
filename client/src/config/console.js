// Global console configuration for frontend
// Disables console in production, enables in development

const noop = () => {};

// Only disable console in production
if (process.env.NODE_ENV === 'production') {
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
  // Keep console enabled in development
  // This allows us to see logs for debugging
}

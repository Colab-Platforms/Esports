const passport = require('passport');
const User = require('../models/User');
const googleProvider = require('../services/auth/providers/google.provider');
const steamProvider = require('../services/auth/providers/steam.provider');
const facebookProvider = require('../services/auth/providers/facebook.provider');
const xboxProvider = require('../services/auth/providers/xbox.provider');

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth Strategy - registration + profile normalization now live in
// services/auth/providers/google.provider.js. The verify callback there
// hands back a normalized identity, not a User document; routes/auth.js's
// /google/callback resolves that identity to an application User via
// services/auth/auth.service.js (see the architecture migration, Phase 3).
googleProvider.configure(passport);

// Steam Strategy - registration + profile normalization now live in
// services/auth/providers/steam.provider.js, mirroring the Google adapter.
// The verify callback there hands back a normalized identity, not a User
// document. passport-steam's returnURL is fixed at registration time, so
// there's a single real callback (routes/auth.js's /steam/return) for both
// login and connect - it branches on a session-recorded connect intent set
// by routes/accounts.js's /steam/connect/start (see account-linking.service.js).
steamProvider.configure(passport);

// Facebook OAuth Strategy - same adapter pattern as Google/Steam. Facebook
// can return no email (declined permission, or none on the account) -
// facebook.provider.js's normalizeProfile already accounts for that.
facebookProvider.configure(passport);

// Xbox Strategy - generic OAuth2 (not passport-microsoft: this flow is
// deliberately Xbox-scoped only, not a general "Sign in with Microsoft" -
// see providers.config.js and xbox.provider.js for why). The verify
// callback there does its own Xbox Live XSTS exchange with the access
// token rather than calling a standard profile endpoint.
xboxProvider.configure(passport);

module.exports = passport;
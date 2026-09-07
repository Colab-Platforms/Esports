const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { providers, isProviderEnabled, PROVIDERS } = require('../../../config/providers.config');

// Turns a raw passport-google-oauth20 profile into the normalized identity
// shape every provider adapter must produce. Deliberately does not touch
// User/Identity/Mongo at all - that orchestration lives in auth.service.js,
// so this file only ever needs to know about Google's own API shape.
function normalizeProfile(profile) {
  const email = profile.emails && profile.emails[0] && profile.emails[0].value;

  if (!email) {
    const error = new Error('No email provided by Google');
    error.code = 'PROVIDER_AUTH_FAILED';
    throw error;
  }

  return {
    providerId: profile.id,
    email,
    // Google only ever asserts an email address it has itself verified.
    emailVerifiedByProvider: true,
    displayName: profile.displayName || '',
    username: '',
    avatarUrl: (profile.photos && profile.photos[0] && profile.photos[0].value) || '',
    profile: {},
    metadata: {}
  };
}

function configure(passport) {
  if (!isProviderEnabled(PROVIDERS.GOOGLE)) {
    console.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    return;
  }

  const config = providers[PROVIDERS.GOOGLE];

  passport.use(new GoogleStrategy({
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackUrl
  }, (accessToken, refreshToken, profile, done) => {
    try {
      done(null, normalizeProfile(profile));
    } catch (error) {
      done(error, null);
    }
  }));
}

module.exports = { configure, normalizeProfile };

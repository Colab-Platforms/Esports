const FacebookStrategy = require('passport-facebook').Strategy;
const { providers, isProviderEnabled, PROVIDERS } = require('../../../config/providers.config');

// Turns a raw passport-facebook profile into the normalized identity shape
// every provider adapter must produce. Deliberately does not touch
// User/Identity/Mongo - that orchestration lives in auth.service.js.
//
// Unlike Google, Facebook can return no email at all (the user declined the
// email permission, or has none on their account), and Facebook's Graph API
// does not expose a provider-verified flag the way Google's does - so this
// never reports emailVerifiedByProvider:true. auth.service.js's
// loginWithIdentity already treats an empty email as "skip the email-based
// collision check", which is exactly the right behavior here - same
// mechanism Steam relies on for the same reason.
function normalizeProfile(profile) {
  const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || '';

  return {
    providerId: profile.id,
    email,
    emailVerifiedByProvider: false,
    displayName: profile.displayName || '',
    username: '',
    avatarUrl: (profile.photos && profile.photos[0] && profile.photos[0].value) || '',
    profile: {},
    metadata: {}
  };
}

function configure(passport) {
  if (!isProviderEnabled(PROVIDERS.FACEBOOK)) {
    console.warn('Facebook OAuth not configured - missing FACEBOOK_CLIENT_ID or FACEBOOK_CLIENT_SECRET');
    return;
  }

  const config = providers[PROVIDERS.FACEBOOK];

  passport.use(new FacebookStrategy({
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackUrl,
    profileFields: ['id', 'displayName', 'emails', 'photos']
  }, (accessToken, refreshToken, profile, done) => {
    try {
      done(null, normalizeProfile(profile));
    } catch (error) {
      done(error, null);
    }
  }));
}

module.exports = { configure, normalizeProfile };

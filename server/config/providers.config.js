// Central provider configuration for the auth system - single source of
// truth for which identity providers exist, their env vars, and whether
// they're currently configured. Consumed by the provider adapters
// (services/auth/providers/*) and the route registration loop in
// routes/auth.js - do not duplicate env-var lookups elsewhere.

const PROVIDERS = {
  GOOGLE: 'google',
  FACEBOOK: 'facebook',
  STEAM: 'steam',
  XBOX: 'xbox'
};

const isPlaceholder = (value, placeholder) => !value || value === placeholder;

const providers = {
  [PROVIDERS.GOOGLE]: {
    id: PROVIDERS.GOOGLE,
    label: 'Google',
    protocol: 'oauth2',
    enabled: !isPlaceholder(process.env.GOOGLE_CLIENT_ID, 'your-google-client-id') &&
      !isPlaceholder(process.env.GOOGLE_CLIENT_SECRET, 'your-google-client-secret'),
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: `${process.env.SERVER_URL}/api/auth/google/callback`,
    scope: ['profile', 'email']
  },
  [PROVIDERS.FACEBOOK]: {
    id: PROVIDERS.FACEBOOK,
    label: 'Facebook',
    protocol: 'oauth2',
    enabled: Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET),
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackUrl: `${process.env.SERVER_URL}/api/auth/facebook/callback`,
    scope: ['email', 'public_profile']
  },
  [PROVIDERS.STEAM]: {
    id: PROVIDERS.STEAM,
    label: 'Steam',
    protocol: 'openid',
    enabled: Boolean(process.env.STEAM_API_KEY),
    apiKey: process.env.STEAM_API_KEY,
    returnUrl: process.env.STEAM_RETURN_URL || 'http://localhost:5001/api/auth/steam/return',
    realm: process.env.STEAM_REALM || 'http://localhost:5001/'
  },
  [PROVIDERS.XBOX]: {
    id: PROVIDERS.XBOX,
    label: 'Xbox',
    // IMPORTANT: the Microsoft identity platform issues one access token per
    // resource audience per authorization request - `XboxLive.signin` (Xbox
    // Live's own API) and `openid`/`profile`/`email` (which Microsoft hosts
    // on the Graph audience) cannot be requested together and mixed in a
    // single token. So this is NOT "Microsoft login, plus Xbox on top" - the
    // whole authorization request is Xbox-scoped from the start, against the
    // `consumers` tenant (personal Microsoft accounts), and there is no
    // separate OIDC identity available in this flow to fall back to if the
    // XSTS exchange fails - see xbox.provider.js.
    protocol: 'xbox-oauth2+xsts',
    enabled: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackUrl: `${process.env.SERVER_URL}/api/auth/xbox/callback`,
    authorizationURL: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
    tokenURL: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
    scope: 'XboxLive.signin XboxLive.offline_access'
  }
};

const isValidProvider = (provider) => Object.prototype.hasOwnProperty.call(providers, provider);

const isProviderEnabled = (provider) => isValidProvider(provider) && providers[provider].enabled;

module.exports = {
  PROVIDERS,
  providers,
  isValidProvider,
  isProviderEnabled
};

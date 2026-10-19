const OAuth2Strategy = require('passport-oauth2');
const axios = require('axios');
const { providers, isProviderEnabled, PROVIDERS } = require('../../../config/providers.config');

// Known Xbox Live "XErr" codes returned by xsts.auth.xboxlive.com/xsts/authorize
// when a Microsoft account can't be signed in to Xbox Live at all (as opposed
// to a transient failure) - documented by community reverse-engineering
// (Microsoft does not publish this API), consistent across Minecraft/Xbox
// third-party auth implementations. Anything not in this map falls back to a
// generic message.
const XBOX_ERROR_MESSAGES = {
  2148916233: 'This Microsoft account does not have an Xbox profile yet. Create one at xbox.com and try again.',
  2148916235: 'Xbox Live is not available for this account\'s region.',
  2148916236: 'This Microsoft account needs adult verification before it can sign in to Xbox.',
  2148916237: 'This Microsoft account needs adult verification before it can sign in to Xbox.',
  2148916238: 'This is a child account and must be added to a family by an adult before it can sign in to Xbox.'
};

class XboxProfileUnavailableError extends Error {
  constructor(message, xErr) {
    super(message);
    this.name = 'XboxProfileUnavailableError';
    this.code = 'XBOX_PROFILE_UNAVAILABLE';
    this.xErr = xErr;
  }
}

// Exchanges a Microsoft access token (obtained with the XboxLive.signin
// scope - see providers.config.js) for the caller's Xbox Live gamertag/XUID.
// Two hops, per Microsoft's (undocumented) Xbox Live auth protocol:
//   1. user.auth.xboxlive.com -> a Xbox "user token" (XASU)
//   2. xsts.auth.xboxlive.com -> the actual XSTS token, whose DisplayClaims
//      carry the gamertag (gtg) and XUID (xid) for RelyingParty xboxlive.com.
// "d=" prefixes the RpsTicket specifically because this app is a custom
// Azure AD registration (as opposed to Microsoft's own first-party client,
// which uses a "t=" prefix instead).
async function exchangeForXboxLiveClaims(microsoftAccessToken) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };

  const userAuthResponse = await axios.post('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${microsoftAccessToken}`
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  }, { headers });

  const userToken = userAuthResponse.data && userAuthResponse.data.Token;
  if (!userToken) {
    throw new XboxProfileUnavailableError('Unable to verify your Xbox account. Please try again.');
  }

  let xstsResponse;
  try {
    xstsResponse = await axios.post('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [userToken]
      },
      RelyingParty: 'http://xboxlive.com',
      TokenType: 'JWT'
    }, { headers });
  } catch (error) {
    const xErr = error.response && error.response.data && error.response.data.XErr;
    const message = (xErr && XBOX_ERROR_MESSAGES[xErr]) || 'Unable to verify your Xbox account. Please try again.';
    throw new XboxProfileUnavailableError(message, xErr);
  }

  const claims = xstsResponse.data
    && xstsResponse.data.DisplayClaims
    && xstsResponse.data.DisplayClaims.xui
    && xstsResponse.data.DisplayClaims.xui[0];

  if (!claims || !claims.xid) {
    throw new XboxProfileUnavailableError('Unable to retrieve your Xbox profile. Please try again.');
  }

  return {
    xuid: claims.xid,
    gamertag: claims.gtg || '',
    userHash: claims.uhs || ''
  };
}

// Turns Xbox Live claims into the normalized identity shape every provider
// adapter must produce. No email is available from this flow at all (see
// providers.config.js for why) - same "no email" handling Steam already
// relies on in auth.service.js.
function normalizeProfile(xboxLiveClaims) {
  return {
    providerId: xboxLiveClaims.xuid,
    email: '',
    emailVerifiedByProvider: false,
    displayName: xboxLiveClaims.gamertag || '',
    username: '',
    avatarUrl: '',
    profile: {
      gamertag: xboxLiveClaims.gamertag || '',
      xuid: xboxLiveClaims.xuid
    },
    metadata: {}
  };
}

function configure(passport) {
  if (!isProviderEnabled(PROVIDERS.XBOX)) {
    console.warn('Xbox OAuth not configured - missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET');
    return;
  }

  const config = providers[PROVIDERS.XBOX];

  passport.use('xbox', new OAuth2Strategy({
    authorizationURL: config.authorizationURL,
    tokenURL: config.tokenURL,
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: config.callbackUrl
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const claims = await exchangeForXboxLiveClaims(accessToken);
      done(null, normalizeProfile(claims));
    } catch (error) {
      done(error, null);
    }
  }));
}

module.exports = { configure, normalizeProfile, exchangeForXboxLiveClaims, XboxProfileUnavailableError };

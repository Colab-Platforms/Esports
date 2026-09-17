const axios = require('axios');
const { providers, isProviderEnabled, PROVIDERS } = require('../../../config/providers.config');

class RiotProviderError extends Error {
  constructor(message, code = 'RIOT_AUTH_FAILED') {
    super(message);
    this.name = 'RiotProviderError';
    this.code = code;
  }
}

function buildAuthorizationUrl(state) {
  if (!isProviderEnabled(PROVIDERS.RIOT)) {
    throw new RiotProviderError('Riot OAuth is not configured.', 'RIOT_OAUTH_NOT_CONFIGURED');
  }

  const config = providers[PROVIDERS.RIOT];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    response_type: 'code',
    scope: config.scope,
    state
  });

  return `${config.authorizationURL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const config = providers[PROVIDERS.RIOT];

  const response = await axios.post(
    config.tokenURL,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.callbackUrl
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: {
        username: config.clientId,
        password: config.clientSecret
      }
    }
  );

  if (!response.data || !response.data.access_token) {
    throw new RiotProviderError('Riot did not return an access token.');
  }

  return response.data.access_token;
}

async function fetchAuthenticatedAccount(accessToken) {
  const config = providers[PROVIDERS.RIOT];
  const response = await axios.get(config.accountUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const account = response.data || {};
  if (!account.puuid || !account.gameName || !account.tagLine) {
    throw new RiotProviderError('Riot account response was missing required identity fields.');
  }

  return account;
}

function normalizeAccount(account) {
  const gameName = String(account.gameName || '').trim();
  const tagLine = String(account.tagLine || '').trim();
  const displayName = `${gameName}#${tagLine}`;

  return {
    providerId: account.puuid,
    canLogin: false,
    email: '',
    emailVerifiedByProvider: false,
    displayName,
    username: '',
    avatarUrl: '',
    profile: {
      gameName,
      tagLine
    },
    metadata: {
      verifiedAt: new Date()
    }
  };
}

async function getIdentityFromAuthorizationCode(code) {
  if (!code || typeof code !== 'string') {
    throw new RiotProviderError('Missing Riot authorization code.');
  }

  const accessToken = await exchangeCodeForToken(code);
  const account = await fetchAuthenticatedAccount(accessToken);
  return normalizeAccount(account);
}

module.exports = {
  RiotProviderError,
  buildAuthorizationUrl,
  exchangeCodeForToken,
  fetchAuthenticatedAccount,
  normalizeAccount,
  getIdentityFromAuthorizationCode
};

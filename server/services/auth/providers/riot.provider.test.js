const test = require('node:test');
const assert = require('node:assert/strict');

const providerPath = require.resolve('./riot.provider');
const configPath = require.resolve('../../../config/providers.config');

function loadProviderWithEnv(env) {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  delete require.cache[providerPath];
  delete require.cache[configPath];
  const provider = require('./riot.provider');
  process.env = previous;
  return provider;
}

test('normalizeAccount stores PUUID as providerId and Riot ID as display profile', () => {
  const riotProvider = loadProviderWithEnv({});
  const normalized = riotProvider.normalizeAccount({
    puuid: 'riot-puuid-123',
    gameName: 'TenZ',
    tagLine: '1234'
  });

  assert.equal(normalized.providerId, 'riot-puuid-123');
  assert.equal(normalized.canLogin, false);
  assert.equal(normalized.displayName, 'TenZ#1234');
  assert.deepEqual(normalized.profile, { gameName: 'TenZ', tagLine: '1234' });
  assert.ok(normalized.metadata.verifiedAt instanceof Date);
});

test('buildAuthorizationUrl refuses to run without Riot credentials', () => {
  const riotProvider = loadProviderWithEnv({
    RIOT_CLIENT_ID: '',
    RIOT_CLIENT_SECRET: '',
    RIOT_REDIRECT_URI: ''
  });

  assert.throws(
    () => riotProvider.buildAuthorizationUrl('state-123'),
    /Riot OAuth is not configured/
  );
});

test('buildAuthorizationUrl includes state and configured redirect URI', () => {
  const riotProvider = loadProviderWithEnv({
    RIOT_CLIENT_ID: 'riot-client',
    RIOT_CLIENT_SECRET: 'riot-secret',
    RIOT_REDIRECT_URI: 'http://localhost:5001/api/auth/riot/callback'
  });

  const url = new URL(riotProvider.buildAuthorizationUrl('state-123'));
  assert.equal(url.origin + url.pathname, 'https://auth.riotgames.com/authorize');
  assert.equal(url.searchParams.get('client_id'), 'riot-client');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:5001/api/auth/riot/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'openid offline_access');
  assert.equal(url.searchParams.get('state'), 'state-123');
});

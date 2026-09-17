const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const authRouteSource = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');
const accountsRouteSource = fs.readFileSync(path.join(__dirname, 'accounts.js'), 'utf8');
const teamsRouteSource = fs.readFileSync(path.join(__dirname, 'teams.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');
const identityModelSource = fs.readFileSync(path.join(__dirname, '../models/Identity.js'), 'utf8');
const profileFormSource = fs.readFileSync(
  path.join(__dirname, '../../client/src/components/profile/ProfileSettingsForm.js'),
  'utf8'
);
const connectedAccountsSource = fs.readFileSync(
  path.join(__dirname, '../../client/src/pages/ConnectedAccountsPage.js'),
  'utf8'
);

test('Riot callback is account-linking only and does not use website login flow', () => {
  const routeStart = authRouteSource.indexOf("router.get('/riot/callback'");
  const nextRoute = authRouteSource.indexOf("router.post('/exchange'", routeStart);
  const riotCallbackSource = authRouteSource.slice(routeStart, nextRoute);

  assert.notEqual(routeStart, -1);
  assert.notEqual(nextRoute, -1);
  assert.equal(riotCallbackSource.includes('loginWithIdentity'), false);
  assert.equal(riotCallbackSource.includes('handleConnectCallback'), true);
});

test('Profile UI prevents manual Valorant edits when Riot is verified', () => {
  assert.equal(profileFormSource.includes('Verify with Riot'), true);
  assert.equal(profileFormSource.includes('Disconnect Riot'), true);
  assert.equal(profileFormSource.includes('disabled={!isEditing || isRiotVerified}'), true);
});

test('profile and teams routes use centralized Riot-aware Valorant write guard', () => {
  assert.equal(authRouteSource.includes("require('../services/auth/verified-game-id.service')"), true);
  assert.equal(authRouteSource.includes('applyUntrustedValorantUpdate(req.user.userId'), true);
  assert.equal(teamsRouteSource.includes("require('../services/auth/verified-game-id.service')"), true);
  assert.equal(teamsRouteSource.includes('applyUntrustedValorantUpdate(info.userId'), true);
  assert.equal(teamsRouteSource.includes('applyUntrustedValorantUpdate(captainId'), true);
});

test('Riot auth route is covered by shared OAuth limiter', () => {
  assert.equal(indexSource.includes("app.use('/api/auth/riot', oauthLimiter);"), true);
});

test('production session cookie has explicit SameSite configuration', () => {
  assert.equal(indexSource.includes('SESSION_COOKIE_SAMESITE'), true);
  assert.equal(indexSource.includes('sameSite: sessionCookieSameSite'), true);
});

test('Riot has a provider-scoped one-identity-per-user partial unique index', () => {
  assert.equal(identityModelSource.includes("partialFilterExpression: { provider: 'riot' }"), true);
  assert.equal(identityModelSource.includes('{ userId: 1, provider: 1 }'), true);
});

test('/api/accounts serializes provider DTOs instead of raw profile and metadata', () => {
  const listRouteStart = accountsRouteSource.indexOf("router.get('/', auth");
  const steamStatusStart = accountsRouteSource.indexOf("router.get('/steam/status'", listRouteStart);
  const listRouteSource = accountsRouteSource.slice(listRouteStart, steamStatusStart);

  assert.equal(accountsRouteSource.includes('serializeConnectedAccount'), true);
  assert.equal(listRouteSource.includes('steamGames'), false);
  assert.equal(listRouteSource.includes('metadata: identity.metadata || {}'), false);
  assert.equal(listRouteSource.includes('profile: identity.profile || {}'), false);
});

test('frontend does not present Riot as a sign-in-capable account', () => {
  assert.equal(connectedAccountsSource.includes('Verification connected'), true);
  assert.equal(connectedAccountsSource.includes('Some providers can be used to sign in'), true);
});

test('Profile UI shows status-unavailable state when connected account lookup fails', () => {
  assert.equal(profileFormSource.includes('Unable to load Riot verification status. Please try again.'), true);
  assert.equal(profileFormSource.includes('Status unavailable'), true);
  assert.equal(profileFormSource.includes('accountsLoadError'), true);
});

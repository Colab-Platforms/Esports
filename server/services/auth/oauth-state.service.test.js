const test = require('node:test');
const assert = require('node:assert/strict');

const oauthStateService = require('./oauth-state.service');

test('OAuth state verifies once for the matching provider and state', () => {
  const req = { session: {} };
  const state = oauthStateService.issue(req, 'google');

  assert.equal(oauthStateService.verify(req, 'google', state), true);
  assert.equal(oauthStateService.verify(req, 'google', state), false);
});

test('OAuth state rejects wrong provider, wrong state, and expired state', () => {
  const wrongProviderReq = { session: {} };
  const state = oauthStateService.issue(wrongProviderReq, 'google');
  assert.equal(oauthStateService.verify(wrongProviderReq, 'steam', state), false);

  const wrongStateReq = { session: {} };
  oauthStateService.issue(wrongStateReq, 'facebook');
  assert.equal(oauthStateService.verify(wrongStateReq, 'facebook', 'not-the-state'), false);

  const expiredReq = {
    session: {
      oauthState: {
        provider: 'xbox',
        state: 'expired-state',
        issuedAt: Date.now() - (11 * 60 * 1000)
      }
    }
  };
  assert.equal(oauthStateService.verify(expiredReq, 'xbox', 'expired-state'), false);
});

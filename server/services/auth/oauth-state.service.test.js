const test = require('node:test');
const assert = require('node:assert/strict');

const oauthStateService = require('./oauth-state.service');

test('OAuth state verifies once for the matching provider and state', () => {
  const req = { session: {} };
  const state = oauthStateService.issue(req, 'riot');

  assert.equal(oauthStateService.verify(req, 'riot', state), true);
  assert.equal(oauthStateService.verify(req, 'riot', state), false);
});

test('OAuth state rejects wrong provider, wrong state, and expired state', () => {
  const wrongProviderReq = { session: {} };
  const state = oauthStateService.issue(wrongProviderReq, 'riot');
  assert.equal(oauthStateService.verify(wrongProviderReq, 'steam', state), false);

  const wrongStateReq = { session: {} };
  oauthStateService.issue(wrongStateReq, 'riot');
  assert.equal(oauthStateService.verify(wrongStateReq, 'riot', 'not-the-state'), false);

  const expiredReq = {
    session: {
      oauthState: {
        provider: 'riot',
        state: 'expired-state',
        issuedAt: Date.now() - (11 * 60 * 1000)
      }
    }
  };
  assert.equal(oauthStateService.verify(expiredReq, 'riot', 'expired-state'), false);
});

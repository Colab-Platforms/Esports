const crypto = require('crypto');

const SESSION_KEY = 'oauthState';
const STATE_TTL_MS = 10 * 60 * 1000; // generous for a real consent screen, still bounds the replay window

// Uses the existing express-session (already mounted globally for Steam's
// OpenID handshake) rather than adding a new cookie/dependency. Storing the
// nonce server-side, keyed to the session cookie, binds the OAuth flow to
// the specific browser that started it - a plain signed/HMAC state value
// would stop forged state but not a captured, still-valid authorization
// code being replayed into a different browser (login CSRF).

/**
 * Issues a fresh CSRF state value for an OAuth2 authorization request and
 * stores it on the current session for later verification.
 */
function issue(req, provider) {
  const state = crypto.randomBytes(24).toString('hex');
  req.session[SESSION_KEY] = { provider, state, issuedAt: Date.now() };
  return state;
}

/**
 * Verifies a returned `state` against what was issued for this session and
 * provider, then clears it (single-use). Never throws - callers decide how
 * to respond to an invalid state.
 */
function verify(req, provider, returnedState) {
  const stored = req.session && req.session[SESSION_KEY];
  if (req.session) {
    req.session[SESSION_KEY] = undefined;
  }

  if (!stored || !returnedState) return false;
  if (stored.provider !== provider) return false;
  if (stored.state !== returnedState) return false;
  if (Date.now() - stored.issuedAt > STATE_TTL_MS) return false;

  return true;
}

module.exports = { issue, verify };
